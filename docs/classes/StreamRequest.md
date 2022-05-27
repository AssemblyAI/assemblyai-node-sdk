[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / StreamRequest

# Class: StreamRequest

The request used with the [AssemblyClient.stream](AssemblyClient.md#stream) function.

## Table of contents

### Constructors

- [constructor](StreamRequest.md#constructor)

### Properties

- [audio\_data](StreamRequest.md#audio_data)
- [format\_text](StreamRequest.md#format_text)
- [punctuate](StreamRequest.md#punctuate)

## Constructors

### constructor

• **new StreamRequest**()

## Properties

### audio\_data

• `Optional` **audio\_data**: `string`

Raw audio data, base64 encoded. This can be the raw data recorded directly from a microphone or read from a wav file.

**`example`** UklGRtjIAABXQVZFZ...

#### Defined in

[types/requests/stream-request.ts:9](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/stream-request.ts#L9)

___

### format\_text

• `Optional` **format\_text**: `boolean`

This is set to `false` by default; however, a developer can add auto formatting of text by setting it to `true`.

**`example`** `true`

#### Defined in

[types/requests/stream-request.ts:14](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/stream-request.ts#L14)

___

### punctuate

• `Optional` **punctuate**: `boolean`

This is set to `false` by default; however, a developer can add auto punctuation by setting it to `true`.

**`example`** `true`

#### Defined in

[types/requests/stream-request.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/stream-request.ts#L19)
