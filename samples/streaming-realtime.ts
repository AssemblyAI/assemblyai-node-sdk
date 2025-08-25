#!/usr/bin/env node

/**
 * Real-time Streaming Transcription Sample
 * 
 * This sample demonstrates how to use AssemblyAI's real-time streaming transcription.
 * It's ready to run with minimal setup - just add your API key!
 * 
 * Features:
 * - Real-time audio streaming
 * - Live transcription updates
 * - WebSocket connection management
 * - Error handling
 * - Ready to run from terminal
 * 
 * Note: This example uses a simulated audio stream for demonstration.
 * In real applications, you'd connect to a microphone or audio source.
 */

import { AssemblyAI } from "assemblyai";
import { config } from "dotenv";
import path from "path";

// Load environment variables from .env file
config({ path: path.join(__dirname, ".env") });

// Get API key from environment or prompt user
function getApiKey(): string {
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

// Simulate audio data for demonstration
function generateSimulatedAudioChunks(): Buffer[] {
  // This is just for demonstration - in real apps, you'd get audio from microphone
  const chunks: Buffer[] = [];
  
  // Generate some dummy audio data (16-bit PCM, 16kHz sample rate)
  for (let i = 0; i < 10; i++) {
    const chunk = Buffer.alloc(1024); // 1KB chunks
    // Fill with some dummy data
    for (let j = 0; j < chunk.length; j += 2) {
      chunk.writeInt16LE(Math.floor(Math.random() * 32767), j);
    }
    chunks.push(chunk);
  }
  
  return chunks;
}

async function startRealTimeTranscription() {
  try {
    console.log("🚀 Starting AssemblyAI Real-time Streaming Transcription...\n");
    
    // Initialize client
    const client = new AssemblyAI({
      apiKey: getApiKey(),
    });
    
    console.log("🔑 API key loaded successfully");
    console.log("🌐 Connecting to streaming service...\n");
    
    // Create streaming transcriber
    const transcriber = client.streaming.transcriber({
      sampleRate: 16000, // 16kHz sample rate
      // Enable additional features
      speakerLabels: true,
      languageCode: "en",
    });
    
    // Set up event handlers
    transcriber.on("open", ({ id, expires_at }) => {
      console.log("✅ Connection opened!");
      console.log("🆔 Session ID:", id);
      console.log("⏰ Expires at:", new Date(expires_at).toLocaleString());
      console.log("\n🎵 Starting audio stream...\n");
    });
    
    transcriber.on("turn", ({ transcript }) => {
      if (transcript.text) {
        console.log("📝 Live Transcript:", transcript.text);
      }
    });
    
    transcriber.on("close", (code, reason) => {
      console.log("\n🔒 Connection closed");
      console.log("📊 Code:", code);
      console.log("💬 Reason:", reason);
    });
    
    transcriber.on("error", (error) => {
      console.error("❌ Streaming error:", error);
    });
    
    // Connect to the streaming service
    await transcriber.connect();
    
    // Simulate sending audio data
    console.log("🎤 Simulating audio stream...");
    const audioChunks = generateSimulatedAudioChunks();
    
    for (let i = 0; i < audioChunks.length; i++) {
      const chunk = audioChunks[i];
      console.log(`📦 Sending audio chunk ${i + 1}/${audioChunks.length} (${chunk.length} bytes)`);
      
      transcriber.sendAudio(chunk);
      
      // Wait a bit between chunks to simulate real-time streaming
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Wait a moment for final processing
    console.log("\n⏳ Processing final audio...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Close the connection
    console.log("🔒 Closing connection...");
    await transcriber.close();
    
    console.log("\n🎉 Real-time transcription demo completed!");
    console.log("\n💡 In real applications, you would:");
    console.log("   - Connect to a microphone or audio source");
    console.log("   - Stream audio data in real-time");
    console.log("   - Handle the transcript as it comes in");
    console.log("   - Process the audio continuously");
    
  } catch (error) {
    console.error("❌ Error during real-time transcription:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.log("\n💡 This looks like an authentication error. Check your API key!");
      } else if (error.message.includes("429")) {
        console.log("\n💡 Rate limit exceeded. Wait a moment and try again.");
      } else if (error.message.includes("WebSocket")) {
        console.log("\n💡 WebSocket connection failed. Check your internet connection.");
      }
    }
    
    process.exit(1);
  }
}

// Run the real-time transcription
if (require.main === module) {
  startRealTimeTranscription();
}

export { startRealTimeTranscription };
