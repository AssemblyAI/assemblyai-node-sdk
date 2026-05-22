import { StreamingWord, TurnEvent } from "../../types/streaming";
import { Channel, VadFrame } from "../../types/streaming/dual-channel";

export type LabelMapperParams = {
  /** Per-word energy ratio above which a channel is declared dominant. */
  dominanceRatio: number;
};

/**
 * Append-only ring buffer of VAD frames in stream-relative ms order.
 * `pushFrame` is O(1) amortized; `framesInWindow` is O(n) over kept frames,
 * which is fine for the per-word lookups we do (a 30 s window at 50 frames/s
 * per channel × 2 channels = 3000 entries, scanned once per word).
 *
 * Runtime-agnostic — no DOM or Web Audio dependencies.
 */
export class VadTimeline {
  private frames: VadFrame[] = [];
  private head = 0;

  constructor(private readonly windowMs: number) {}

  pushFrame(frame: VadFrame): void {
    this.frames.push(frame);
    const cutoff = frame.ts - this.windowMs;
    while (
      this.head < this.frames.length &&
      this.frames[this.head].ts < cutoff
    ) {
      this.head++;
    }
    if (this.head > 1024 && this.head * 2 > this.frames.length) {
      this.frames = this.frames.slice(this.head);
      this.head = 0;
    }
  }

  framesInWindow(startMs: number, endMs: number): VadFrame[] {
    const out: VadFrame[] = [];
    for (let i = this.head; i < this.frames.length; i++) {
      const f = this.frames[i];
      if (f.ts < startMs) continue;
      if (f.ts > endMs) break;
      out.push(f);
    }
    return out;
  }

  clear(): void {
    this.frames = [];
    this.head = 0;
  }
}

/**
 * Sum per-channel active RMS over a window. Returns a Map from channel name
 * to total score. Channels with zero score are omitted.
 */
function scoreChannels(frames: VadFrame[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const f of frames) {
    if (!f.active) continue;
    scores.set(f.channel, (scores.get(f.channel) ?? 0) + f.rms);
  }
  return scores;
}

/**
 * Decide which channel was dominant during a word's `[start, end]` window.
 *
 * - If no channel has any active VAD energy → `"unknown"`.
 * - If the top channel beats the runner-up by at least `dominanceRatio` → top channel.
 * - Else: top channel wins on absolute score; exact ties → `"unknown"`.
 */
export function attributeWord(
  word: StreamingWord,
  timeline: VadTimeline,
  params: LabelMapperParams,
): Channel {
  const scores = scoreChannels(timeline.framesInWindow(word.start, word.end));
  if (scores.size === 0) return "unknown";
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 1) return sorted[0][0];
  const [topName, topScore] = sorted[0];
  const [runnerName, runnerScore] = sorted[1];
  if (topScore >= params.dominanceRatio * runnerScore) return topName;
  if (topScore > runnerScore) return topName;
  if (runnerScore > topScore) return runnerName;
  return "unknown";
}

/**
 * Duration-weighted majority of word channels. `"unknown"` if there are no
 * words, every word resolved to `"unknown"`, or two channels tie exactly.
 */
export function rollUpTurnChannel(words: StreamingWord[]): Channel {
  const totals = new Map<string, number>();
  for (const w of words) {
    if (!w.channel || w.channel === "unknown") continue;
    const dur = Math.max(0, w.end - w.start);
    totals.set(w.channel, (totals.get(w.channel) ?? 0) + dur);
  }
  if (totals.size === 0) return "unknown";
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 1) return sorted[0][0];
  const [topName, topMs] = sorted[0];
  const [, runnerMs] = sorted[1];
  if (topMs === runnerMs) return "unknown";
  return topName;
}

/**
 * Mutate `turn` in place: write `turn.words[i].channel` for every word and set
 * `turn.channel` to the duration-weighted rollup.
 *
 * Returns `void` because the transcriber owns the `TurnEvent` ref and forwards
 * the same object to the customer listener — no need to allocate a copy.
 */
export function attributeTurn(
  turn: TurnEvent,
  timeline: VadTimeline,
  params: LabelMapperParams,
): void {
  for (const w of turn.words) {
    w.channel = attributeWord(w, timeline, params);
  }
  turn.channel = rollUpTurnChannel(turn.words);
}
