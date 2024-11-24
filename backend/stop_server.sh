#!/bin/bash

if [ -f fastapi_app.pid ]; then
  echo "Stopping CHATBOT Platform server..."
  kill -9 $(cat fastapi_app.pid) && rm fastapi_app.pid
  echo "CHATBOT Platform server stopped."
else
  echo "No PID file found. Is the server running?"
fi