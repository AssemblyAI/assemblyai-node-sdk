[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / PartialTranscriptResponse

# Class: PartialTranscriptResponse

A response object to handle requests to get the sentences or paragraphs of a transcript.
https://api.assemblyai.com/v2/transcript/:id/sentences
https://api.assemblyai.com/v2/transcript/:id/paragraphs

## Table of contents

### Constructors

- [constructor](PartialTranscriptResponse.md#constructor)

### Properties

- [audio\_duration](PartialTranscriptResponse.md#audio_duration)
- [confidence](PartialTranscriptResponse.md#confidence)
- [id](PartialTranscriptResponse.md#id)
- [paragraphs](PartialTranscriptResponse.md#paragraphs)
- [sentences](PartialTranscriptResponse.md#sentences)

## Constructors

### constructor

• **new PartialTranscriptResponse**()

## Properties

### audio\_duration

• `Optional` **audio\_duration**: `number`

The duration of the media file, in seconds.

#### Defined in

[types/responses/partial-transcript-response.ts:28](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/partial-transcript-response.ts#L28)

___

### confidence

• `Optional` **confidence**: `number`

The confidence in the transcribed text, between 0.0 and 1.0.

#### Defined in

[types/responses/partial-transcript-response.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/partial-transcript-response.ts#L24)

___

### id

• `Optional` **id**: `string`

The unique id of your transcription.

#### Defined in

[types/responses/partial-transcript-response.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/partial-transcript-response.ts#L12)

___

### paragraphs

• `Optional` **paragraphs**: [`Utterance`](Utterance.md)[]

A list of [utterances](Utterance.md) where each utterance is an individual paragraph from the transcript.

#### Defined in

[types/responses/partial-transcript-response.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/partial-transcript-response.ts#L20)

___

### sentences

• `Optional` **sentences**: [`Utterance`](Utterance.md)[]

A list of [utterances](Utterance.md) where each utterance is an individual sentence from the transcript.

#### Defined in

[types/responses/partial-transcript-response.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/partial-transcript-response.ts#L16)
