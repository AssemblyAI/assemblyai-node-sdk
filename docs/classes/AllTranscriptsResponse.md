[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / AllTranscriptsResponse

# Class: AllTranscriptsResponse

A paginated list of all your transcripts.

## Table of contents

### Constructors

- [constructor](AllTranscriptsResponse.md#constructor)

### Properties

- [httpClient](AllTranscriptsResponse.md#httpclient)
- [page\_details](AllTranscriptsResponse.md#page_details)
- [transcripts](AllTranscriptsResponse.md#transcripts)

### Methods

- [nextPage](AllTranscriptsResponse.md#nextpage)
- [prevPage](AllTranscriptsResponse.md#prevpage)

## Constructors

### constructor

• **new AllTranscriptsResponse**(`authenticatedHttpClient`, `data`)

Creates an instance of AllTranscriptsResponse.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `authenticatedHttpClient` | `Axios` | The authenticated http client used to make the request |
| `data` | [`AllTranscriptsResponse`](AllTranscriptsResponse.md) | The data returned from the initial request |

#### Defined in

[types/responses/all-transcripts-response.ts:14](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L14)

## Properties

### httpClient

• **httpClient**: `Axios`

The authenticated http client.

#### Defined in

[types/responses/all-transcripts-response.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L23)

___

### page\_details

• `Optional` **page\_details**: [`PageDetails`](PageDetails.md)

The [pageDetails](PageDetails.md) of the current response.

#### Defined in

[types/responses/all-transcripts-response.ts:27](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L27)

___

### transcripts

• `Optional` **transcripts**: [`TranscriptResponse`](TranscriptResponse.md)[]

A list of the [transcripts](TranscriptResponse.md) for the current response.

#### Defined in

[types/responses/all-transcripts-response.ts:31](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L31)

## Methods

### nextPage

▸ **nextPage**(): `Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

Get the next page of transcript results.

#### Returns

`Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

A promise that resolves an [AllTranscriptsResponse](AllTranscriptsResponse.md)

#### Defined in

[types/responses/all-transcripts-response.ts:37](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L37)

___

### prevPage

▸ **prevPage**(): `Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

Get the previous page of transcript results.

#### Returns

`Promise`<[`AllTranscriptsResponse`](AllTranscriptsResponse.md)\>

A promise that resolves an [AllTranscriptsResponse](AllTranscriptsResponse.md)

#### Defined in

[types/responses/all-transcripts-response.ts:54](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/all-transcripts-response.ts#L54)
