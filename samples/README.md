# AssemblyAI SDK Samples

This directory contains ready-to-run samples for the AssemblyAI JavaScript SDK. Each sample is designed to work immediately with minimal setup.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install assemblyai
   # or
   yarn add assemblyai
   # or
   pnpm add assemblyai
   ```

2. **Set your API key:**
   ```bash
   export ASSEMBLYAI_API_KEY="your_api_key_here"
   # or create a .env file
   ```

3. **Run any sample:**
   ```bash
   # For TypeScript samples
   npx tsx samples/basic-transcription.ts
   
   # For JavaScript samples
   node samples/basic-transcription.js
   ```

## 📁 Sample Categories

### 🔤 Basic Transcription
- **`basic-transcription.ts`** - Simple audio transcription
- **`basic-transcription.js`** - JavaScript version
- **`basic-transcription.ipynb`** - Jupyter notebook version

### 🎤 Real-time Streaming
- **`streaming-realtime.ts`** - Live audio streaming
- **`streaming-realtime.js`** - JavaScript version

### 👥 Speaker Diarization
- **`speaker-diarization.ts`** - Identify who said what
- **`speaker-diarization.js`** - JavaScript version

### 🤖 LeMUR AI Analysis
- **`lemur-analysis.ts`** - AI-powered audio insights
- **`lemur-analysis.js`** - JavaScript version

### 📁 File Management
- **`file-upload.ts`** - Upload and manage audio files
- **`file-upload.js`** - JavaScript version

### 🎯 Advanced Features
- **`custom-options.ts`** - Advanced transcription options
- **`custom-options.js`** - JavaScript version

## 🛠️ Setup Scripts

- **`setup.sh`** - Unix/macOS setup script
- **`setup.bat`** - Windows setup script
- **`.env.example`** - Environment variables template

## 📊 Notebook Experience

For Jupyter notebook users, we provide `.ipynb` files that you can:
1. Open in Google Colab
2. Run locally with Jupyter
3. Import into VS Code notebooks

## 🔧 Requirements

- Node.js 18+ 
- AssemblyAI API key
- Internet connection for API calls

## 📝 Notes

- All samples use environment variables for API keys
- Sample audio URLs are provided for testing
- Error handling is included in all examples
- TypeScript samples include full type annotations
