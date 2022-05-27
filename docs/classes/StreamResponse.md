[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / StreamResponse

# Class: StreamResponse

The response from a call to the `/v2/stream` endpoint.
The [AssemblyClient.stream](AssemblyClient.md#stream) function returns this response.

## Table of contents

### Constructors

- [constructor](StreamResponse.md#constructor)

### Properties

- [confidence](StreamResponse.md#confidence)
- [created](StreamResponse.md#created)
- [id](StreamResponse.md#id)
- [status](StreamResponse.md#status)
- [text](StreamResponse.md#text)
- [words](StreamResponse.md#words)

## Constructors

### constructor

• **new StreamResponse**()

## Properties

### confidence

• `Optional` **confidence**: `number`

The confidence score of the entire transcription, between 0 and 1.

#### Defined in

[types/responses/stream-response.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L23)

___

### created

• `Optional` **created**: `Date`

The timestamp for your request.

#### Defined in

[types/responses/stream-response.ts:31](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L31)

___

### id

• `Optional` **id**: `string`

The unique id of your transcription.

#### Defined in

[types/responses/stream-response.ts:11](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L11)

___

### status

• `Optional` **status**: `string`

The status of your transcription.

#### Defined in

[types/responses/stream-response.ts:15](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L15)

___

### text

• `Optional` **text**: `string`

The complete transcription for your audio.

#### Defined in

[types/responses/stream-response.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L19)

___

### words

• `Optional` **words**: [`Word`](Word.md)[]

An array of objects, with the information for each [word](Word.md) in the transcription text. Will include the start/end time (in milliseconds) of the word and the confidence score of the word.

#### Defined in

[types/responses/stream-response.ts:27](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/stream-response.ts#L27)
