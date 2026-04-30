# -*- coding: utf-8 -*-
"""
日誌模組：寫入 ./log/yyyyMMdd.log；單檔超過大小則 yyyyMMdd_01.log、_02…
僅保留修改時間最新的 MAX_LOG_FILES 個檔案。
"""
import logging
import os
import re
from datetime import datetime


LOG_DIR = "log"
LOG_DATE_FORMAT = "%Y%m%d"  # yyyyMMdd
MAX_LOG_BYTES = 20 * 1024 * 1024  # 20MB
MAX_LOG_FILES = 20

# 僅刪除此命名樣式的檔案，避免誤刪其他 .log
_LOG_NAME_RE = re.compile(r"^\d{8}(?:_\d+)?\.log$")


def _prune_log_files(log_dir: str, max_files: int = MAX_LOG_FILES) -> None:
    try:
        names = [f for f in os.listdir(log_dir) if _LOG_NAME_RE.match(f)]
    except OSError:
        return
    paths = [os.path.join(log_dir, n) for n in names]
    paths.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    for p in paths[max_files:]:
        try:
            os.remove(p)
        except OSError:
            pass


class DailySizeRotatingFileHandler(logging.Handler):
    """
    依日期命名檔案；同日寫滿 MAX_LOG_BYTES 則切到 yyyyMMdd_01.log、_02…
    跨日重設分段。寫入後必要時執行檔案保留清理。
    """

    def __init__(
        self,
        log_dir=LOG_DIR,
        date_fmt=LOG_DATE_FORMAT,
        max_bytes=MAX_LOG_BYTES,
        encoding="utf-8",
    ):
        super().__init__()
        self._log_dir = os.path.abspath(log_dir)
        self._date_fmt = date_fmt
        self._max_bytes = max_bytes
        self._encoding = encoding
        self._current_date = None
        self._segment = 0
        self._stream = None
        self._path = None

    def _ensure_dir(self):
        os.makedirs(self._log_dir, exist_ok=True)

    def _path_for(self, day, segment: int) -> str:
        base = day.strftime(self._date_fmt)
        if segment == 0:
            name = f"{base}.log"
        else:
            name = f"{base}_{segment:02d}.log"
        return os.path.join(self._log_dir, name)

    def _close_stream(self):
        if self._stream is not None:
            try:
                self._stream.close()
            finally:
                self._stream = None
        self._path = None

    def _open_stream(self, path: str):
        self._ensure_dir()
        self._path = path
        self._stream = open(path, "a", encoding=self._encoding)

    def _rollover_if_needed(self, msg: str) -> None:
        today = datetime.now().date()
        if self._current_date is not None and self._current_date != today:
            self._segment = 0
        self._current_date = today

        path = self._path_for(today, self._segment)
        extra = len(msg.encode(self._encoding, errors="replace"))
        need_new = self._stream is None
        if not need_new and self._path != path:
            need_new = True
        if not need_new and self._path and os.path.isfile(self._path):
            try:
                if os.path.getsize(self._path) + extra > self._max_bytes:
                    need_new = True
                    self._segment += 1
                    path = self._path_for(today, self._segment)
            except OSError:
                need_new = True

        if need_new:
            self._close_stream()
            self._open_stream(path)
            _prune_log_files(self._log_dir)

    def emit(self, record):
        try:
            msg = self.format(record) + "\n"
            self._rollover_if_needed(msg)
            self._stream.write(msg)
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self):
        self._close_stream()
        self._current_date = None
        self._segment = 0
        super().close()


def setup_logging(
    log_dir=LOG_DIR,
    level=logging.INFO,
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    date_fmt="%Y-%m-%d %H:%M:%S",
):
    """
    設定根 logger：輸出至 log 目錄（依日期與大小切檔），並保留 console 輸出。
    """
    root = logging.getLogger()
    root.setLevel(level)
    formatter = logging.Formatter(fmt, datefmt=date_fmt)

    file_handler = DailySizeRotatingFileHandler(
        log_dir=log_dir,
        date_fmt=LOG_DATE_FORMAT,
        max_bytes=MAX_LOG_BYTES,
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)
    _prune_log_files(os.path.abspath(log_dir))

    if not any(
        isinstance(h, logging.StreamHandler) and not isinstance(h, DailySizeRotatingFileHandler)
        for h in root.handlers
    ):
        console = logging.StreamHandler()
        console.setLevel(level)
        console.setFormatter(formatter)
        root.addHandler(console)

    return root


def get_logger(name: str) -> logging.Logger:
    """取得具名 logger，會繼承根 logger 的 file/console 設定。"""
    return logging.getLogger(name)
