@echo off
echo =====================================================
echo  MedAI Verifier - Start System
echo =====================================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

REM Setup backend if first time
if not exist "backend\.env" (
    echo [Setup] Creating backend .env file...
    copy "backend\.env.example" "backend\.env"
    echo [Setup] Please edit backend\.env and add your GEMINI_API_KEY
    echo.
)

REM Install Python packages if needed
if not exist "backend\__pycache__" (
    echo [Setup] Installing Python dependencies...
    pip install -r backend\requirements.txt
)

REM Start backend
echo [1/2] Starting Flask backend at http://localhost:5000 ...
start "MedAI Backend" cmd /c "cd backend && python app.py"

REM Start frontend
echo [2/2] Starting React frontend at http://localhost:8080 ...
start "MedAI Frontend" cmd /c "cd med-match-checker-main && npm install && npm run dev"

echo.
echo =====================================================
echo  System is starting...
echo  Backend : http://localhost:5000
echo  Frontend: http://localhost:8080
echo =====================================================
echo  Press any key to stop...
pause >nul
