"""Pytest wrapper: 以子程序執行 FAISS 寫入鎖測試，避免 conftest stub 衝突。"""

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = BACKEND_ROOT / "load_tests" / "test_faiss_write_lock.py"


def test_faiss_write_lock_suite():
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = (result.stdout or "") + (result.stderr or "")
    assert result.returncode == 0, output
