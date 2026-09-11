import "dotenv/config";
import { AssemblyAI, LanguageDetectionOptions } from "../../src";

// This suite makes live API calls. Successful fallback transcripts are billable.
// Run only this file with RUN_NO_SPEECH_INTEGRATION=1 and ASSEMBLYAI_API_KEY set.
// Optionally set NO_SPEECH_SILENT_FIXTURE to silent-error.flac; otherwise the
// suite generates five seconds of digital silence as a PCM WAV in memory.
// Set NO_SPEECH_SOUND_EFFECT_FIXTURE to sound-effect-no-error.flac to run the
// separate non-silent, speech-free audio regression. Keep private audio outside
// the repository. The suite deletes transcripts it creates after each test.
// RUN_NO_SPEECH_CONTRACT_TESTS=1 also probes two disputed documented behaviors:
// omitted on_no_speech_detected errors, and a missing fallback language is a 400.
// These probes can fail on accounts/backends with different default behavior.
const describeLive =
  process.env.RUN_NO_SPEECH_INTEGRATION === "1" ? describe : describe.skip;
const itContract =
  process.env.RUN_NO_SPEECH_CONTRACT_TESTS === "1" ? it : it.skip;
const soundEffectFixture = process.env.NO_SPEECH_SOUND_EFFECT_FIXTURE;
const pollingOptions = { pollingInterval: 1_000, pollingTimeout: 180_000 };

function digitalSilence(): Buffer {
  const sampleRate = 16_000;
  const bytesPerSample = 2;
  const dataSize = sampleRate * bytesPerSample * 5;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // Mono
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  return wav;
}

describeLive("no speech detected (live, opt-in)", () => {
  let client: AssemblyAI;
  let silentAudioUrl: string;
  let submitSpy:
    jest.SpiedFunction<AssemblyAI["transcripts"]["submit"]> | undefined;
  const transcriptIds = new Set<string>();

  beforeAll(async () => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "RUN_NO_SPEECH_INTEGRATION=1 requires ASSEMBLYAI_API_KEY",
      );
    }
    client = new AssemblyAI({ apiKey });
    const originalSubmit = client.transcripts.submit.bind(client.transcripts);
    submitSpy = jest
      .spyOn(client.transcripts, "submit")
      .mockImplementation(async (...args) => {
        const transcript = await originalSubmit(...args);
        // Track the job before transcribe starts polling so timeouts are cleaned up.
        transcriptIds.add(transcript.id);
        return transcript;
      });
    silentAudioUrl = await client.files.upload(
      process.env.NO_SPEECH_SILENT_FIXTURE || digitalSilence(),
    );
  });

  afterEach(async () => {
    for (const id of transcriptIds) {
      await client.transcripts.delete(id);
      transcriptIds.delete(id);
    }
  });

  afterAll(() => {
    submitSpy?.mockRestore();
  });

  it("completes digital silence with the fallback language and a readable warning", async () => {
    const transcript = await client.transcripts.transcribe(
      {
        audio_url: silentAudioUrl,
        language_detection: true,
        language_detection_options: {
          on_no_speech_detected: "fallback",
          fallback_language: "en",
        },
      },
      pollingOptions,
    );

    expect(transcript.status).toBe("completed");
    expect(transcript.text).toBe("");
    expect(transcript.language_code).toBe("en");
    // Assert the live fixture's warning, not an unrelated warning on an empty result.
    // This is a regression expectation, not SDK-side message classification.
    expect(transcript.metadata?.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("No speech was detected"),
        }),
      ]),
    );
  });

  async function expectSilenceError(options?: LanguageDetectionOptions) {
    const submitted = await client.transcripts.submit({
      audio_url: silentAudioUrl,
      language_detection: true,
      language_detection_options: options,
    });
    const transcript = await client.transcripts.waitUntilReady(
      submitted.id,
      pollingOptions,
    );

    expect(transcript.status).toBe("error");
    expect(transcript.error).toBe(
      "language_detection cannot be performed on files with no spoken audio.",
    );
  }

  it("errors for the same digital silence when error is explicit", async () => {
    await expectSilenceError({ on_no_speech_detected: "error" });
  });

  itContract(
    "documented-contract probe: the omitted option errors",
    async () => {
      await expectSilenceError();
    },
  );

  (soundEffectFixture ? it : it.skip)(
    "completes the sound-effect fixture when the no-speech strategy is error",
    async () => {
      const submitted = await client.transcripts.submit({
        audio: soundEffectFixture!,
        language_detection: true,
        language_detection_options: { on_no_speech_detected: "error" },
      });
      const transcript = await client.transcripts.waitUntilReady(
        submitted.id,
        pollingOptions,
      );

      expect(transcript.status).toBe("completed");
      expect(transcript.text).toBe("");
    },
  );

  describe.each(["submit", "transcribe"] as const)(
    "%s validation",
    (method) => {
      async function expectApi400(options: LanguageDetectionOptions) {
        // Observe real responses: the SDK currently exposes the API error message
        // through Error, but does not attach the HTTP status to that error.
        const originalFetch = globalThis.fetch;
        let httpError: { status: number; message: string } | undefined;
        const fetchSpy = jest
          .spyOn(globalThis, "fetch")
          .mockImplementation(async (...args) => {
            const response = await originalFetch(...args);
            if (response.status >= 400) {
              const body = await response.clone().json();
              httpError = { status: response.status, message: body.error };
            }
            return response;
          });

        let error: unknown;
        try {
          await client.transcripts[method](
            {
              audio_url: silentAudioUrl,
              language_detection: true,
              language_detection_options: options,
            },
            pollingOptions,
          );
        } catch (caught) {
          error = caught;
        } finally {
          fetchSpy.mockRestore();
        }

        expect(httpError?.status).toBe(400);
        expect(httpError?.message).toEqual(expect.any(String));
        expect(httpError?.message).not.toBe("");
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty("message", httpError?.message);
      }

      it("surfaces the API's 400 for fallback_language auto", async () => {
        await expectApi400({
          on_no_speech_detected: "fallback",
          fallback_language: "auto",
        });
      });

      itContract(
        "documented-contract probe: missing fallback language is a 400",
        async () => {
          await expectApi400({ on_no_speech_detected: "fallback" });
        },
      );
    },
  );
});
