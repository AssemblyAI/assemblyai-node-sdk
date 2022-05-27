[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / Utterance

# Class: Utterance

A single "turn" in the conversation.
A "turn" refers to a change in speakers.
Only returned when using the `speaker_labels` or `dual_channel` options.

## Table of contents

### Constructors

- [constructor](Utterance.md#constructor)

### Properties

- [channel](Utterance.md#channel)
- [confidence](Utterance.md#confidence)
- [end](Utterance.md#end)
- [speaker](Utterance.md#speaker)
- [start](Utterance.md#start)
- [text](Utterance.md#text)
- [words](Utterance.md#words)

## Constructors

### constructor

• **new Utterance**()

## Properties

### channel

• `Optional` **channel**: `string`

`1` or `2` if using the `dual_channel` option.

#### Defined in

[types/utterance.ts:33](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L33)

___

### confidence

• `Optional` **confidence**: `number`

The confidence in the transcribed text, between 0.0 and 1.0.

#### Defined in

[types/utterance.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L24)

___

### end

• `Optional` **end**: `number`

Ending timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/utterance.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L20)

___

### speaker

• `Optional` **speaker**: `string`

`Speaker A`, `Speaker B`, etc. if using the `speaker_labels` option.
`1` or `2` if using the `dual_channel` option.

#### Defined in

[types/utterance.ts:29](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L29)

___

### start

• `Optional` **start**: `number`

Starting timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/utterance.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L16)

___

### text

• `Optional` **text**: `string`

The text of the utterance.

#### Defined in

[types/utterance.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L12)

___

### words

• `Optional` **words**: [`Word`](Word.md)[]

An array of the individual [words](Word.md) in the utterance.

#### Defined in

[types/utterance.ts:37](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/utterance.ts#L37)
