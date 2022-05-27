[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / SeverityScore

# Class: SeverityScore

The severity score for a single label in the [SeverityScoreSummary](../modules.md#severityscoresummary).

## Table of contents

### Constructors

- [constructor](SeverityScore.md#constructor)

### Properties

- [high](SeverityScore.md#high)
- [low](SeverityScore.md#low)
- [medium](SeverityScore.md#medium)

## Constructors

### constructor

• **new SeverityScore**()

## Properties

### high

• `Optional` **high**: `number`

The confidence that the label is "high" in severity throughout the entire audio file.

#### Defined in

[types/content-safety/severity-score.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/severity-score.ts#L16)

___

### low

• `Optional` **low**: `number`

The confidence that the label is "low" in severity throughout the entire audio file.

#### Defined in

[types/content-safety/severity-score.ts:8](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/severity-score.ts#L8)

___

### medium

• `Optional` **medium**: `number`

The confidence that the label is "medium" in severity throughout the entire audio file.

#### Defined in

[types/content-safety/severity-score.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/severity-score.ts#L12)
