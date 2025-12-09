@echo off
REM AssemblyAI SDK Samples Setup Script for Windows
REM This script sets up your environment to run the AssemblyAI samples

echo 🚀 Setting up AssemblyAI SDK Samples...
echo ========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo Please install Node.js 18+ from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% lss 18 (
    echo ❌ Node.js version 18+ is required!
    echo Current version: 
    node --version
    echo Please upgrade Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected
node --version

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available!
    echo Please install npm or use a different package manager
    pause
    exit /b 1
)

echo ✅ npm detected

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file from template...
    if exist "env.template" (
        copy env.template .env >nul
        echo ✅ .env file created!
        echo 🔑 Please edit .env and add your AssemblyAI API key
        echo    Get your API key from: https://www.assemblyai.com/app/account
    ) else (
        echo ⚠️  env.template not found, creating basic .env file...
        echo ASSEMBLYAI_API_KEY=your_api_key_here > .env
        echo ✅ Basic .env file created!
        echo 🔑 Please edit .env and add your AssemblyAI API key
    )
) else (
    echo ✅ .env file already exists
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install assemblyai dotenv

if %errorlevel% equ 0 (
    echo ✅ Dependencies installed successfully!
) else (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Check if npx is available for running .ts files
npx --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  npx not available, installing tsx globally...
    npm install -g tsx
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Edit .env file and add your AssemblyAI API key
echo 2. Run any sample:
echo    - TypeScript: npx tsx basic-transcription.ts
echo    - JavaScript: node basic-transcription.js
echo.
echo 🔑 Get your API key from: https://www.assemblyai.com/app/account
echo.
echo 📚 Available samples:
echo    - basic-transcription.ts/js - Basic audio transcription
echo    - streaming-realtime.ts - Real-time streaming
echo    - lemur-analysis.ts - AI-powered analysis
echo    - speaker-diarization.ts - Speaker identification
echo.
echo Happy coding! 🚀
pause
