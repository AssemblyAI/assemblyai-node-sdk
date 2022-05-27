[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / IabCategoriesResult

# Class: IabCategoriesResult

With **Topic Detection**, AssemblyAI can label the topics that are spoken in your audio/video files. The predicted topic labels follow the standardized [IAB Taxonomy](https://www.iab.com/guidelines/content-taxonomy/ "null"), which makes them suitable for Contextual Targeting use cases. The below table shows the 698 potential topics the API can predict.

Simply include the `iab_categories` parameter in your `POST` request when submitting audio files for transcription, and set this parameter to `true`, as shown in the cURL request on the right.

Once the transcription is complete, and you [get the transcription result](/walkthroughs#getting-the-transcription-result "null"), there will be an additional key `iab_categories_result` in the JSON response. Below, we drill into that key and what data it includes.

## Table of contents

### Constructors

- [constructor](IabCategoriesResult.md#constructor)

### Properties

- [results](IabCategoriesResult.md#results)
- [status](IabCategoriesResult.md#status)
- [summary](IabCategoriesResult.md#summary)

## Constructors

### constructor

• **new IabCategoriesResult**()

## Properties

### results

• `Optional` **results**: [`IabCategory`](IabCategory.md)[]

The list of topics that were predicted for the audio file, including the text that influenced each topic label prediction, and other metadata about relevancy and timestamps.

#### Defined in

[types/iab-categories/iab-categories-result.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/iab-categories/iab-categories-result.ts#L19)

___

### status

• `Optional` **status**: `string`

Will be either <code>"success"</code>, or <code>"unavailable"</code> in the rare case that the Topic Detection model failed.

#### Defined in

[types/iab-categories/iab-categories-result.ts:15](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/iab-categories/iab-categories-result.ts#L15)

___

### summary

• `Optional` **summary**: [`IabCategoriesSummary`](../modules.md#iabcategoriessummary)

For each unique topic label detected in the `results` array, the `summary` key will show the relevancy for that label across the entire audio file. For example, if the `Science>Environment` label is detected only 1 time in a 60 minute audio file, the `summary` key will show a low relevancy score for that label, since the entire transcription was not found to consistently be about `Science>Environment`.

#### Defined in

[types/iab-categories/iab-categories-result.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/iab-categories/iab-categories-result.ts#L23)
