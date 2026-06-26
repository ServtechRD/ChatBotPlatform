"""
驗證 vector_service 的 FAISS 寫入鎖（asyncio + 磁碟 filelock）。

執行：
    cd backend
    python load_tests/test_faiss_write_lock.py
"""
from __future__ import annotations

import asyncio
import importlib.util
import os
import sys
import time
import types
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault("DATABASE_URL", "sqlite://")


def _install_import_stubs() -> None:
    heavy_roots = (
        "langchain_community",
        "langchain_core",
        "langchain_text_splitters",
        "transformers",
        "faiss",
        "rake_nltk",
        "tiktoken",
        "langid",
    )
    for name in heavy_roots:
        sys.modules.setdefault(name, MagicMock())

    class _FakeFileLock:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    filelock_mod = types.ModuleType("filelock")
    filelock_mod.FileLock = _FakeFileLock
    sys.modules.setdefault("filelock", filelock_mod)

    for sub in (
        "langchain_community.embeddings",
        "langchain_community.vectorstores",
        "langchain_community.document_loaders",
        "langchain_community.chat_models",
        "langchain_core.documents",
        "langchain_core.messages",
    ):
        sys.modules.setdefault(sub, MagicMock())

    transformers = sys.modules["transformers"]
    transformers.pipeline = MagicMock(return_value=MagicMock())


def _load_vector_service_module():
    _install_import_stubs()
    path = BACKEND_ROOT / "services" / "vector_service.py"
    spec = importlib.util.spec_from_file_location("services.vector_service", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["services.vector_service"] = module
    spec.loader.exec_module(module)
    return module


vs = _load_vector_service_module()


def _assert_serial_order(order: list[str], label: str) -> None:
    if len(order) != 4:
        raise AssertionError(f"[{label}] 預期 4 筆事件，實際 {order}")
    for i in range(0, 4, 2):
        enter, exit_ = order[i], order[i + 1]
        if not enter.endswith("_enter") or not exit_.endswith("_exit"):
            raise AssertionError(f"[{label}] enter/exit 交錯: {order}")
        if enter.split("_")[0] != exit_.split("_")[0]:
            raise AssertionError(f"[{label}] 同 task 不成對: {order}")


def test_normalize_assistant_id() -> None:
    assert vs.normalize_assistant_id(1) == 1
    assert vs.normalize_assistant_id("1") == 1
    print("PASS: assistant_id 正規化")


def test_lock_singleton_per_assistant() -> None:
    aid = 900004
    lock_a = vs._get_assistant_vector_write_lock(aid)
    lock_b = vs._get_assistant_vector_write_lock(str(aid))
    if lock_a is not lock_b:
        raise AssertionError("同一 assistant 應共用同一 asyncio.Lock")
    if not isinstance(lock_a, asyncio.Lock):
        raise AssertionError("寫入鎖應為 asyncio.Lock")
    print("PASS: 同一 assistant_id 共用 asyncio.Lock")


async def _test_same_assistant_id_serializes_async() -> None:
    aid = 900001
    order: list[str] = []
    order_lock = asyncio.Lock()
    barrier = asyncio.Barrier(2)

    async def worker(name: str) -> None:
        await barrier.wait()
        async with vs.assistant_vector_write_lock(aid):
            async with order_lock:
                order.append(f"{name}_enter")
            await asyncio.sleep(0.15)
            async with order_lock:
                order.append(f"{name}_exit")

    await asyncio.gather(worker("A"), worker("B"))
    _assert_serial_order(order, "same_assistant")
    print("PASS: same assistant_id 寫入互斥（asyncio，await 期間不阻塞 event loop）")


async def _test_different_assistant_ids_can_overlap_async() -> None:
    events: list[tuple[float, str]] = []
    events_lock = asyncio.Lock()
    barrier = asyncio.Barrier(2)

    async def worker(aid: int, name: str) -> None:
        await barrier.wait()
        async with vs.assistant_vector_write_lock(aid):
            async with events_lock:
                events.append((time.perf_counter(), f"{name}_enter"))
            await asyncio.sleep(0.2)
            async with events_lock:
                events.append((time.perf_counter(), f"{name}_exit"))

    await asyncio.gather(worker(900002, "X"), worker(900003, "Y"))
    enter_times = [t for t, ev in events if ev.endswith("_enter")]
    if len(enter_times) != 2:
        raise AssertionError(f"預期 2 次 enter: {events}")
    if abs(enter_times[0] - enter_times[1]) > 0.1:
        raise AssertionError(f"不同 assistant 未並行: {events}")
    print("PASS: 不同 assistant_id 可並行")


async def _test_no_deadlock_while_awaiting_inside_lock() -> None:
    """模擬上傳路徑：持鎖期間 await，第二個請求應等待而非死鎖。"""
    aid = 900006
    done: list[str] = []

    async def first() -> None:
        async with vs.assistant_vector_write_lock(aid):
            await asyncio.sleep(0.1)
            done.append("first")

    async def second() -> None:
        await asyncio.sleep(0.02)
        async with vs.assistant_vector_write_lock(aid):
            done.append("second")

    await asyncio.wait_for(asyncio.gather(first(), second()), timeout=3.0)
    if done != ["first", "second"]:
        raise AssertionError(f"預期順序 ['first', 'second']，實際 {done}")
    print("PASS: 持鎖 await 不造成 event loop 死鎖")


def test_faiss_disk_lock_exists() -> None:
    if not hasattr(vs, "faiss_disk_lock"):
        raise AssertionError("缺少 faiss_disk_lock")
    print("PASS: faiss_disk_lock 已實作")


def main() -> None:
    test_normalize_assistant_id()
    test_lock_singleton_per_assistant()
    test_faiss_disk_lock_exists()
    asyncio.run(_test_same_assistant_id_serializes_async())
    asyncio.run(_test_different_assistant_ids_can_overlap_async())
    asyncio.run(_test_no_deadlock_while_awaiting_inside_lock())
    print("\n全部 FAISS 寫入鎖測試通過")


if __name__ == "__main__":
    main()
