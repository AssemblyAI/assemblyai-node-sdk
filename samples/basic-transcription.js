#!/usr/bin/env node

/**
 * Basic Transcription Sample (JavaScript Version)
 * 
 * This sample demonstrates how to transcribe an audio file using AssemblyAI.
 * It's ready to run with minimal setup - just add your API key!
 * 
 * Features:
 * - Environment variable support
 * - Error handling
 * - Progress updates
 * - Sample audio URL
 * - Ready to run from terminal
 * - No TypeScript compilation needed
 */

const { AssemblyAI } = require("assemblyai");
const { config } = require("dotenv");
const path = require("path");

// Load environment variables from .env file
config({ path: path.join(__dirname, ".env") });

// Get API key from environment or prompt user
function getApiKey() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  
  if (!apiKey || apiKey === "your_api_key_here") {
    console.error("❌ API key not found!");
    console.log("\nTo fix this:");
    console.log("1. Copy samples/env.template to samples/.env");
    console.log("2. Add your API key to the .env file");
    console.log("3. Get your API key from: https://www.assemblyai.com/app/account");
    console.log("\nOr set the environment variable:");
    console.log("export ASSEMBLYAI_API_KEY='your_api_key_here'");
    process.exit(1);
  }
  
  return apiKey;
}

async function transcribeAudio() {
  try {
    console.log("🚀 Starting AssemblyAI transcription...\n");
    
    // Initialize client
    const client = new AssemblyAI({
      apiKey: getApiKey(),
    });
    
    // Sample audio URL (you can replace this with your own)
    const audioUrl = "https://storage.googleapis.com/aai-web-samples/5_audio_demos/02_meeting_audio_16k.wav";
    
    console.log("📁 Audio file:", audioUrl);
    console.log("⏳ Transcribing... (this may take a few minutes)\n");
    
    // Transcribe the audio
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      // Enable additional AI models for better insights
      speaker_labels: true,        // Identify who said what
      auto_highlights: true,       // Extract key topics
      sentiment_analysis: true,    // Analyze emotional tone
      auto_chapters: true,         // Organize content into chapters
    });
    
    console.log("✅ Transcription completed!");
    console.log("📝 Transcript ID:", transcript.id);
    console.log("📊 Status:", transcript.status);
    console.log("⏱️  Duration:", transcript.audio_duration_sec, "seconds");
    
    if (transcript.status === "completed") {
      console.log("\n📖 Full Transcript:");
      console.log("=" .repeat(50));
      console.log(transcript.text);
      console.log("=" .repeat(50));
      
      // Show speaker diarization if available
      if (transcript.utterances && transcript.utterances.length > 0) {
        console.log("\n👥 Speaker Breakdown:");
        transcript.utterances.forEach((utterance, index) => {
          console.log(`Speaker ${utterance.speaker}: ${utterance.text}`);
        });
      }
      
      // Show highlights if available
      if (transcript.auto_highlights_result && transcript.auto_highlights_result.status === "ok") {
        console.log("\n🎯 Key Highlights:");
        transcript.auto_highlights_result.results.forEach((highlight, index) => {
          console.log(`${index + 1}. ${highlight.text} (Score: ${highlight.rank})`);
        });
      }
      
      // Show chapters if available
      if (transcript.chapters && transcript.chapters.length > 0) {
        console.log("\n📚 Content Chapters:");
        transcript.chapters.forEach((chapter, index) => {
          console.log(`${index + 1}. ${chapter.headline} (${chapter.start} - ${chapter.end})`);
        });
      }
      
      // Show sentiment if available
      if (transcript.sentiment_analysis_result && transcript.sentiment_analysis_result.status === "ok") {
        console.log("\n😊 Sentiment Analysis:");
        transcript.sentiment_analysis_result.results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.text}: ${result.sentiment} (Confidence: ${result.confidence})`);
        });
      }
    }
    
  } catch (error) {
    console.error("❌ Error during transcription:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.log("\n💡 This looks like an authentication error. Check your API key!");
      } else if (error.message.includes("429")) {
        console.log("\n💡 Rate limit exceeded. Wait a moment and try again.");
      } else if (error.message.includes("400")) {
        console.log("\n💡 Bad request. Check your audio file URL.");
      }
    }
    
    process.exit(1);
  }
}

// Run the transcription
if (require.main === module) {
  transcribeAudio();
}

module.exports = { transcribeAudio };
