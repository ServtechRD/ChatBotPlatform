#!/bin/sh
source ./venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
python3 init_nltk.py
export NLTK_DATA=/home/chatbot_platform/nltk_data

echo "Starting CHATBOT Platform server..."
uvicorn main:app --host 0.0.0.0 --port 36100 &
echo $! > fastapi_app.pid
echo "CHATBOT Platform server started with PID $(cat fastapi_app.pid)"