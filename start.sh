#!/bin/bash

# Therafam Backend - Local Development Startup Script
# ====================================================

echo "🌱 Starting Therafam Backend..."
echo "================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
    echo ""
fi

# Activate virtual environment
echo "🔄 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "📝 Please create .env file from .env.example"
    echo ""
    echo "To create .env file:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your actual credentials"
    echo ""
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "🚀 Starting server..."
echo "================================"
echo ""
echo "📡 Server will be available at:"
echo "   - Local:   http://localhost:${PORT:-8000}"
echo "   - API Docs: http://localhost:${PORT:-8000}/api/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the application
python main.py
