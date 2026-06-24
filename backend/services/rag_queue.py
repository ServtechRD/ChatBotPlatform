import asyncio
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import HTTPException

from utils.logger import get_logger

logger = get_logger(__name__)

RAG_GPU_CONCURRENCY = int(os.getenv("RAG_GPU_CONCURRENCY", "5"))
RAG_QUEUE_MAX_SIZE = int(os.getenv("RAG_QUEUE_MAX_SIZE", "10"))
RAG_QUEUE_TIMEOUT = float(os.getenv("RAG_QUEUE_TIMEOUT", "300"))


@dataclass
class RAGJob:
    fn: Any
    args: tuple
    future: asyncio.Future
    created_at: float = field(default_factory=time.perf_counter)


_queue: Optional[asyncio.Queue] = None
_workers: list[asyncio.Task] = []
_executor: Optional[ThreadPoolExecutor] = None


def _is_started() -> bool:
    return _queue is not None and _executor is not None and any(not t.done() for t in _workers)


async def start_rag_queue() -> None:
    global _queue, _executor
    if _is_started():
        return
    _queue = asyncio.Queue(maxsize=RAG_QUEUE_MAX_SIZE)
    _executor = ThreadPoolExecutor(max_workers=RAG_GPU_CONCURRENCY, thread_name_prefix="rag-gpu")
    _workers.clear()
    for i in range(RAG_GPU_CONCURRENCY):
        _workers.append(asyncio.create_task(_rag_worker(i + 1)))
    logger.info(
        "[RAG Queue] started concurrency=%d max_size=%d timeout=%.1fs",
        RAG_GPU_CONCURRENCY, RAG_QUEUE_MAX_SIZE, RAG_QUEUE_TIMEOUT,
    )


async def stop_rag_queue() -> None:
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
    logger.info("[RAG Queue] stopped")


async def enqueue_rag(fn, *args):
    if not _is_started():
        await start_rag_queue()

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    job = RAGJob(fn=fn, args=args, future=future)

    try:
        _queue.put_nowait(job)
    except asyncio.QueueFull:
        logger.warning("[RAG Queue] rejected: queue full size=%d", _queue.qsize())
        raise HTTPException(status_code=429, detail="RAG upload queue is full, please retry later")

    logger.info("[RAG Queue] enqueued size=%d", _queue.qsize())

    try:
        return await asyncio.wait_for(future, timeout=RAG_QUEUE_TIMEOUT)
    except asyncio.TimeoutError:
        if not future.done():
            future.cancel()
        logger.warning("[RAG Queue] timeout after %.1fs", RAG_QUEUE_TIMEOUT)
        raise HTTPException(status_code=504, detail="RAG upload timed out")


async def _rag_worker(worker_id: int) -> None:
    loop = asyncio.get_running_loop()
    logger.info("[RAG Queue] worker-%d started", worker_id)
    while True:
        job = await _queue.get()
        wait_s = time.perf_counter() - job.created_at
        logger.info(
            "[RAG Queue] worker-%d processing wait=%.2fs remaining=%d",
            worker_id, wait_s, _queue.qsize(),
        )
        try:
            result = await loop.run_in_executor(_executor, job.fn, *job.args)
            if not job.future.done():
                job.future.set_result(result)
        except Exception as e:
            logger.exception("[RAG Queue] worker-%d failed: %s", worker_id, e)
            if not job.future.done():
                job.future.set_exception(e)
        finally:
            _queue.task_done()
