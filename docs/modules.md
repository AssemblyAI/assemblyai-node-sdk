[@phillipchaffee/assemblyai-v2-node-sdk](README.md) / Exports

# @phillipchaffee/assemblyai-v2-node-sdk

## Table of contents

### Classes

- [AllTranscriptsResponse](classes/AllTranscriptsResponse.md)
- [AssemblyClient](classes/AssemblyClient.md)
- [AutoHighlight](classes/AutoHighlight.md)
- [AutoHighlightsResult](classes/AutoHighlightsResult.md)
- [Chapter](classes/Chapter.md)
- [ContentSafetyLabel](classes/ContentSafetyLabel.md)
- [ContentSafetyLabels](classes/ContentSafetyLabels.md)
- [ContentSafetyResult](classes/ContentSafetyResult.md)
- [CustomSpelling](classes/CustomSpelling.md)
- [Entity](classes/Entity.md)
- [IabCategoriesResult](classes/IabCategoriesResult.md)
- [IabCategory](classes/IabCategory.md)
- [IabCategoryLabel](classes/IabCategoryLabel.md)
- [PageDetails](classes/PageDetails.md)
- [PartialTranscriptResponse](classes/PartialTranscriptResponse.md)
- [SentimentAnalysisResult](classes/SentimentAnalysisResult.md)
- [SeverityScore](classes/SeverityScore.md)
- [StreamRequest](classes/StreamRequest.md)
- [StreamResponse](classes/StreamResponse.md)
- [Timestamp](classes/Timestamp.md)
- [TranscriptRequest](classes/TranscriptRequest.md)
- [TranscriptResponse](classes/TranscriptResponse.md)
- [UploadRequestResponse](classes/UploadRequestResponse.md)
- [Utterance](classes/Utterance.md)
- [Word](classes/Word.md)

### Type aliases

- [ContentSafetySummary](modules.md#contentsafetysummary)
- [IabCategoriesSummary](modules.md#iabcategoriessummary)
- [SeverityScoreSummary](modules.md#severityscoresummary)

## Type aliases

### ContentSafetySummary

Ƭ **ContentSafetySummary**: `Record`<`string`, `number`\>

For each label that was predicted in the `results` set, the `summary` key provides the confidence of each label in relation to the entire audio file. For example, there could be a single result of `disasters` with `0.99` confidence, but if this was a single result in a 3 hour audio file, the `summary` would show a low confidence for `disasters` - indicating that `disasters` is not spoken of widely throughout the entire audio file.

#### Defined in

[types/content-safety/content-safety-summary.ts:4](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/content-safety-summary.ts#L4)

___

### IabCategoriesSummary

Ƭ **IabCategoriesSummary**: `Record`<`string`, `number`\>

For each unique topic label detected in the `results` array, the `summary` key will show the relevancy for that label across the entire audio file. For example, if the `Science>Environment` label is detected only 1 time in a 60 minute audio file, the `summary` key will show a low relevancy score for that label, since the entire transcription was not found to consistently be about `Science>Environment`.

#### Defined in

[types/iab-categories/iab-categories-summary.ts:4](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/iab-categories/iab-categories-summary.ts#L4)

___

### SeverityScoreSummary

Ƭ **SeverityScoreSummary**: `Record`<`string`, [`SeverityScore`](classes/SeverityScore.md)\>

The `severity_score_summary` key lists each label that was detected along with `low`, `medium`, and `high` keys.
```
    "severity_score_summary": {
        "health_issues": {
            "low": 0.7210625030587972,
            "medium": 0.2789374969412028,
            "high": 0.0
        }
    }
```
The value of the `low`, `medium`, and `high` keys reflect the API's confidence that the label is "low," "medium," or "high" in severity throughout the entire audio file. This score is based on the intersection of the length of the audio file, the frequency of `low`/`medium`/`high` severity tags through the file, and the `confidence` score for each of those occurrences.

#### Defined in

[types/content-safety/severity-score-summary.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/content-safety/severity-score-summary.ts#L16)
