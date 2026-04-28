#!/bin/sh

set -e

# 確保在 backend 目錄執行，避免找不到 requirements.txt/init_nltk.py
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f "./venv/bin/activate" ]; then
    echo "venv not found, creating ./venv ..."
    python3 -m venv venv || echo "Warning: failed to create venv, will use system python."
fi
if [ -f "./venv/bin/activate" ]; then
    . ./venv/bin/activate
else
    echo "venv not available, using system python."
fi
pip install --upgrade pip
pip install -r requirements.txt
python3 init_nltk.py
export NLTK_DATA=/home/chatbot_platform/nltk_data

# ==========================================
# [新增] 自動修復：將 embed.js 複製到後端 public 資料夾
# ==========================================
echo "Copying embed.js to backend public folder..."

# 1. 確保當前目錄 (backend) 下有 public 資料夾
mkdir -p public

# 2. 從前端目錄複製 embed.js 
cp /home/chatbot_platform/frontend/chatbot_ui/public/embed.js ./public/

if [ $? -eq 0 ]; then
    echo "embed.js copied successfully."
else
    echo "Warning: Failed to copy embed.js. Please check the path."
fi
# ==========================================

echo "Starting CHATBOT Platform server..."
python3 -m uvicorn main:app --host 0.0.0.0 --port 3100 &
echo $! > fastapi_app.pid
echo "CHATBOT Platform server started with PID $(cat fastapi_app.pid)"