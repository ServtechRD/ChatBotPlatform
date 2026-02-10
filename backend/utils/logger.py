# -*- coding: utf-8 -*-
"""
日誌模組：將 log 寫入 ./log/yyyyMMdd.log，依日期分檔。
"""
import logging
import os
from datetime import datetime


LOG_DIR = "log"
LOG_DATE_FORMAT = "%Y%m%d"  # yyyyMMdd


class DailyFileHandler(logging.Handler):
    """依當日日期寫入 log/yyyyMMdd.log，跨日自動切換檔案。"""

    def __init__(self, log_dir=LOG_DIR, date_fmt=LOG_DATE_FORMAT, encoding="utf-8"):
        super().__init__()
        self._log_dir = os.path.abspath(log_dir)
        self._date_fmt = date_fmt
        self._encoding = encoding
        self._current_date = None
        self._stream = None

    def _ensure_dir(self):
        os.makedirs(self._log_dir, exist_ok=True)

    def _get_today_path(self):
        return os.path.join(
            self._log_dir,
            datetime.now().strftime(self._date_fmt) + ".log"
        )

    def _open_stream(self):
        self._ensure_dir()
        path = self._get_today_path()
        self._current_date = datetime.now().date()
        self._stream = open(path, "a", encoding=self._encoding)

    def emit(self, record):
        try:
            today = datetime.now().date()
            if self._stream is None or self._current_date != today:
                if self._stream is not None:
                    self._stream.close()
                    self._stream = None
                self._open_stream()
            msg = self.format(record)
            self._stream.write(msg + "\n")
            self._stream.flush()
        except Exception:
            self.handleError(record)

    def close(self):
        if self._stream is not None:
            try:
                self._stream.close()
            finally:
                self._stream = None
        super().close()


def setup_logging(
    log_dir=LOG_DIR,
    level=logging.INFO,
    fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    date_fmt="%Y-%m-%d %H:%M:%S",
):
    """
    設定根 logger：輸出至 ./log/yyyyMMdd.log，並保留 console 輸出。
    """
    root = logging.getLogger()
    root.setLevel(level)
    formatter = logging.Formatter(fmt, datefmt=date_fmt)

    # 每日檔案
    file_handler = DailyFileHandler(log_dir=log_dir, date_fmt=LOG_DATE_FORMAT)
    file_handler.setLevel(level)
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    # 同時輸出到 console（可選）
    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, DailyFileHandler) for h in root.handlers):
        console = logging.StreamHandler()
        console.setLevel(level)
        console.setFormatter(formatter)
        root.addHandler(console)

    return root


def get_logger(name: str) -> logging.Logger:
    """取得具名 logger，會繼承根 logger 的 file/console 設定。"""
    return logging.getLogger(name)
