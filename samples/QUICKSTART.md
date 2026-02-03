# 🚀 Quick Start Guide

Get up and running with AssemblyAI samples in under 5 minutes!

## ⚡ Super Quick Start (3 commands)

```bash
# 1. Navigate to samples directory
cd samples

# 2. Run setup script
./setup.sh          # On macOS/Linux
# OR
setup.bat           # On Windows

# 3. Run your first sample
npm run transcribe
```

## 🔧 Manual Setup

### Prerequisites
- Node.js 18+ installed
- AssemblyAI API key

### Step 1: Install Dependencies
```bash
cd samples
npm install
```

### Step 2: Configure API Key
```bash
# Copy environment template
cp env.template .env

# Edit .env file and add your API key
# ASSEMBLYAI_API_KEY=your_actual_api_key_here
```

### Step 3: Run Samples
```bash
# Basic transcription
npm run transcribe

# Real-time streaming
npm run streaming

# AI analysis with LeMUR
npm run lemur

# Speaker diarization
npm run speaker
```

## 🎯 What You'll Get

Each sample demonstrates different AssemblyAI capabilities:

- **📝 Basic Transcription**: Convert audio to text with AI insights
- **🎤 Real-time Streaming**: Live transcription as you speak
- **🤖 LeMUR Analysis**: AI-powered content analysis and Q&A
- **👥 Speaker Diarization**: Identify who said what

## 📱 Notebook Experience

For Jupyter/Colab users:

```python
# Install SDK
!npm install assemblyai dotenv

# Set API key
import os
os.environ['ASSEMBLYAI_API_KEY'] = 'your_api_key_here'

# Use the SDK
from assemblyai import AssemblyAI
client = AssemblyAI({'apiKey': os.environ['ASSEMBLYAI_API_KEY']})
```

## 🆘 Need Help?

- **API Key**: Get it from [AssemblyAI Dashboard](https://www.assemblyai.com/app/account)
- **Documentation**: [AssemblyAI Docs](https://www.assemblyai.com/docs)
- **Issues**: [GitHub Issues](https://github.com/AssemblyAI/assemblyai-node-sdk/issues)

## 🎉 You're Ready!

Run any sample and start building amazing audio AI applications! 🚀
