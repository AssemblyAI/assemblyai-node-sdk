import { DictationResponse } from "../..";
import { LiveSession } from "../../utils/live";

/**
 * A dictation that audio is pushed into.
 *
 * Returned by `client.dictation.openLive()`. The request starts the moment
 * the session opens; `write()` hands it audio, `close()` ends the audio, and
 * `result()` resolves with the transcript. Built for callback-driven sources:
 * a microphone library, a WebRTC track, a telephony media stream, a websocket
 * handler receiving frames. Sources that already are streams or async
 * iterables, and audio held whole, go to `client.dictation.transcribeLive()`
 * instead.
 *
 * Everything `transcribeLive()` says about the 120 s audio cap, the
 * server-side silence abort and errors surfacing mid-upload applies here
 * unchanged.
 *
 * @example
 * ```ts
 * const session = client.dictation.openLive({ sample_rate: 16000, channels: 1 });
 * mic.on("data", (chunk) => session.write(chunk));
 * mic.on("end", () => session.close());
 * const { final_text } = await session.result();
 * ```
 */
export class DictationLiveSession extends LiveSession<DictationResponse> {}
