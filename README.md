# assemblyai

## Getting started

### Installing the module

`npm i assemblyai`

### Initialization

To start using the client, just instantiate a new instance with your AssemblyAI API key.

```javascript
const assemblyai = require('assemblyai');
const client = new assemblyai.AssemblyClient('ENTER YOUR ASSEMBLY KEY HERE');
```

### Upload an audio file for transcription

```javascript
const transcript = await client.createTranscript({
  audio_url: 'my-public-audio-url.wav',
});

client.pollForTranscript(transcript.id).then(result => {
  console.log(result);
});
```

## AssemblyClient

The AssemblyAI client that allows you to call the AssemblyAI V2 endpoints via various functions.

### Table of contents

#### Constructors

- [constructor](../wiki/AssemblyClient#constructor)

#### Properties

- [httpClient](../wiki/AssemblyClient#httpclient)

#### Methods

- [createTranscript](../wiki/AssemblyClient#createtranscript)
- [deleteTranscript](../wiki/AssemblyClient#deletetranscript)
- [getAllTranscripts](../wiki/AssemblyClient#getalltranscripts)
- [getTranscript](../wiki/AssemblyClient#gettranscript)
- [getTranscriptParagraphs](../wiki/AssemblyClient#gettranscriptparagraphs)
- [getTranscriptSentences](../wiki/AssemblyClient#gettranscriptsentences)
- [pollForTranscript](../wiki/AssemblyClient#pollfortranscript)
- [stream](../wiki/AssemblyClient#stream)
- [upload](../wiki/AssemblyClient#upload)

### Constructors

#### constructor

• **new AssemblyClient**(`apiKey`)

Creates an instance of AssemblyClient.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `apiKey` | `string` | Your API key to authenticate to AssemblyAI. |

### Properties

#### httpClient

• `Private` `Readonly` **httpClient**: `Axios`

The Axios http client used to make requests to the AssemblyAI API.

### Methods

#### createTranscript

▸ **createTranscript**(`request`): `Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

Create a transcript.
The transcript can then be downloaded via [getTranscript](../wiki/AssemblyClient#gettranscript), [pollForTranscript](../wiki/AssemblyClient#pollfortranscript), [getTranscriptSentences](../wiki/AssemblyClient#gettranscriptsentences), [getTranscriptParagraphs](../wiki/AssemblyClient#gettranscriptparagraphs), and [getAllTranscripts](../wiki/AssemblyClient#getalltranscripts).

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | [`TranscriptRequest`](../wiki/TranscriptRequest) | A [TranscriptRequest](../wiki/TranscriptRequest) with your transcription options. |

##### Returns

`Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

A [TranscriptResponse](../wiki/TranscriptResponse) of an incomplete transcript.

___

#### deleteTranscript

▸ **deleteTranscript**(`transcriptId`): `Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

Permanently delete a transcript by id. The record of the transcript will exist and remain queryable, however, all fields containing sensitive data (like text transcriptions) will be permanently deleted.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

##### Returns

`Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

___

#### getAllTranscripts

▸ **getAllTranscripts**(`limit?`, `status?`, `createdOn?`, `beforeId?`, `afterId?`, `throttledOnly?`): `Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

List all your transcripts.

##### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `limit` | `number` | `10` | Max results to return in a single response, between `1` and `200` inclusive. |
| `status` | `string` | `''` | Filter by transcript status, `"processing"`, `"queued"`, `"completed"`, or `"error"`. |
| `createdOn` | `string` | `''` | Only return transcripts created on this date; format: `"YYYY-MM-DD"`. |
| `beforeId` | `string` | `''` | Return transcripts that were created before this transcript id. |
| `afterId` | `string` | `''` | Return transcripts that were created after this transcript id. |
| `throttledOnly` | `boolean` | `false` | Only return throttled transcripts, overrides status filter. |

##### Returns

`Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

A paginated [AllTranscriptsResponse](../wiki/AllTranscriptsResponse) with {@link limit} transcript results.

___

#### getTranscript

▸ **getTranscript**(`transcriptId`): `Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

Get the detailed information of a specific transcript by id.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

##### Returns

`Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

A [TranscriptResponse](../wiki/TranscriptResponse) of the full transcript object no matter it's status.

___

#### getTranscriptParagraphs

▸ **getTranscriptParagraphs**(`transcriptId`): `Promise`<[`PartialTranscriptResponse`](../wiki/PartialTranscriptResponse)\>

Query for just the paragraphs of a transcript.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

##### Returns

`Promise`<[`PartialTranscriptResponse`](../wiki/PartialTranscriptResponse)\>

A [PartialTranscriptResponse](../wiki/PartialTranscriptResponse) with the paragraphs of the transcript as a list of [utterances](../wiki/Utterance).

___

#### getTranscriptSentences

▸ **getTranscriptSentences**(`transcriptId`): `Promise`<[`PartialTranscriptResponse`](../wiki/PartialTranscriptResponse)\>

Query for just the sentences of a transcript.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

##### Returns

`Promise`<[`PartialTranscriptResponse`](../wiki/PartialTranscriptResponse)\>

A [PartialTranscriptResponse](../wiki/PartialTranscriptResponse) with the sentences of the transcript as a list of [utterances](../wiki/Utterance).

___

#### pollForTranscript

▸ **pollForTranscript**(`transcriptId`, `pollTimeout?`, `pollInterval?`): `Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

Poll for a transcript.

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |
| `pollTimeout` | `number` | The amount of time to poll for before timing out. |
| `pollInterval` | `number` | The amount of time in ms to wait between each call to see if the transcript is complete. |

##### Returns

`Promise`<[`TranscriptResponse`](../wiki/TranscriptResponse)\>

A [TranscriptResponse](../wiki/TranscriptResponse) when the transcript [TranscriptResponse.status](../wiki/TranscriptResponse#status) === `completed`.

___

#### stream

▸ **stream**(`request`): `Promise`<[`StreamResponse`](../wiki/StreamResponse)\>

If you're working with short bursts of audio, less than 15 seconds, you can send the audio data directly to the `/v2/stream` endpoint which will return a transcript to you within a few hundred milliseconds, directly in the request-response loop.

##### Audio Requirements

The audio data you send to this endpoint has to comply with a strict format. This is because we don't do any transcoding to your data, we send it directly to the model for transcription. You can send the content of a `.wav` file to this endpoint, or raw data read directly from a microphone. Either way, you must record your audio in the following format to use this endpoint:

*   16-bit Signed Integer PCM encoding (ie, a .wav file)
*   8khz sampling rate
*   128kbps bitrate
*   16-bit Precision
*   Single channel
*   Headless (ie, strip any headers from wav files)
*   15 seconds or less of audio per request

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | [`StreamRequest`](../wiki/StreamRequest) | A [StreamRequest](../wiki/StreamRequest) |

##### Returns

`Promise`<[`StreamResponse`](../wiki/StreamResponse)\>

A [StreamResponse](../wiki/StreamResponse). Depending on how much audio data you send, the API will respond within 100-750 milliseconds.

___

#### upload

▸ **upload**(`audioUrl`): `Promise`<[`UploadRequestResponse`](../wiki/UploadRequestResponse)\>

Upload an audio file to AssemblyAI for transcription.
The transcript can then be downloaded via [getTranscript](../wiki/AssemblyClient#gettranscript), [pollForTranscript](../wiki/AssemblyClient#pollfortranscript), [getTranscriptSentences](../wiki/AssemblyClient#gettranscriptsentences), [getTranscriptParagraphs](../wiki/AssemblyClient#gettranscriptparagraphs), and [getAllTranscripts](../wiki/AssemblyClient#getalltranscripts).

##### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `audioUrl` | `string` | A URL that points to your audio file, accessible only by AssemblyAI's servers. |

##### Returns

`Promise`<[`UploadRequestResponse`](../wiki/UploadRequestResponse)\>

An [UploadRequestResponse](../wiki/UploadRequestResponse) with the audio_url used.

## Full Documentation

For more detailed information on the functionality available read the [docs](https://phillipchaffee.github.io/assemblyai-node-sdk/index.html).

You may also want to reference the [AssemblyAI API documentation](https://docs.assemblyai.com/).
