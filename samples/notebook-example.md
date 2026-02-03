# 📓 Jupyter Notebook Experience

This file shows you how to use AssemblyAI with Jupyter notebooks, Google Colab, or VS Code notebooks.

## 🚀 Quick Setup for Notebooks

### 1. Install Dependencies
```bash
!npm install assemblyai dotenv
```

### 2. Set API Key
```python
import os
os.environ['ASSEMBLYAI_API_KEY'] = 'your_api_key_here'
```

### 3. Import and Initialize
```python
from assemblyai import AssemblyAI

client = AssemblyAI({
    'apiKey': os.environ['ASSEMBLYAI_API_KEY']
})
```

### 4. Run Transcription
```python
transcript = await client.transcripts.transcribe({
    'audio': 'https://storage.googleapis.com/aai-web-samples/5_audio_demos/02_meeting_audio_16k.wav',
    'speaker_labels': True,
    'auto_highlights': True,
    'sentiment_analysis': True,
    'auto_chapters': True,
})
```

## 📱 Google Colab Ready

Copy and paste this into a Google Colab cell:

```python
# Install AssemblyAI SDK
!npm install assemblyai dotenv

# Set your API key
import os
os.environ['ASSEMBLYAI_API_KEY'] = 'your_api_key_here'

# Import and use
from assemblyai import AssemblyAI
client = AssemblyAI({'apiKey': os.environ['ASSEMBLYAI_API_KEY']})

# Transcribe audio
transcript = await client.transcripts.transcribe({
    'audio': 'https://storage.googleapis.com/aai-web-samples/5_audio_demos/02_meeting_audio_16k.wav',
    'speaker_labels': True,
})

print(transcript.text)
```

## 🎯 Sample Audio Files

Use these sample URLs for testing:
- **Meeting**: `https://storage.googleapis.com/aai-web-samples/5_audio_demos/02_meeting_audio_16k.wav`
- **Interview**: `https://storage.googleapis.com/aai-web-samples/5_audio_demos/01_interview_audio_16k.wav`
- **Presentation**: `https://storage.googleapis.com/aai-web-samples/5_audio_demos/03_presentation_audio_16k.wav`

## 📚 Full Notebook Examples

For complete notebook examples, see:
- `basic-transcription.ipynb` - Full transcription workflow
- `speaker-diarization.ipynb` - Speaker identification
- `lemur-analysis.ipynb` - AI-powered insights

## 💡 Tips for Notebooks

1. **Use `await`** for async operations
2. **Check status** before accessing results
3. **Handle errors** gracefully
4. **Use progress indicators** for long operations
5. **Save results** to variables for reuse

## 🔧 Troubleshooting

- **Import errors**: Make sure you've run the install cell
- **API key issues**: Check your environment variable
- **Network errors**: Verify internet connection
- **Rate limits**: Wait between requests
