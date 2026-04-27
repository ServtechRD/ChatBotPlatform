#!/bin/bash

service mariadb start

echo "wait 5 sec"
sleep 5

cd /home/chatbot_platform/backend/


./start_server.sh &

echo "wait 6 sec"
sleep 6

cd /home/chatbot_platform/frontend/chatbot_ui/
npm install cross-env
HOST=0.0.0.0 PORT=3000 npm start &
