#!/bin/bash

service mariadb start

echo "wait 5 sec"
sleep 5

cd /home/chatbot_platform/backend/
source ./venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python3 init_nltk.py
export NLTK_DATA=/home/chatbot_platform/nltk_data

./start_server.sh &

echo "wait 6 sec"
sleep 6

cd /home/chatbot_platform/frontend/chatbot_ui/
npm install cross-env
npm start &
