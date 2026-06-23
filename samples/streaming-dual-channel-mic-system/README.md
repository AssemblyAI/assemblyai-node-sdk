# streaming-dual-channel-mic-system

Browser sample that streams **microphone + system audio** as a single mixed mono
stream to AssemblyAI's Streaming v3 endpoint, with per-word physical-channel
attribution (`mic` / `system`) layered on top of AAI's voice diarization
(`speaker_label`).

## Run

```bash
npm install
npm run dev
```

Then open the printed URL in Chrome, paste a streaming temporary token, and
click **Start**.

Note: the sample's `package.json` references `"assemblyai": "file:../.."` so it
builds against the local SDK source. Run `pnpm build` (or `npm run build`) once
at the SDK root before installing here.

## Getting a temporary token

API-key auth is unsupported in browsers. Mint a token from your backend:

```ts
const token = await client.streaming.createTemporaryToken({
  expires_in_seconds: 600,
})
```

## Swappable VAD

The SDK's `channelAttribution.createVad` factory is an extension point — any
class that implements `VadDetector` (`process(frame: Float32Array) → { active,
energy }` plus `reset()`) can replace the default `EnergyVad`. To plug in a
custom VAD (Silero / DNN / your own), pass a factory:

```ts
channelAttribution: {
  createVad: (channelName) => new YourCustomVadDetector(channelName),
}
```

The factory is called once per declared channel at transcriber construction
time, and the channel name (`mic` / `system` / whatever you declared in
`channels: [{ name }]`) is passed in — so factories that wrap higher-level VAD
libraries (which manage their own audio source) can map each `VadDetector`
instance to its corresponding channel.

This sample uses the default `EnergyVad` and exposes its tuning knobs via the
sliders described below.

## Resolve unknown channels

[`channelAttribution.resolveUnknownChannelsMethod`](../../src/types/streaming/index.ts)
controls how words whose per-word VAD attribution resolved to `"unknown"` are
filled in. Confident per-word VAD decisions (`"mic"` / `"system"`) are never
modified by any strategy. Default: `"window"`.

The sample's "Resolve unknown channels" dropdown switches between:

- **`window`** (default): look at the dominant non-`"unknown"` channel among
  ±2 neighboring words in the same turn. Ignores `speaker_label`, so it
  works even when AAI re-uses a label for two physically distinct voices.
  Words with no non-`"unknown"` neighbors stay `"unknown"`.
- **`speaker-history`**: accumulate per-`speaker_label` per-channel active
  VAD energy across the session. Fill `"unknown"` words with the speaker's
  dominant channel when their total evidence clears
  `speakerHistoryMinRmsEvidence` (default `0.5`) and beats runner-up by
  `speakerHistoryDominanceRatio` (default `3`). Robust when speaker labels
  are stable; does nothing when a speaker's evidence is split.
- **`none`**: disable resolution. `"unknown"` words render as-is.

Resolved words are flagged with `word.channelResolved = true`, and the sample
renders them with a trailing asterisk (e.g. `[mic*/spk A]`) so you can see
exactly when resolution fired.

### EnergyVad tuning sliders

The sample lets you tune the default
[`EnergyVad`](../../src/services/streaming/energy-vad.ts) parameters
in real time:

- **Threshold ratio** (default `3`, range `1.5`–`5`, step `0.5`): the VAD
  trips when `frameRMS > noiseFloor × thresholdRatio`. Lower values are more
  sensitive (catch quieter speech, more false positives on background).
  Higher values miss quiet utterance onsets/offsets.
- **Hangover frames** (default `10` = ~200 ms, range `0`–`25`, step `5`):
  how many frames the VAD stays "active" after the last detected speech
  frame. Longer hangovers smooth attribution across brief silences within
  an utterance.

The slider values are baked into the `EnergyVad` instances created at start
time via `channelAttribution.createVad`; they cannot be changed
mid-session — Stop and Start again to apply new values.

### Speaker-change log

When `speakerLabels` is enabled and a turn's words include a transition in
the composite `(channel, speaker_label)` key vs. the previous final word,
the sample logs a line like:

    [Speaker change: mic-A → system-B]

This is the recommended pattern for transcript renderers that want to split
on speaker boundaries: compare the `(channel, speaker_label)` composite key
between consecutive words. `channel` reliably reports the physical source
(VAD-derived); `speaker_label` is AAI's acoustic diarization on the mixed
mono stream. Either change is a real boundary.

### Speaker revisions

With `speakerLabels` enabled, the server may revise the diarization of
_earlier_ turns once it has more context (offline reclustering). It sends a
`SpeakerRevision` event — one message per resolve, listing only the turns whose
labels actually changed:

```ts
transcriber.on("speakerRevision", (event) => {
  for (const rev of event.revisions) {
    // rev.turn_order: which earlier turn to correct
    // rev.speaker_label: corrected turn-level label
    // rev.words[i].speaker: corrected per-word labels
  }
})
```

The sample keeps each finalized turn in the DOM and, on a revision, re-renders
the matching `turn_order` in place with the corrected labels — outlining the
bubble in purple and appending `(revised)` to its rollup line. Revision words
carry the new `speaker` but no client-side `channel`, so the sample merges
speakers onto the original words by timestamp and leaves channel attribution
untouched.

## Platform caveats

- **macOS:** `getDisplayMedia({ audio: true })` does **not** capture system
  audio by default. Install [BlackHole](https://existential.audio/blackhole/) or
  [Loopback.app](https://rogueamoeba.com/loopback/) and route system audio
  through the loopback device to make it available.
- **Windows:** sharing the whole screen via the picker exposes full system
  audio; sharing only a tab exposes just that tab's audio.

## Speakers + open mic: apply echo cancellation at capture

When the user listens to system audio through **speakers** (rather than
headphones) and their mic is open, the mic physically picks up the speaker
playback. The two channels then carry highly-correlated audio at similar
amplitudes, and the energy-based attribution can't reliably tell apart
"real mic speech" from "speakers played into mic."

**Transcription accuracy is unaffected** — AAI still transcribes what was
said. What's affected is **per-word channel attribution**: words that
actually came from system audio may be tagged as `mic`. If you don't use
the per-word `channel` field downstream, you can ignore this. If you do —
for instance, to render `[mic]` / `[sys]` prefixes in a transcript UI —
apply echo cancellation **at the capture layer**, before audio reaches
the SDK. Two examples below.

### Example 1: Browser (`getUserMedia` with built-in AEC)

If you're capturing in the browser (like this sample app does),
`getUserMedia` already exposes Chrome's WebRTC AEC. Pass
`echoCancellation: true` when requesting the mic stream:

```ts
const micStream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true, // Subtracts speaker playback from mic.
    noiseSuppression: true, // Optional: cleaner ambient.
    autoGainControl: true, // Optional: smooths mic level.
  },
})

// Then hand the cleaned stream to the SDK as the mic channel.
const capture = new DualChannelCapture({
  micStream,
  systemStream, // from getDisplayMedia({audio: true})
  transcriber,
})
```

This is what the browser sample app already does — it's why `[mic]`
attribution works correctly even with speakers playing into the mic.

### Example 2: Native / Node (swap in a DNN VAD via `createVad`)

In server-side or native runtimes (Node, Electron, the Swift helpers
behind native CLIs, etc.) there is no `getUserMedia`. The right answer is
still to do echo cancellation **at capture** — macOS has
`AVAudioEngine.setVoiceProcessingEnabled(true)`, Linux has PulseAudio's
`module-echo-cancel`, telephony stacks usually have it in the codec.
**Use what your capture layer provides.**

If platform-level AEC isn't available, the next-best option is to plug
in a DNN voice-activity detector via `channelAttribution.createVad`. A
DNN VAD distinguishes "real speech" from "playback that the mic
recaptured" using spectral characteristics (rather than energy), so it's
much more robust to speaker leak. [Silero VAD](https://github.com/snakers4/silero-vad)
is the typical choice; the [`@ricky0123/vad`](https://www.npmjs.com/package/@ricky0123/vad)
package bundles it for browser and Node.

```ts
import { MicVAD } from "@ricky0123/vad-web"
import type { VadDetector, VadDetectorResult } from "assemblyai"

// Adapter: wrap a Silero session as the SDK's VadDetector interface.
class SileroVad implements VadDetector {
  constructor(private readonly speechProb: () => number) {}
  process(frame: Float32Array): VadDetectorResult {
    const p = this.speechProb()
    let sumSq = 0
    for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i]
    const rms = Math.sqrt(sumSq / Math.max(1, frame.length))
    return { active: p > 0.5, energy: rms }
  }
  reset(): void {}
}

// One MicVAD per channel.
const micVad = await MicVAD.new({
  /* ... */
})
const systemVad = await MicVAD.new({
  /* ... */
})

const transcriber = client.streaming.transcriber({
  speechModel: "universal-3-5-pro",
  sampleRate: 16_000,
  channels: [{ name: "mic" }, { name: "system" }],
  channelAttribution: {
    createVad: (channelName) =>
      new SileroVad(
        channelName === "mic"
          ? () => micVad.lastSpeechProb()
          : () => systemVad.lastSpeechProb(),
      ),
  },
})
```

The factory is called once per declared channel at transcriber
construction time, so it's a clean place to wire each channel's VAD to
its own Silero session.

### Why the SDK can't ship AEC itself

Echo cancellation belongs at the capture layer — the moment audio enters
your application — because:

1. Every platform (browser, macOS, iOS, Linux, Windows, telephony) has
   its own AEC implementation tuned for its own audio stack. The SDK
   only sees PCM after capture, by which point platform-specific delay
   compensation and double-talk handling are out of reach.
2. A pure-JS AEC inside the SDK would re-invent what the OS / browser
   already does well, with worse latency and worse quality.
3. Customers' AEC needs differ. Voice agents want aggressive AEC;
   meeting recorders want light-touch AEC that doesn't suppress
   overlapping speech. The capture layer is where that choice is made.

Channel attribution in this SDK assumes capture-layer AEC is already
applied when speaker leak is a real concern.
