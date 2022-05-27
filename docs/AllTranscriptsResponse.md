# Class: AllTranscriptsResponse

A paginated list of all your transcripts.

## Table of contents

### Constructors

- [constructor](../wiki/AllTranscriptsResponse#constructor)

### Properties

- [httpClient](../wiki/AllTranscriptsResponse#httpclient)
- [page\_details](../wiki/AllTranscriptsResponse#page_details)
- [transcripts](../wiki/AllTranscriptsResponse#transcripts)

### Methods

- [nextPage](../wiki/AllTranscriptsResponse#nextpage)
- [prevPage](../wiki/AllTranscriptsResponse#prevpage)

## Constructors

### constructor

• **new AllTranscriptsResponse**(`authenticatedHttpClient`, `data`)

Creates an instance of AllTranscriptsResponse.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `authenticatedHttpClient` | `Axios` | The authenticated http client used to make the request |
| `data` | [`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse) | The data returned from the initial request |

#### Defined in

[types/responses/all-transcripts-response.ts:14](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L14)

## Properties

### httpClient

• **httpClient**: `Axios`

The authenticated http client.

#### Defined in

[types/responses/all-transcripts-response.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L23)

___

### page\_details

• `Optional` **page\_details**: [`PageDetails`](../wiki/PageDetails)

The [pageDetails](../wiki/PageDetails) of the current response.

#### Defined in

[types/responses/all-transcripts-response.ts:27](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L27)

___

### transcripts

• `Optional` **transcripts**: [`TranscriptResponse`](../wiki/TranscriptResponse)[]

A list of the [transcripts](../wiki/TranscriptResponse) for the current response.

#### Defined in

[types/responses/all-transcripts-response.ts:31](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L31)

## Methods

### nextPage

▸ **nextPage**(): `Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

Get the next page of transcript results.

#### Returns

`Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

A promise that resolves an [AllTranscriptsResponse](../wiki/AllTranscriptsResponse)

#### Defined in

[types/responses/all-transcripts-response.ts:37](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L37)

___

### prevPage

▸ **prevPage**(): `Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

Get the previous page of transcript results.

#### Returns

`Promise`<[`AllTranscriptsResponse`](../wiki/AllTranscriptsResponse)\>

A promise that resolves an [AllTranscriptsResponse](../wiki/AllTranscriptsResponse)

#### Defined in

[types/responses/all-transcripts-response.ts:54](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/responses/all-transcripts-response.ts#L54)
