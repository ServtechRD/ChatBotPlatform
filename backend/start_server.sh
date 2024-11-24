#!/bin/sh

echo "Starting CHATBOT Platform server..."
uvicorn main:app --host 0.0.0.0 --port 36100 &
echo $! > fastapi_app.pid
echo "CHATBOT Platform server started with PID $(cat fastapi_app.pid)"