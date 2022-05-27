# Class: IabCategory

A topic that was predicted for the audio file, including the text that influenced the topic label prediction, and other metadata about relevancy and timestamps.

## Table of contents

### Constructors

- [constructor](../wiki/IabCategory#constructor)

### Properties

- [labels](../wiki/IabCategory#labels)
- [text](../wiki/IabCategory#text)
- [timestamp](../wiki/IabCategory#timestamp)

## Constructors

### constructor

• **new IabCategory**()

## Properties

### labels

• `Optional` **labels**: [`IabCategoryLabel`](../wiki/IabCategoryLabel)[]

The list of labels that were predicted for this portion of text. The `relevance` key gives a score between `0` and `1.0` for how relevant each label is for the portion of text.

#### Defined in

[types/iab-categories/iab-category.ts:15](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/iab-categories/iab-category.ts#L15)

___

### text

• `Optional` **text**: `string`

The transcription text for the portion of audio that was classified with topic labels.

#### Defined in

[types/iab-categories/iab-category.ts:11](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/iab-categories/iab-category.ts#L11)

___

### timestamp

• `Optional` **timestamp**: [`Timestamp`](../wiki/Timestamp)

The start and end time, in milliseconds, for where the portion of text in `results.text` was spoken in the audio file.

#### Defined in

[types/iab-categories/iab-category.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/iab-categories/iab-category.ts#L19)
