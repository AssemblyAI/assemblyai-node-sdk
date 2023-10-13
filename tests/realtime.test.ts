import WS from "jest-websocket-mock";
import AssemblyAI, { RealtimeService } from '../src'
import {
  RealtimeError,
  RealtimeErrorType,
  RealtimeErrorMessages
} from '../src/utils/errors/realtime'
import stream from "stream";

const apiKey = '123';
const token = '123';
const baseUrl = 'https://localhost:1234'
const realtimeUrl = 'wss://localhost:1234'
const sessionBeginsMessage = {
  message_type: 'SessionBegins',
  session_id: '123',
  expires_at: '2023-09-14T03:37:11.516967'
};
const sessionTerminatedMessage = {
  message_type: 'SessionTerminated'
};
let server: WS;
let aai: AssemblyAI;
let rt: RealtimeService;
let onOpen: jest.Mock;

async function connect(rt: RealtimeService, server: WS) {
  const connectPromise = rt.connect()
  await server.connected
  server.send(JSON.stringify(sessionBeginsMessage))
  await connectPromise;
}
async function close(rt: RealtimeService, server: WS) {
  const closePromise = rt.close()
  server.send(JSON.stringify(sessionTerminatedMessage))
  await closePromise;
  await server.closed
}

describe('realtime', () => {
  beforeEach(async () => {
    server = new WS(realtimeUrl)
    aai = new AssemblyAI({
      apiKey,
      baseUrl,
    })
    rt = aai.realtime.createService({ realtimeUrl })
    onOpen = jest.fn()
    rt.on('open', onOpen)
    await connect(rt, server)
  })
  afterEach(async () => await cleanup())

  async function cleanup() {
    await close(rt, server);
    WS.clean()
  }

  it('fails on redundant connection', async () => {
    await expect(async () => await rt.connect()).rejects.toThrowError('Already connected')
  })

  it('fails with no websocket URL', async () => {
    const rt = new RealtimeService({
      apiKey,
      realtimeUrl: 'https://api.assemblyai.com',
    });
    await expect(async () => await rt.connect()).rejects.toThrowError('Invalid protocol, must be wss')
  })

  it('fails to send audio with closed websocket', async () => {
    await close(rt, server)
    expect(() => rt.sendAudio(new ArrayBuffer(8)))
      .toThrow('Socket is not open for communication')
  })

  it('creates service with override URL', async () => {
    cleanup();
    const baseUrlOverride = 'wss://localhost:1235'
    const server = new WS(baseUrlOverride)
    const aai = new AssemblyAI({ apiKey })
    const rt = aai.realtime.createService({ realtimeUrl: baseUrlOverride, token: '123' })
    await connect(rt, server);
    await server.connected
    await close(rt, server)
  })

  it('creates service with token', async () => {
    const realtimeUrl = 'wss://localhost:5678'
    const server = new WS(realtimeUrl)
    const aai = new AssemblyAI({ apiKey, baseUrl })
    const rt = aai.realtime.createService({ realtimeUrl, token: '123' })
    await connect(rt, server)
    await close(rt, server)
  })

  it('creates service with API key', async () => {
    const realtimeUrl = 'wss://localhost:5678'
    const server = new WS(realtimeUrl)
    const aai = new AssemblyAI({ apiKey, baseUrl })
    const rt = aai.realtime.createService({ realtimeUrl, apiKey: '123' })
    await connect(rt, server)
    await close(rt, server)
  })

  it('receives open event', () => {
    expect(onOpen).toHaveBeenCalled()
  })

  it('receives closed event', async () => {
    const onClose = jest.fn()
    rt.on('close', onClose)
    server.close()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes without SessionTerminated', async () => {
    const realtimeUrl = 'wss://localhost:5678'
    const server = new WS(realtimeUrl)
    const assembly = new AssemblyAI({ apiKey, baseUrl })
    const rt = assembly.realtime.createService({ realtimeUrl, apiKey: '123' })
    await connect(rt, server)
    await rt.close(false)
    await server.closed
  })

  it('can send audio', async () => {
    const data = new ArrayBuffer(8)
    rt.sendAudio(data)
    await expect(server)
      .toReceiveMessage(JSON.stringify({ audio_data: Buffer.from(data).toString('base64') }));
  })

  it('can send audio using stream', async () => {
    const writeStream = new stream.PassThrough()
    writeStream.pipe(rt.stream())
    writeStream.write(Buffer.alloc(5_000))
    await expect(server)
      .toReceiveMessage(JSON.stringify({ audio_data: Buffer.alloc(5_000).toString('base64') }));
  })

  it('can receive transcript', () => {
    const data = {
      created: '2023-09-14T03:37:11.516967',
      text: "Hello world",
      message_type: 'FinalTranscript'
    };
    const onTranscript = jest.fn()
    rt.on('transcript', onTranscript)
    server.send(JSON.stringify(data))
    expect(onTranscript).toHaveBeenCalledWith({ ...data, created: new Date(data.created) })
  })

  it('can receive partial transcript', () => {
    const data = {
      created: '2023-09-14T03:37:11.516967',
      text: "Hello world",
      message_type: 'PartialTranscript'
    };
    const onTranscript = jest.fn()
    rt.on('transcript.partial', onTranscript)
    server.send(JSON.stringify(data))
    expect(onTranscript).toHaveBeenCalledWith({ ...data, created: new Date(data.created) })
  })

  it('can receive final transcript', () => {
    const data = {
      created: '2023-09-14T03:37:11.516967',
      text: "Hello world",
      message_type: 'FinalTranscript'
    };
    const onTranscript = jest.fn()
    rt.on('transcript.final', onTranscript)
    server.send(JSON.stringify(data))
    expect(onTranscript).toHaveBeenCalledWith({ ...data, created: new Date(data.created) })
  })

  it('can receive session begins', async () => {
    const realtimeUrl = 'wss://localhost:5678'
    const server = new WS(realtimeUrl)
    const assembly = new AssemblyAI({ apiKey, baseUrl })
    const rt = assembly.realtime.createService({ realtimeUrl, apiKey: '123' })
    const onOpen = jest.fn()
    rt.on('open', onOpen)
    await connect(rt, server)
    expect(onOpen).toHaveBeenCalledWith({
      sessionId: sessionBeginsMessage.session_id,
      expiresAt: new Date(sessionBeginsMessage.expires_at)
    })
  })

  it('receives WebSocket error', () => {
    const onError = jest.fn()
    rt.on('error', onError)
    server.error({
      code: 0,
      reason: 'Some WebSocket issue',
      wasClean: false
    })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('receives realtime error message', () => {
    const error = {
      "error": "my_error"
    }
    const onError = jest.fn()
    rt.on('error', onError)
    server.send(JSON.stringify(error))
    expect(onError).toHaveBeenCalledWith(new RealtimeError(error.error))
  })

  it('receives close event', () => {
    const onClose = jest.fn()
    rt.on('close', onClose)
    server.close({
      code: RealtimeErrorType.AudioTooLong,
      reason: null as unknown as string,
      wasClean: false
    })
    expect(onClose).toHaveBeenCalledWith(
      RealtimeErrorType.AudioTooLong,
      RealtimeErrorMessages[RealtimeErrorType.AudioTooLong]
    )
  })

  it('can create a token', async () => {
    const token = await aai.realtime.createTemporaryToken({ expires_in: 480 })
    expect(token).toEqual('123');
  })
})
