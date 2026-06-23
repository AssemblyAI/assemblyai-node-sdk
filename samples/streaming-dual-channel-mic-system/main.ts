import {
  DualChannelCapture,
  EnergyVad,
  StreamingTranscriber,
  type TurnEvent,
} from "assemblyai"

// The SDK accepts an external VAD via channelAttribution.createVad. For example,
// to plug in a Silero / DNN VAD, pass:
//
//   channelAttribution: {
//     createVad: (channelName) => new YourCustomVadDetector(channelName),
//   }
//
// Where YourCustomVadDetector implements the SDK's VadDetector interface
// (process(frame: Float32Array) → { active, energy } and reset()). The default
// is EnergyVad, which we use here.

const tokenInput = document.getElementById("token") as HTMLInputElement
const startBtn = document.getElementById("start") as HTMLButtonElement
const stopBtn = document.getElementById("stop") as HTMLButtonElement
const resolveMethodSelect = document.getElementById(
  "resolve-method",
) as HTMLSelectElement
const thresholdRatioInput = document.getElementById(
  "threshold-ratio",
) as HTMLInputElement
const thresholdRatioValue = document.getElementById(
  "threshold-ratio-value",
) as HTMLSpanElement
const hangoverFramesInput = document.getElementById(
  "hangover-frames",
) as HTMLInputElement
const hangoverFramesValue = document.getElementById(
  "hangover-frames-value",
) as HTMLSpanElement
const maxSpeakersInput = document.getElementById(
  "max-speakers",
) as HTMLInputElement
const output = document.getElementById("output") as HTMLDivElement
const events = document.getElementById("events") as HTMLDivElement
const panelTabBtns =
  document.querySelectorAll<HTMLButtonElement>(".panel-tab-btn")

/** Append one streaming event to the Events panel as a single JSON line. */
function logEvent(kind: string, payload: unknown): void {
  const line = document.createElement("div")
  line.className = `event-line event-${kind}`
  line.textContent = JSON.stringify({ kind, ...(payload as object) })
  events.appendChild(line)
  events.scrollTop = events.scrollHeight
}

// Panel tab switching.
for (const btn of panelTabBtns) {
  btn.addEventListener("click", () => {
    const active = btn.dataset.panelTab
    for (const b of panelTabBtns) b.classList.toggle("active", b === btn)
    output.classList.toggle("hidden", active !== "output")
    events.classList.toggle("hidden", active !== "events")
  })
}
const micFill = document.getElementById("mic-fill") as HTMLDivElement
const sysFill = document.getElementById("sys-fill") as HTMLDivElement
const micDb = document.getElementById("mic-db") as HTMLSpanElement
const sysDb = document.getElementById("sys-db") as HTMLSpanElement
const micFlag = document.getElementById("mic-flag") as HTMLSpanElement
const sysFlag = document.getElementById("sys-flag") as HTMLSpanElement
const diag = document.getElementById("diag") as HTMLDivElement

let transcriber: StreamingTranscriber | undefined
let capture: DualChannelCapture | undefined
let micStream: MediaStream | undefined
let systemStream: MediaStream | undefined

// Wire slider value labels up-front so the user sees what the slider is set to
// before they press Start.
thresholdRatioInput.addEventListener("input", () => {
  thresholdRatioValue.textContent = thresholdRatioInput.value
})
hangoverFramesInput.addEventListener("input", () => {
  hangoverFramesValue.textContent = hangoverFramesInput.value
})

function appendLine(line: string, className?: string): void {
  const div = document.createElement("div")
  if (className) div.className = className
  div.textContent = line
  output.appendChild(div)
  output.scrollTop = output.scrollHeight
}

function rmsToDbStr(rms: number): string {
  if (rms < 1e-6) return "–∞ dB"
  return `${(20 * Math.log10(rms)).toFixed(1)} dB`
}

function rmsToBarPct(rms: number): number {
  if (rms < 1e-6) return 0
  const db = 20 * Math.log10(rms)
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100))
}

async function start(): Promise<void> {
  const token = tokenInput.value.trim()
  if (!token) {
    appendLine("Need a temporary token.")
    return
  }
  startBtn.disabled = true
  output.replaceChildren()

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  systemStream = await navigator.mediaDevices.getDisplayMedia({
    audio: true,
    video: true,
  })
  if (systemStream.getAudioTracks().length === 0) {
    appendLine(
      "No audio track in display capture. On macOS, install BlackHole or similar.",
    )
    micStream.getTracks().forEach((t) => t.stop())
    systemStream.getTracks().forEach((t) => t.stop())
    startBtn.disabled = false
    return
  }

  const resolveMethod = resolveMethodSelect.value as
    | "none"
    | "window"
    | "speaker-history"
  const thresholdRatio = parseFloat(thresholdRatioInput.value)
  const hangoverFrames = parseInt(hangoverFramesInput.value, 10)
  const maxSpeakersRaw = maxSpeakersInput.value.trim()
  const maxSpeakers =
    maxSpeakersRaw === "" ? undefined : parseInt(maxSpeakersRaw, 10)

  const channelAttribution: NonNullable<
    ConstructorParameters<typeof StreamingTranscriber>[0]["channelAttribution"]
  > = {
    createVad: () => new EnergyVad({ thresholdRatio, hangoverFrames }),
    resolveUnknownChannelsMethod: resolveMethod,
  }

  transcriber = new StreamingTranscriber({
    token,
    sampleRate: 16_000,
    speechModel: "universal-3-5-pro",
    speakerLabels: true,
    ...(maxSpeakers !== undefined && { maxSpeakers }),
    continuousPartials: true,
    channels: [{ name: "mic" }, { name: "system" }],
    channelAttribution,
    minTurnSilence: 400,
    maxTurnSilence: 1000,
    vadThreshold: 0.5,
  })
  transcriber.on("open", (e) => logEvent("Begin", e))
  transcriber.on("error", (err) => {
    appendLine(`[error] ${err.message}`)
    logEvent("Error", { message: err.message })
  })
  transcriber.on("close", (code, reason) => {
    appendLine(`[close] ${code} ${reason}`)
    logEvent("Close", { code, reason })
  })
  transcriber.on("warning", (e) => logEvent("Warning", e))

  // Meter state: EMA-smoothed peak RMS per channel + a "we ever saw audio?"
  // diagnostic that flags after ~3 s of silence on the system side.
  const ema = new Map<string, number>([
    ["mic", 0],
    ["system", 0],
  ])
  let sysSawAudio = false
  const startedAt = performance.now()
  const EMA_ALPHA = 0.3
  const SYS_AUDIO_THRESHOLD = 5e-4

  transcriber.on("vad", (frame) => {
    const prev = ema.get(frame.channel) ?? 0
    const next = prev * (1 - EMA_ALPHA) + frame.rms * EMA_ALPHA
    ema.set(frame.channel, next)

    if (frame.channel === "system" && frame.rms > SYS_AUDIO_THRESHOLD) {
      if (!sysSawAudio) diag.textContent = ""
      sysSawAudio = true
    }

    if (frame.channel === "mic") {
      micFill.style.width = `${Math.min(100, rmsToBarPct(next))}%`
      micDb.textContent = rmsToDbStr(next)
      micFlag.textContent = frame.active ? "● speaking" : ""
      micFlag.className = `meter-flag${frame.active ? " active" : ""}`
    } else if (frame.channel === "system") {
      sysFill.style.width = `${Math.min(100, rmsToBarPct(next))}%`
      sysDb.textContent = rmsToDbStr(next)
      sysFlag.textContent = frame.active ? "● speaking" : ""
      sysFlag.className = `meter-flag${frame.active ? " active" : ""}`
    }

    if (
      !sysSawAudio &&
      performance.now() - startedAt > 3000 &&
      diag.textContent === ""
    ) {
      diag.textContent =
        "No system audio detected after 3s. Common causes: (1) didn't tick 'Share tab audio' in the picker, (2) shared a different tab than the one playing audio, (3) on macOS you need a virtual loopback driver (BlackHole) for non-tab system audio."
    }
  })

  // Per-turn container divs. Each container holds N bubbles (one per
  // contiguous same-channel run within the turn) plus the rollup line on
  // end_of_turn. Keyed by turn_order so partials replace the same container.
  const turnContainers = new Map<number, HTMLElement>()
  // Finalized turns we keep around so a later SpeakerRevision can re-render
  // them in place. Keyed by turn_order; holds the container, its rollup line,
  // and the last-rendered TurnEvent (so revisions merge onto known words).
  const finalizedTurns = new Map<
    number,
    { container: HTMLElement; rollup: HTMLElement; turn: TurnEvent }
  >()
  // Last committed turn-level (channel, speaker_label) composite — used to
  // detect speaker changes between consecutive *finalized turns*.
  let lastFinalTurnComposite: string | undefined

  /**
   * Split a turn's words into contiguous same-channel runs. Words within a run
   * share a channel value (treating `undefined` as `"unknown"`). Each run
   * becomes its own bubble so a turn that contains both mic and system speech
   * renders as multiple bubbles aligned to their respective sides.
   */
  function groupByChannel(turn: TurnEvent) {
    const runs: Array<{
      channel: string
      anyResolved: boolean
      words: TurnEvent["words"]
    }> = []
    for (const w of turn.words) {
      const ch = w.channel ?? "unknown"
      const last = runs[runs.length - 1]
      if (last && last.channel === ch) {
        last.words.push(w)
        if (w.channelResolved) last.anyResolved = true
      } else {
        runs.push({ channel: ch, anyResolved: !!w.channelResolved, words: [w] })
      }
    }
    return runs
  }

  function renderTurnContainer(
    container: HTMLElement,
    turn: TurnEvent,
    isFinal: boolean,
  ): void {
    container.replaceChildren()
    const runs = groupByChannel(turn)

    for (let r = 0; r < runs.length; r++) {
      const run = runs[r]
      const bubble = document.createElement("div")
      const align = run.channel === "mic" ? "align-right" : "align-left"
      bubble.className = `turn-row ${align} ${isFinal ? "final" : "partial"}`

      // Show the partial marker only on the first bubble of an in-progress turn.
      if (!isFinal && r === 0) {
        const marker = document.createElement("span")
        marker.className = "partial-marker"
        marker.textContent = "[partial]"
        bubble.appendChild(marker)
      }

      for (const w of run.words) {
        const chip = document.createElement("span")
        chip.className = "word-chip"
        const channelLabel = `${w.channel ?? "unknown"}${
          w.channelResolved ? "*" : ""
        }`
        // Per AAI docs, `word.speaker` is only set on final words and may
        // still be absent; `turn.speaker_label` is only populated on the
        // final turn event. On partials we have neither, so we render the
        // channel only.
        const speakerForWord = w.speaker ?? turn.speaker_label
        const speakerChip = speakerForWord ? `/spk ${speakerForWord}` : ""
        chip.textContent = `[${channelLabel}${speakerChip}] ${w.text} `
        bubble.appendChild(chip)
      }

      container.appendChild(bubble)
    }
  }

  transcriber.on("turn", (turn) => {
    logEvent("Turn", turn)
    let container = turnContainers.get(turn.turn_order)
    if (!container) {
      container = document.createElement("div")
      container.className = "turn-container"
      output.appendChild(container)
      turnContainers.set(turn.turn_order, container)
    }

    renderTurnContainer(container, turn, turn.end_of_turn)
    output.scrollTop = output.scrollHeight

    if (!turn.end_of_turn) return

    turnContainers.delete(turn.turn_order)

    // Turn-level speaker-change detection: compare this turn's primary
    // (channel, speaker_label) to the previous finalized turn's.
    const turnComposite =
      turn.channel && turn.speaker_label
        ? `${turn.channel}-${turn.speaker_label}`
        : undefined
    if (
      turnComposite &&
      lastFinalTurnComposite &&
      lastFinalTurnComposite !== turnComposite
    ) {
      const log = document.createElement("div")
      log.className = "speaker-change-log"
      log.textContent = `[Speaker change: ${lastFinalTurnComposite} → ${turnComposite}]`
      container.before(log)
    }
    if (turnComposite) lastFinalTurnComposite = turnComposite

    // End-of-turn rollup line.
    const rollupLine = document.createElement("div")
    rollupLine.className = "rollup-line"
    rollupLine.textContent = `-- End of turn #${turn.turn_order}: speaker_label: ${
      turn.speaker_label ?? "?"
    } | Most active channel: ${turn.channel ?? "unknown"}`
    container.after(rollupLine)
    output.scrollTop = output.scrollHeight

    // Retain the finalized turn so a later SpeakerRevision can correct it.
    finalizedTurns.set(turn.turn_order, { container, rollup: rollupLine, turn })
  })

  // SpeakerRevision: diarization-only, emitted once per offline-recluster
  // resolve. Each revision is an *earlier* finalized turn whose speaker labels
  // changed — we re-render that turn in place with the corrected labels and
  // flag it as revised. Unchanged turns are not included.
  transcriber.on("speakerRevision", (event) => {
    logEvent("SpeakerRevision", event)
    for (const rev of event.revisions) {
      const entry = finalizedTurns.get(rev.turn_order)
      if (!entry) continue // turn isn't in view (e.g. session was reset)

      // Revision words carry the corrected `speaker` but no client-side
      // `channel` attribution, so merge speakers onto the original words by
      // timestamp and keep each word's channel/channelResolved intact.
      const speakerByStart = new Map(rev.words.map((w) => [w.start, w.speaker]))
      const revisedWords = entry.turn.words.map((w) => ({
        ...w,
        speaker: speakerByStart.get(w.start) ?? w.speaker,
      }))
      entry.turn = {
        ...entry.turn,
        speaker_label: rev.speaker_label ?? entry.turn.speaker_label,
        words: revisedWords,
      }

      renderTurnContainer(entry.container, entry.turn, true)
      entry.container.classList.add("revised")
      entry.rollup.className = "rollup-line revised"
      entry.rollup.textContent = `-- End of turn #${rev.turn_order}: speaker_label: ${
        entry.turn.speaker_label ?? "?"
      } | Most active channel: ${entry.turn.channel ?? "unknown"}  (revised)`
    }
    output.scrollTop = output.scrollHeight
  })

  // Expose so stop() can reset session-scoped state.
  ;(
    globalThis as unknown as { __resetTurnState?: () => void }
  ).__resetTurnState = () => {
    turnContainers.clear()
    finalizedTurns.clear()
    lastFinalTurnComposite = undefined
  }

  capture = new DualChannelCapture({ micStream, systemStream, transcriber })
  capture.on("error", (err) => appendLine(`[capture error] ${err.message}`))

  await transcriber.connect()
  await capture.start()
  stopBtn.disabled = false
  resolveMethodSelect.disabled = true
  thresholdRatioInput.disabled = true
  hangoverFramesInput.disabled = true
  appendLine("Streaming…")
}

async function stop(): Promise<void> {
  stopBtn.disabled = true
  await capture?.stop()
  await transcriber?.close()
  micStream?.getTracks().forEach((t) => t.stop())
  systemStream?.getTracks().forEach((t) => t.stop())
  capture = undefined
  transcriber = undefined
  micStream = undefined
  systemStream = undefined
  ;(
    globalThis as unknown as { __resetTurnState?: () => void }
  ).__resetTurnState?.()
  micFill.style.width = "0%"
  sysFill.style.width = "0%"
  micDb.textContent = "–∞ dB"
  sysDb.textContent = "–∞ dB"
  micFlag.textContent = ""
  sysFlag.textContent = ""
  startBtn.disabled = false
  resolveMethodSelect.disabled = false
  thresholdRatioInput.disabled = false
  hangoverFramesInput.disabled = false
  appendLine("Stopped.")
}

startBtn.addEventListener("click", () => {
  void start().catch((err) => {
    appendLine(`[start error] ${(err as Error).message}`)
    startBtn.disabled = false
  })
})
stopBtn.addEventListener("click", () => {
  void stop()
})
