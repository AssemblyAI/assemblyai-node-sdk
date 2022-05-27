# Class: PageDetails

The details about the current page of an [AllTranscriptsResponse](../wiki/AllTranscriptsResponse).

## Table of contents

### Constructors

- [constructor](../wiki/PageDetails#constructor)

### Properties

- [current\_url](../wiki/PageDetails#current_url)
- [limit](../wiki/PageDetails#limit)
- [next\_url](../wiki/PageDetails#next_url)
- [prev\_url](../wiki/PageDetails#prev_url)
- [result\_count](../wiki/PageDetails#result_count)

## Constructors

### constructor

• **new PageDetails**()

## Properties

### current\_url

• `Optional` **current\_url**: `string`

The url of the current page of results.

#### Defined in

[types/responses/page-details.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/page-details.ts#L16)

___

### limit

• `Optional` **limit**: `number`

Max results to return in a single response, between 1 and 200 inclusive.

#### Defined in

[types/responses/page-details.ts:8](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/page-details.ts#L8)

___

### next\_url

• `Optional` **next\_url**: `string`

The url to get the next page of results.

#### Defined in

[types/responses/page-details.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/page-details.ts#L24)

___

### prev\_url

• `Optional` **prev\_url**: `string`

The url to get the previous page of results.

#### Defined in

[types/responses/page-details.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/page-details.ts#L20)

___

### result\_count

• `Optional` **result\_count**: `number`

The number of transcripts returned in the current response.

#### Defined in

[types/responses/page-details.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/page-details.ts#L12)
