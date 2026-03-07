#!/bin/bash
set -e

echo "=== COMPLETE BACKEND FIX ==="
echo ""

cd /Users/manavmht/Documents/HOS

# 1. Check .env exists
if [ ! -f .env ]; then
    echo "❌ .env file missing!"
    exit 1
fi
echo "✅ .env file exists"

# 2. Export environment variables from .env
export $(cat .env | grep -v '^#' | xargs)
echo "✅ Environment variables loaded"

# 3. Activate venv
source .venv/bin/activate
echo "✅ Virtual environment activated (Python $(python --version))"

# 4. Install dependencies
pip install -q aiosqlite python-multipart python-dotenv bcrypt
echo "✅ Dependencies installed"

# 5. Delete old database
rm -f dev.db
echo "✅ Old database deleted"

# 6. Test imports
python -c "from src.main import app" 2>&1 | head -5
if [ $? -eq 0 ]; then
    echo "✅ Backend imports successfully"
else
    echo "❌ Import failed"
    exit 1
fi

# 7. Kill old processes
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
sleep 2
echo "✅ Old processes killed"

# 8. Start backend
echo ""
echo "Starting backend on http://localhost:8000..."
echo "AWS credentials loaded: AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:0:10}..."
echo "SES sender: $SES_SENDER_EMAIL"
echo ""
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
