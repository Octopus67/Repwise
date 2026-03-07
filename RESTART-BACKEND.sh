#!/bin/bash
echo "Killing old backend..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1

echo "Deleting old database..."
rm -f dev.db

echo "Starting backend..."
cd /Users/manavmht/Documents/HOS
source .venv/bin/activate
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
