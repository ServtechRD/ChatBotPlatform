import asyncio
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from services.stt_service import transcribe
from utils.logger import get_logger

logger = get_logger(__name__)

STT_GPU_CONCURRENCY = int(os.getenv("STT_GPU_CONCURRENCY", "15"))
STT_QUEUE_MAX_SIZE = int(os.getenv("STT_QUEUE_MAX_SIZE", "30"))
STT_QUEUE_TIMEOUT = float(os.getenv("STT_QUEUE_TIMEOUT", "120"))


@dataclass
class STTJob:
    audio_bytes: bytes
    suffix: str
    language: str
    initial_prompt: Optional[str]
    future: asyncio.Future
    created_at: float


_queue: Optional[asyncio.Queue] = None
_workers: list[asyncio.Task] = []
_executor: Optional[ThreadPoolExecutor] = None


def _is_started() -> bool:
    return _queue is not None and _executor is not None and any(not task.done() for task in _workers)


async def start_stt_queue() -> None:
    global _queue, _executor
    if _is_started():
        return

    _queue = asyncio.Queue(maxsize=STT_QUEUE_MAX_SIZE)
    _executor = ThreadPoolExecutor(max_workers=STT_GPU_CONCURRENCY, thread_name_prefix="stt-gpu")
    _workers.clear()
    for index in range(STT_GPU_CONCURRENCY):
        _workers.append(asyncio.create_task(_stt_worker(index + 1)))

    logger.info(
        "[STT Queue] started concurrency=%d max_size=%d timeout=%.1fs",
        STT_GPU_CONCURRENCY,
        STT_QUEUE_MAX_SIZE,
        STT_QUEUE_TIMEOUT,
    )


async def stop_stt_queue() -> None:
    global _queue, _executor
    for task in _workers:
        task.cancel()
    if _workers:
        await asyncio.gather(*_workers, return_exceptions=True)
    _workers.clear()

    if _executor is not None:
        _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None
    _queue = None
    logger.info("[STT Queue] stopped")


async def enqueue_stt(
    audio_bytes: bytes,
    suffix: str = ".webm",
    language: str = "zh",
    initial_prompt: Optional[str] = None,
) -> str:
    if not _is_started():
        await start_stt_queue()

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    job = STTJob(
        audio_bytes=audio_bytes,
        suffix=suffix,
        language=language,
        initial_prompt=initial_prompt,
        future=future,
        created_at=time.perf_counter(),
    )

    try:
        _queue.put_nowait(job)
    except asyncio.QueueFull:
        logger.warning("[STT Queue] rejected: queue full size=%d", _queue.qsize())
        raise HTTPException(status_code=429, detail="STT queue is full, please retry later")

    logger.info("[STT Queue] enqueued size=%d", _queue.qsize())

    try:
        return await asyncio.wait_for(future, timeout=STT_QUEUE_TIMEOUT)
    except asyncio.TimeoutError:
        if not future.done():
            future.cancel()
        logger.warning("[STT Queue] timeout after %.1fs", STT_QUEUE_TIMEOUT)
        raise HTTPException(status_code=504, detail="STT request timed out")


async def _stt_worker(worker_id: int) -> None:
    loop = asyncio.get_running_loop()
    logger.info("[STT Queue] worker-%d started", worker_id)
    while True:
        job = await _queue.get()
        wait_s = time.perf_counter() - job.created_at
        logger.info("[STT Queue] worker-%d processing wait=%.2fs remaining=%d", worker_id, wait_s, _queue.qsize())

        try:
            result = await loop.run_in_executor(
                _executor,
                transcribe,
                job.audio_bytes,
                job.suffix,
                job.language,
                job.initial_prompt,
            )
            if not job.future.done():
                job.future.set_result(result)
        except Exception as e:
            logger.exception("[STT Queue] worker-%d failed: %s", worker_id, e)
            if not job.future.done():
                job.future.set_exception(e)
        finally:
            _queue.task_done()
