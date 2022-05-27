[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / SentimentAnalysisResult

# Class: SentimentAnalysisResult

With Sentiment Analysis, AssemblyAI can detect the sentiment of each sentence of speech spoken in your audio files.
Sentiment Analysis returns a result of POSITIVE, NEGATIVE, or NEUTRAL for each sentence in the transcript.

To include Sentiment Analysis in your transcript results, add the sentiment_analysis parameter in your POST request
when submitting files for transcription and set this parameter to true, as shown in the cURL request on the right.

Once the transcription is complete, and you get the result, there will be an additional key sentiment_analysis_results
in the JSON response.

For each sentence in the transcription text, the API will return the sentiment, confidence score, the start and end
time for when that sentence was spoken, and, if applicable, the speaker label for that sentence.
A detailed explanation of each key in the list of objects returned in the sentiment_analysis_results
array can be found in the below table.

## Table of contents

### Constructors

- [constructor](SentimentAnalysisResult.md#constructor)

### Properties

- [confidence](SentimentAnalysisResult.md#confidence)
- [end](SentimentAnalysisResult.md#end)
- [sentiment](SentimentAnalysisResult.md#sentiment)
- [speaker](SentimentAnalysisResult.md#speaker)
- [start](SentimentAnalysisResult.md#start)
- [text](SentimentAnalysisResult.md#text)

## Constructors

### constructor

• **new SentimentAnalysisResult**()

## Properties

### confidence

• `Optional` **confidence**: `number`

Confidence score for the detected sentiment, between 0.0 and 1.0.

#### Defined in

[types/sentiment-analysis-result.ts:36](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L36)

___

### end

• `Optional` **end**: `number`

Ending timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/sentiment-analysis-result.ts:28](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L28)

___

### sentiment

• `Optional` **sentiment**: `string`

The detected sentiment POSITIVE, NEGATIVE, or NEUTRAL.

#### Defined in

[types/sentiment-analysis-result.ts:32](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L32)

___

### speaker

• `Optional` **speaker**: ``null`` \| `string`

`Speaker A`, `Speaker B`, etc. if using the `speaker_labels` option.
`1` or `2` if using the `dual_channel` option.

#### Defined in

[types/sentiment-analysis-result.ts:41](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L41)

___

### start

• `Optional` **start**: `number`

Starting timestamp (in milliseconds) of the text in the transcript.

#### Defined in

[types/sentiment-analysis-result.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L24)

___

### text

• `Optional` **text**: `string`

The transcription text of the sentence being analyzed

#### Defined in

[types/sentiment-analysis-result.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/sentiment-analysis-result.ts#L20)
