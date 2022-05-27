[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / ContentSafetyResult

# Class: ContentSafetyResult

A piece of spoken audio the Content Safety Detection model flagged.

## Table of contents

### Constructors

- [constructor](ContentSafetyResult.md#constructor)

### Properties

- [labels](ContentSafetyResult.md#labels)
- [text](ContentSafetyResult.md#text)
- [timestamp](ContentSafetyResult.md#timestamp)

## Constructors

### constructor

• **new ContentSafetyResult**()

## Properties

### labels

• `Optional` **labels**: [`ContentSafetyLabel`](ContentSafetyLabel.md)[]

A list of labels the Content Safety Detection model predicted for the flagged content, as well as the `confidence` and `severity` of each label. The `confidence` score is a range between `0` and `1`, and is how confident the model was in the label it predicted. The `severity` score is also a range `0` and `1`, and indicates how severe the flagged content is, with `1` being most severe.

#### Defined in

[types/content-safety/content-safety-result.ts:15](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/content-safety-result.ts#L15)

___

### text

• `Optional` **text**: `string`

The text transcription of what was spoken that triggered the Content Safety Detection Model.

#### Defined in

[types/content-safety/content-safety-result.ts:11](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/content-safety-result.ts#L11)

___

### timestamp

• `Optional` **timestamp**: [`Timestamp`](Timestamp.md)

The start and end time, in milliseconds, for where the flagged content was spoken in the audio.

#### Defined in

[types/content-safety/content-safety-result.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/content-safety-result.ts#L19)
