@echo off
REM Therafam Backend - Local Development Startup Script (Windows)
REM ==============================================================

echo 🌱 Starting Therafam Backend...
echo ================================
echo.

REM Check if virtual environment exists
if not exist "venv\" (
    echo 📦 Creating virtual environment...
    python -m venv venv
    echo ✅ Virtual environment created
    echo.
)

REM Activate virtual environment
echo 🔄 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt
echo.

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found!
    echo 📝 Please create .env file from .env.example
    echo.
    echo To create .env file:
    echo   copy .env.example .env
    echo   REM Edit .env with your actual credentials
    echo.
    exit /b 1
)

echo 🚀 Starting server...
echo ================================
echo.
echo 📡 Server will be available at:
echo    - Local:   http://localhost:8000
echo    - API Docs: http://localhost:8000/api/docs
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the application
python main.py
