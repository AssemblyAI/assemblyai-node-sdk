[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / PageDetails

# Class: PageDetails

The details about the current page of an [AllTranscriptsResponse](AllTranscriptsResponse.md).

## Table of contents

### Constructors

- [constructor](PageDetails.md#constructor)

### Properties

- [current\_url](PageDetails.md#current_url)
- [limit](PageDetails.md#limit)
- [next\_url](PageDetails.md#next_url)
- [prev\_url](PageDetails.md#prev_url)
- [result\_count](PageDetails.md#result_count)

## Constructors

### constructor

• **new PageDetails**()

## Properties

### current\_url

• `Optional` **current\_url**: `string`

The url of the current page of results.

#### Defined in

[types/responses/page-details.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/page-details.ts#L16)

___

### limit

• `Optional` **limit**: `number`

Max results to return in a single response, between 1 and 200 inclusive.

#### Defined in

[types/responses/page-details.ts:8](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/page-details.ts#L8)

___

### next\_url

• `Optional` **next\_url**: `string`

The url to get the next page of results.

#### Defined in

[types/responses/page-details.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/page-details.ts#L24)

___

### prev\_url

• `Optional` **prev\_url**: `string`

The url to get the previous page of results.

#### Defined in

[types/responses/page-details.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/page-details.ts#L20)

___

### result\_count

• `Optional` **result\_count**: `number`

The number of transcripts returned in the current response.

#### Defined in

[types/responses/page-details.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/page-details.ts#L12)
