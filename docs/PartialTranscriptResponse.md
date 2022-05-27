# Class: PartialTranscriptResponse

A response object to handle requests to get the sentences or paragraphs of a transcript.
https://api.assemblyai.com/v2/transcript/:id/sentences
https://api.assemblyai.com/v2/transcript/:id/paragraphs

## Table of contents

### Constructors

- [constructor](../wiki/PartialTranscriptResponse#constructor)

### Properties

- [audio\_duration](../wiki/PartialTranscriptResponse#audio_duration)
- [confidence](../wiki/PartialTranscriptResponse#confidence)
- [id](../wiki/PartialTranscriptResponse#id)
- [paragraphs](../wiki/PartialTranscriptResponse#paragraphs)
- [sentences](../wiki/PartialTranscriptResponse#sentences)

## Constructors

### constructor

• **new PartialTranscriptResponse**()

## Properties

### audio\_duration

• `Optional` **audio\_duration**: `number`

The duration of the media file, in seconds.

#### Defined in

[types/responses/partial-transcript-response.ts:28](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/partial-transcript-response.ts#L28)

___

### confidence

• `Optional` **confidence**: `number`

The confidence in the transcribed text, between 0.0 and 1.0.

#### Defined in

[types/responses/partial-transcript-response.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/partial-transcript-response.ts#L24)

___

### id

• `Optional` **id**: `string`

The unique id of your transcription.

#### Defined in

[types/responses/partial-transcript-response.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/partial-transcript-response.ts#L12)

___

### paragraphs

• `Optional` **paragraphs**: [`Utterance`](../wiki/Utterance)[]

A list of [utterances](../wiki/Utterance) where each utterance is an individual paragraph from the transcript.

#### Defined in

[types/responses/partial-transcript-response.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/partial-transcript-response.ts#L20)

___

### sentences

• `Optional` **sentences**: [`Utterance`](../wiki/Utterance)[]

A list of [utterances](../wiki/Utterance) where each utterance is an individual sentence from the transcript.

#### Defined in

[types/responses/partial-transcript-response.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/partial-transcript-response.ts#L16)
