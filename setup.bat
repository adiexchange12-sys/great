@echo off
echo ========================================
echo Live Chat Platform - Setup Script
echo ========================================
echo.

echo Checking prerequisites...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

echo Prerequisites check passed!
echo.

echo Setting up environment variables...
if not exist backend\.env (
    copy backend\.env.example backend\.env
    echo Created backend\.env file
) else (
    echo backend\.env already exists
)

echo.
echo Building and starting services...
echo This may take a few minutes on first run...
echo.

docker-compose up -d --build

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Services are starting...
echo.
echo Frontend:  http://localhost
echo Admin:     http://localhost:5174
echo Backend:   http://localhost:3001
echo.
echo Default admin credentials:
echo Email:    admin@livechat.com
echo Password: admin123
echo.
echo To view logs:
echo   docker-compose logs -f
echo.
echo To stop services:
echo   docker-compose down
echo.
pause
