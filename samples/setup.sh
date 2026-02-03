#!/bin/bash

# AssemblyAI SDK Samples Setup Script
# This script sets up your environment to run the AssemblyAI samples

echo "🚀 Setting up AssemblyAI SDK Samples..."
echo "========================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required!"
    echo "Current version: $(node -v)"
    echo "Please upgrade Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available!"
    echo "Please install npm or use a different package manager"
    exit 1
fi

echo "✅ npm detected"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    if [ -f "env.template" ]; then
        cp env.template .env
        echo "✅ .env file created!"
        echo "🔑 Please edit .env and add your AssemblyAI API key"
        echo "   Get your API key from: https://www.assemblyai.com/app/account"
    else
        echo "⚠️  env.template not found, creating basic .env file..."
        echo "ASSEMBLYAI_API_KEY=your_api_key_here" > .env
        echo "✅ Basic .env file created!"
        echo "🔑 Please edit .env and add your AssemblyAI API key"
    fi
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install assemblyai dotenv

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if TypeScript is available for running .ts files
if ! command -v npx &> /dev/null; then
    echo "⚠️  npx not available, installing tsx globally..."
    npm install -g tsx
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file and add your AssemblyAI API key"
echo "2. Run any sample:"
echo "   - TypeScript: npx tsx basic-transcription.ts"
echo "   - JavaScript: node basic-transcription.js"
echo ""
echo "🔑 Get your API key from: https://www.assemblyai.com/app/account"
echo ""
echo "📚 Available samples:"
echo "   - basic-transcription.ts/js - Basic audio transcription"
echo "   - streaming-realtime.ts - Real-time streaming"
echo "   - lemur-analysis.ts - AI-powered analysis"
echo "   - speaker-diarization.ts - Speaker identification"
echo ""
echo "Happy coding! 🚀"
