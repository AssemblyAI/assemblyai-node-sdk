#!/usr/bin/env node

/**
 * LeMUR AI Analysis Sample
 * 
 * This sample demonstrates how to use AssemblyAI's LeMUR (Large Language Model for Understanding and Reasoning)
 * to analyze audio content with AI-powered insights.
 * It's ready to run with minimal setup - just add your API key!
 * 
 * Features:
 * - AI-powered audio analysis
 * - Custom prompts and questions
 * - Content summarization
 * - Action item extraction
 * - Sentiment analysis
 * - Ready to run from terminal
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

async function analyzeAudioWithLeMUR() {
  try {
    console.log("🚀 Starting AssemblyAI LeMUR AI Analysis...\n");
    
    // Initialize client
    const client = new AssemblyAI({
      apiKey: getApiKey(),
    });
    
    // First, we need a transcript to analyze
    // You can either use an existing transcript ID or create a new one
    console.log("📝 Step 1: Creating a transcript for analysis...");
    
    // Sample audio URL (you can replace this with your own)
    const audioUrl = "https://storage.googleapis.com/aai-web-samples/5_audio_demos/02_meeting_audio_16k.wav";
    
    console.log("📁 Audio file:", audioUrl);
    console.log("⏳ Transcribing... (this may take a few minutes)\n");
    
    // Create a transcript with basic features
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      speaker_labels: true,
    });
    
    console.log("✅ Transcript created!");
    console.log("📝 Transcript ID:", transcript.id);
    console.log("📊 Status:", transcript.status);
    
    if (transcript.status !== "completed") {
      console.log("⏳ Waiting for transcript to complete...");
      // Wait for completion
      const completedTranscript = await client.transcripts.waitUntilReady(transcript.id);
      console.log("✅ Transcript completed!");
    }
    
    console.log("\n🤖 Step 2: Running LeMUR AI Analysis...\n");
    
    // Example 1: Custom prompt analysis
    console.log("🎯 Example 1: Custom Prompt Analysis");
    console.log("-".repeat(40));
    
    const promptResponse = await client.lemur.task({
      transcript_ids: [transcript.id],
      prompt: "Analyze this conversation and provide:\n1. Main topics discussed\n2. Key decisions made\n3. Action items mentioned\n4. Overall tone and sentiment\n5. Recommendations for follow-up",
    });
    
    console.log("📝 AI Analysis:");
    console.log(promptResponse.response);
    console.log();
    
    // Example 2: Content summarization
    console.log("📚 Example 2: Content Summarization");
    console.log("-".repeat(40));
    
    const summaryResponse = await client.lemur.summary({
      transcript_ids: [transcript.id],
      answer_format: "paragraph",
      context: {
        speakers: ["Meeting Participants"],
        topics: ["Business Discussion", "Project Planning"],
      },
    });
    
    console.log("📝 AI Summary:");
    console.log(summaryResponse.response);
    console.log();
    
    // Example 3: Question and Answer
    console.log("❓ Example 3: Question and Answer");
    console.log("-".repeat(40));
    
    const qaResponse = await client.lemur.questionAnswer({
      transcript_ids: [transcript.id],
      questions: [
        {
          question: "What are the main action items mentioned in this meeting?",
          answer_format: "bullet points",
        },
        {
          question: "Who are the key speakers and what are their main contributions?",
          answer_format: "structured",
        },
        {
          question: "What challenges or concerns were raised during the discussion?",
          answer_format: "list",
        },
      ],
    });
    
    console.log("📝 Q&A Results:");
    qaResponse.response.forEach((answer, index) => {
      console.log(`\nQuestion ${index + 1}: ${answer.question}`);
      console.log(`Answer: ${answer.answer}`);
    });
    console.log();
    
    // Example 4: Action Items Extraction
    console.log("✅ Example 4: Action Items Extraction");
    console.log("-".repeat(40));
    
    const actionItemsResponse = await client.lemur.actionItems({
      transcript_ids: [transcript.id],
    });
    
    console.log("📝 Action Items:");
    console.log(actionItemsResponse.response);
    console.log();
    
    // Example 5: Custom Analysis with Context
    console.log("🎨 Example 5: Custom Analysis with Context");
    console.log("-".repeat(40));
    
    const customAnalysisResponse = await client.lemur.task({
      transcript_ids: [transcript.id],
      prompt: "As a business analyst, provide a professional assessment of this meeting including:\n- Meeting effectiveness score (1-10)\n- Key insights and observations\n- Strategic implications\n- Follow-up recommendations",
      context: {
        business_context: "Corporate strategy meeting",
        audience: "Business analysts and consultants",
        focus_areas: ["Strategic planning", "Resource allocation", "Risk assessment"],
      },
    });
    
    console.log("📝 Professional Analysis:");
    console.log(customAnalysisResponse.response);
    console.log();
    
    console.log("🎉 LeMUR AI Analysis completed successfully!");
    console.log("\n💡 What you can do with LeMUR:");
    console.log("   - Ask specific questions about your audio content");
    console.log("   - Generate custom reports and analyses");
    console.log("   - Extract business insights automatically");
    console.log("   - Create meeting summaries and action items");
    console.log("   - Analyze sentiment and tone across speakers");
    console.log("   - Generate content for reports and presentations");
    
    // Clean up: Delete the transcript data from LeMUR (optional)
    console.log("\n🧹 Cleaning up LeMUR data...");
    try {
      await client.lemur.purgeRequestData(promptResponse.request_id);
      console.log("✅ LeMUR data cleaned up");
    } catch (cleanupError) {
      console.log("⚠️  Cleanup failed (this is normal):", cleanupError);
    }
    
  } catch (error) {
    console.error("❌ Error during LeMUR analysis:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("401")) {
        console.log("\n💡 This looks like an authentication error. Check your API key!");
      } else if (error.message.includes("429")) {
        console.log("\n💡 Rate limit exceeded. Wait a moment and try again.");
      } else if (error.message.includes("400")) {
        console.log("\n💡 Bad request. Check your transcript ID or parameters.");
      } else if (error.message.includes("404")) {
        console.log("\n💡 Transcript not found. Make sure it exists and is completed.");
      }
    }
    
    process.exit(1);
  }
}

// Run the LeMUR analysis
if (require.main === module) {
  analyzeAudioWithLeMUR();
}

export { analyzeAudioWithLeMUR };
