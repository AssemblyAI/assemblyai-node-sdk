# Class: AutoHighlight

A highlight found in your transcription text.

## Table of contents

### Constructors

- [constructor](../wiki/AutoHighlight#constructor)

### Properties

- [count](../wiki/AutoHighlight#count)
- [rank](../wiki/AutoHighlight#rank)
- [text](../wiki/AutoHighlight#text)
- [timestamps](../wiki/AutoHighlight#timestamps)

## Constructors

### constructor

• **new AutoHighlight**()

## Properties

### count

• `Optional` **count**: `number`

How many times this phrase occurred in the text.

#### Defined in

[types/auto-highlights/auto-highlight.ts:10](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/auto-highlights/auto-highlight.ts#L10)

___

### rank

• `Optional` **rank**: `number`

The relevancy of this phrase - the higher the score, the better.

#### Defined in

[types/auto-highlights/auto-highlight.ts:14](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/auto-highlights/auto-highlight.ts#L14)

___

### text

• `Optional` **text**: `string`

The phrase/word itself that was detected.

#### Defined in

[types/auto-highlights/auto-highlight.ts:18](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/auto-highlights/auto-highlight.ts#L18)

___

### timestamps

• `Optional` **timestamps**: [`Timestamp`](../wiki/Timestamp)[]

A list of all the timestamps, in milliseconds, in the audio where each phrase/word is spoken.

#### Defined in

[types/auto-highlights/auto-highlight.ts:22](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/auto-highlights/auto-highlight.ts#L22)
