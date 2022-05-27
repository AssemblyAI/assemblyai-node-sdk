[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / AssemblyClient

# Class: AssemblyClient

The AssemblyAI client that allows you to call the AssemblyAI V2 endpoints via various functions.

## Table of contents

### Constructors

- [constructor](AssemblyClient.md#constructor)

### Properties

- [httpClient](AssemblyClient.md#httpclient)

### Methods

- [createTranscript](AssemblyClient.md#createtranscript)
- [deleteTranscript](AssemblyClient.md#deletetranscript)
- [getAllTranscripts](AssemblyClient.md#getalltranscripts)
- [getTranscript](AssemblyClient.md#gettranscript)
- [getTranscriptParagraphs](AssemblyClient.md#gettranscriptparagraphs)
- [getTranscriptSentences](AssemblyClient.md#gettranscriptsentences)
- [pollForTranscript](AssemblyClient.md#pollfortranscript)
- [stream](AssemblyClient.md#stream)
- [upload](AssemblyClient.md#upload)

## Constructors

### constructor

• **new AssemblyClient**(`apiKey`)

Creates an instance of AssemblyClient.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `apiKey` | `string` | Your API key to authenticate to AssemblyAI. |

#### Defined in

[assembly-client.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L24)

## Properties

### httpClient

• `Private` `Readonly` **httpClient**: `Axios`

The Axios http client used to make requests to the AssemblyAI API.

#### Defined in

[assembly-client.ts:37](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L37)

## Methods

### createTranscript

▸ **createTranscript**(`request`): `Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

Create a transcript.
The transcript can then be downloaded via [getTranscript](AssemblyClient.md#gettranscript), [pollForTranscript](AssemblyClient.md#pollfortranscript), [getTranscriptSentences](AssemblyClient.md#gettranscriptsentences), [getTranscriptParagraphs](AssemblyClient.md#gettranscriptparagraphs), and [getAllTranscripts](AssemblyClient.md#getalltranscripts).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | [`TranscriptRequest`](TranscriptRequest.md) | A [TranscriptRequest](TranscriptRequest.md) with your transcription options. |

#### Returns

`Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

A [TranscriptResponse](TranscriptResponse.md) of an incomplete transcript.

#### Defined in

[assembly-client.ts:69](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L69)

___

### deleteTranscript

▸ **deleteTranscript**(`transcriptId`): `Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

Permanently delete a transcript by id. The record of the transcript will exist and remain queryable, however, all fields containing sensitive data (like text transcriptions) will be permanently deleted.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

#### Returns

`Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

#### Defined in

[assembly-client.ts:202](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L202)

___

### getAllTranscripts

▸ **getAllTranscripts**(`limit?`, `status?`, `createdOn?`, `beforeId?`, `afterId?`, `throttledOnly?`): `Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

List all your transcripts.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `limit` | `number` | `10` | Max results to return in a single response, between `1` and `200` inclusive. |
| `status` | `string` | `''` | Filter by transcript status, `"processing"`, `"queued"`, `"completed"`, or `"error"`. |
| `createdOn` | `string` | `''` | Only return transcripts created on this date; format: `"YYYY-MM-DD"`. |
| `beforeId` | `string` | `''` | Return transcripts that were created before this transcript id. |
| `afterId` | `string` | `''` | Return transcripts that were created after this transcript id. |
| `throttledOnly` | `boolean` | `false` | Only return throttled transcripts, overrides status filter. |

#### Returns

`Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

A paginated [AllTranscriptsResponse](AllTranscriptsResponse.md) with {@link limit} transcript results.

#### Defined in

[assembly-client.ts:164](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L164)

___

### getTranscript

▸ **getTranscript**(`transcriptId`): `Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

Get the detailed information of a specific transcript by id.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

#### Returns

`Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

A [TranscriptResponse](TranscriptResponse.md) of the full transcript object no matter it's status.

#### Defined in

[assembly-client.ts:86](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L86)

___

### getTranscriptParagraphs

▸ **getTranscriptParagraphs**(`transcriptId`): `Promise`<[`PartialTranscriptResponse`](PartialTranscriptResponse.md)\>

Query for just the paragraphs of a transcript.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

#### Returns

`Promise`<[`PartialTranscriptResponse`](PartialTranscriptResponse.md)\>

A [PartialTranscriptResponse](PartialTranscriptResponse.md) with the paragraphs of the transcript as a list of [utterances](Utterance.md).

#### Defined in

[assembly-client.ts:143](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L143)

___

### getTranscriptSentences

▸ **getTranscriptSentences**(`transcriptId`): `Promise`<[`PartialTranscriptResponse`](PartialTranscriptResponse.md)\>

Query for just the sentences of a transcript.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |

#### Returns

`Promise`<[`PartialTranscriptResponse`](PartialTranscriptResponse.md)\>

A [PartialTranscriptResponse](PartialTranscriptResponse.md) with the sentences of the transcript as a list of [utterances](Utterance.md).

#### Defined in

[assembly-client.ts:127](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L127)

___

### pollForTranscript

▸ **pollForTranscript**(`transcriptId`, `pollTimeout?`, `pollInterval?`): `Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

Poll for a transcript.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `transcriptId` | `string` | The unique identifier of your transcription. |
| `pollTimeout` | `number` | The amount of time to poll for before timing out. |
| `pollInterval` | `number` | The amount of time in ms to wait between each call to see if the transcript is complete. |

#### Returns

`Promise`<[`TranscriptResponse`](TranscriptResponse.md)\>

A [TranscriptResponse](TranscriptResponse.md) when the transcript [TranscriptResponse.status](TranscriptResponse.md#status) === `completed`.

#### Defined in

[assembly-client.ts:102](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L102)

___

### stream

▸ **stream**(`request`): `Promise`<[`StreamResponse`](StreamResponse.md)\>

If you're working with short bursts of audio, less than 15 seconds, you can send the audio data directly to the `/v2/stream` endpoint which will return a transcript to you within a few hundred milliseconds, directly in the request-response loop.

## Audio Requirements

The audio data you send to this endpoint has to comply with a strict format. This is because we don't do any transcoding to your data, we send it directly to the model for transcription. You can send the content of a `.wav` file to this endpoint, or raw data read directly from a microphone. Either way, you must record your audio in the following format to use this endpoint:

*   16-bit Signed Integer PCM encoding (ie, a .wav file)
*   8khz sampling rate
*   128kbps bitrate
*   16-bit Precision
*   Single channel
*   Headless (ie, strip any headers from wav files)
*   15 seconds or less of audio per request

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `request` | [`StreamRequest`](StreamRequest.md) | A [StreamRequest](StreamRequest.md) |

#### Returns

`Promise`<[`StreamResponse`](StreamResponse.md)\>

A [StreamResponse](StreamResponse.md). Depending on how much audio data you send, the API will respond within 100-750 milliseconds.

#### Defined in

[assembly-client.ts:230](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L230)

___

### upload

▸ **upload**(`audioUrl`): `Promise`<[`UploadRequestResponse`](UploadRequestResponse.md)\>

Upload an audio file to AssemblyAI for transcription.
The transcript can then be downloaded via [getTranscript](AssemblyClient.md#gettranscript), [pollForTranscript](AssemblyClient.md#pollfortranscript), [getTranscriptSentences](AssemblyClient.md#gettranscriptsentences), [getTranscriptParagraphs](AssemblyClient.md#gettranscriptparagraphs), and [getAllTranscripts](AssemblyClient.md#getalltranscripts).

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `audioUrl` | `string` | A URL that points to your audio file, accessible only by AssemblyAI's servers. |

#### Returns

`Promise`<[`UploadRequestResponse`](UploadRequestResponse.md)\>

An [UploadRequestResponse](UploadRequestResponse.md) with the audio_url used.

#### Defined in

[assembly-client.ts:47](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/assembly-client.ts#L47)
