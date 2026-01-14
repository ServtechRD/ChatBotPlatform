#!/bin/bash

echo "Stopping CHATBOT Platform server (Backend & Frontend)..."

pkill -f "uvicorn main:app"
pkill -f "react-scripts"

# 清理舊的 PID 檔案 (如果有剩的話)
if [ -f fastapi_app.pid ]; then
  rm fastapi_app.pid
fi

echo "✅ All services stopped successfully."