#!/bin/sh
source ./venv/bin/activate
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
uvicorn main:app --host 0.0.0.0 --port 36100 &
echo $! > fastapi_app.pid
echo "CHATBOT Platform server started with PID $(cat fastapi_app.pid)"