# 壓測與 FAISS 鎖測試

本目錄包含本機壓測腳本，不屬於正式 API 或 pytest 單元測試套件。

## 檔案

| 檔案 | 說明 |
|------|------|
| `load_test_server.py` | 輕量壓測用 API（假 embedding，真實上傳 + FAISS 鎖） |
| `load_test_upload.py` | 30 人併發 HTTP 上傳壓測客戶端 |
| `test_faiss_write_lock.py` | FAISS 寫入鎖單元驗證 |

## 快速開始

```bash
cd backend

# 1. 啟動壓測伺服器（預設 port 3200）
python load_tests/load_test_server.py

# 2. 同一 assistant，30 併發
python load_tests/load_test_upload.py \
  --base-url http://127.0.0.1:3200 \
  --email loadtest@local \
  --password loadtest123 \
  --assistant-id 1 \
  --workers 30

# 3. 不同 assistant，30 併發
python load_tests/load_test_upload.py \
  --base-url http://127.0.0.1:3200 \
  --email loadtest@local \
  --password loadtest123 \
  --prepare-assistants 30 \
  --workers 30
```

對正式後端壓測時，將 `--base-url` 改為 `http://127.0.0.1:3100` 並使用實際帳號。

## pytest

```bash
python -m pytest tests/test_vector_write_lock.py -v
```
