# Class: Word

An individual word transcribed.

## Table of contents

### Constructors

- [constructor](../wiki/Word#constructor)

### Properties

- [channel](../wiki/Word#channel)
- [confidence](../wiki/Word#confidence)
- [end](../wiki/Word#end)
- [speaker](../wiki/Word#speaker)
- [start](../wiki/Word#start)
- [text](../wiki/Word#text)

## Constructors

### constructor

• **new Word**()

## Properties

### channel

• `Optional` **channel**: `string`

`1` or `2` if using the `dual_channel` option.

#### Defined in

[types/word.ts:29](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L29)

___

### confidence

• `Optional` **confidence**: `number`

The confidence in the transcribed text, between 0.0 and 1.0.

#### Defined in

[types/word.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L20)

___

### end

• `Optional` **end**: `number`

Ending timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/word.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L16)

___

### speaker

• `Optional` **speaker**: `string`

`Speaker A`, `Speaker B`, etc. if using the `speaker_labels` option.
`1` or `2` if using the `dual_channel` option.

#### Defined in

[types/word.ts:25](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L25)

___

### start

• `Optional` **start**: `number`

Starting timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/word.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L12)

___

### text

• `Optional` **text**: `string`

The text of the word.

#### Defined in

[types/word.ts:8](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/word.ts#L8)
