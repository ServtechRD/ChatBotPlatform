#!/bin/bash
set -e

echo "wait 5 sec"
sleep 5

cd /home/chatbot_platform/backend/ || exit 1


./start_server.sh &
BACKEND_PID=$!

echo "wait 6 sec"
sleep 6

cd /home/chatbot_platform/frontend/chatbot_ui/ || exit 1
npm install serve
if [ ! -f build/index.html ]; then
  npm run build
fi
npm run serve:prod &
FRONTEND_PID=$!

echo "backend pid: ${BACKEND_PID}, frontend pid: ${FRONTEND_PID}"

# 保持容器前景運行，避免腳本結束導致容器被 restart policy 重啟
wait ${FRONTEND_PID}
