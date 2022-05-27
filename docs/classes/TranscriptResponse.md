[@phillipchaffee/assemblyai-v2-node-sdk](../README.md) / [Exports](../modules.md) / TranscriptResponse

# Class: TranscriptResponse

This is an object representing a transcription. You can create them, retrieve them to see their status and results, and delete them.

## Hierarchy

- [`TranscriptRequest`](TranscriptRequest.md)

  ↳ **`TranscriptResponse`**

## Table of contents

### Constructors

- [constructor](TranscriptResponse.md#constructor)

### Properties

- [audio\_duration](TranscriptResponse.md#audio_duration)
- [audio\_end\_at](TranscriptResponse.md#audio_end_at)
- [audio\_start\_from](TranscriptResponse.md#audio_start_from)
- [audio\_url](TranscriptResponse.md#audio_url)
- [auto\_chapters](TranscriptResponse.md#auto_chapters)
- [auto\_highlights\_result](TranscriptResponse.md#auto_highlights_result)
- [boost\_param](TranscriptResponse.md#boost_param)
- [chapters](TranscriptResponse.md#chapters)
- [confidence](TranscriptResponse.md#confidence)
- [content\_safety](TranscriptResponse.md#content_safety)
- [content\_safety\_labels](TranscriptResponse.md#content_safety_labels)
- [custom\_spelling](TranscriptResponse.md#custom_spelling)
- [disfluencies](TranscriptResponse.md#disfluencies)
- [dual\_channel](TranscriptResponse.md#dual_channel)
- [entities](TranscriptResponse.md#entities)
- [entity\_detection](TranscriptResponse.md#entity_detection)
- [error](TranscriptResponse.md#error)
- [filter\_profanity](TranscriptResponse.md#filter_profanity)
- [format\_text](TranscriptResponse.md#format_text)
- [iab\_categories](TranscriptResponse.md#iab_categories)
- [iab\_categories\_result](TranscriptResponse.md#iab_categories_result)
- [id](TranscriptResponse.md#id)
- [language\_code](TranscriptResponse.md#language_code)
- [punctuate](TranscriptResponse.md#punctuate)
- [redact\_pii](TranscriptResponse.md#redact_pii)
- [redact\_pii\_audio](TranscriptResponse.md#redact_pii_audio)
- [redact\_pii\_policies](TranscriptResponse.md#redact_pii_policies)
- [redact\_pii\_sub](TranscriptResponse.md#redact_pii_sub)
- [sentiment\_analysis](TranscriptResponse.md#sentiment_analysis)
- [sentiment\_analysis\_results](TranscriptResponse.md#sentiment_analysis_results)
- [speaker\_labels](TranscriptResponse.md#speaker_labels)
- [status](TranscriptResponse.md#status)
- [text](TranscriptResponse.md#text)
- [utterances](TranscriptResponse.md#utterances)
- [webhook\_status\_code](TranscriptResponse.md#webhook_status_code)
- [webhook\_url](TranscriptResponse.md#webhook_url)
- [word\_boost](TranscriptResponse.md#word_boost)
- [words](TranscriptResponse.md#words)

## Constructors

### constructor

• **new TranscriptResponse**(`audioUrl`)

Creates an instance of TranscriptRequest.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `audioUrl` | `string` | The URL of your media file to transcribe. |

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[constructor](TranscriptRequest.md#constructor)

#### Defined in

[types/requests/transcript-request.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L12)

## Properties

### audio\_duration

• `Optional` **audio\_duration**: `number`

The duration of your media file, in seconds.

#### Defined in

[types/responses/transcript-response.ts:46](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L46)

___

### audio\_end\_at

• `Optional` **audio\_end\_at**: `number`

The point in time, in milliseconds, to stop transcribing in your media file.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[audio_end_at](TranscriptRequest.md#audio_end_at)

#### Defined in

[types/requests/transcript-request.ts:47](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L47)

___

### audio\_start\_from

• `Optional` **audio\_start\_from**: `number`

The point in time, in milliseconds, to begin transcription from in your media file.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[audio_start_from](TranscriptRequest.md#audio_start_from)

#### Defined in

[types/requests/transcript-request.ts:43](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L43)

___

### audio\_url

• **audio\_url**: `string`

The URL of your media file to transcribe.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[audio_url](TranscriptRequest.md#audio_url)

#### Defined in

[types/requests/transcript-request.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L19)

___

### auto\_chapters

• `Optional` **auto\_chapters**: `boolean`

Enable Auto Chapters, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[auto_chapters](TranscriptRequest.md#auto_chapters)

#### Defined in

[types/requests/transcript-request.ts:139](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L139)

___

### auto\_highlights\_result

• `Optional` **auto\_highlights\_result**: [`AutoHighlightsResult`](AutoHighlightsResult.md)

The list of results when enabling Automatic Transcript Highlights.

#### Defined in

[types/responses/transcript-response.ts:54](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L54)

___

### boost\_param

• `Optional` **boost\_param**: `string`

The weight to apply to words/phrases in the `word_boost` array; can be `"low"`, `"default"`, or `"high"`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[boost_param](TranscriptRequest.md#boost_param)

#### Defined in

[types/requests/transcript-request.ts:55](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L55)

___

### chapters

• `Optional` **chapters**: [`Chapter`](Chapter.md)[]

When Auto Chapters is enabled, the list of Auto Chapters results.

#### Defined in

[types/responses/transcript-response.ts:66](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L66)

___

### confidence

• `Optional` **confidence**: `number`

The confidence our model has in the transcribed text, between 0.0 and 1.0.

#### Defined in

[types/responses/transcript-response.ts:42](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L42)

___

### content\_safety

• `Optional` **content\_safety**: `boolean`

Enable Content Safety Detection, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[content_safety](TranscriptRequest.md#content_safety)

#### Defined in

[types/requests/transcript-request.ts:119](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L119)

___

### content\_safety\_labels

• `Optional` **content\_safety\_labels**: [`ContentSafetyLabels`](ContentSafetyLabels.md)

The list of results when [TranscriptRequest.content_safety](TranscriptRequest.md#content_safety) is `true`.

#### Defined in

[types/responses/transcript-response.ts:58](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L58)

___

### custom\_spelling

• `Optional` **custom\_spelling**: [`CustomSpelling`](CustomSpelling.md)[]

Customize how words are spelled and formatted using `to` and `from` values.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[custom_spelling](TranscriptRequest.md#custom_spelling)

#### Defined in

[types/requests/transcript-request.ts:127](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L127)

___

### disfluencies

• `Optional` **disfluencies**: `boolean`

Transcribe Filler Words, like "umm", in your media file; can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[disfluencies](TranscriptRequest.md#disfluencies)

#### Defined in

[types/requests/transcript-request.ts:131](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L131)

___

### dual\_channel

• `Optional` **dual\_channel**: `boolean`

Enable Dual Channel transcription, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[dual_channel](TranscriptRequest.md#dual_channel)

#### Defined in

[types/requests/transcript-request.ts:35](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L35)

___

### entities

• `Optional` **entities**: [`Entity`](Entity.md)[]

When Entity Detection is enabled, the list of detected Entities.

#### Defined in

[types/responses/transcript-response.ts:74](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L74)

___

### entity\_detection

• `Optional` **entity\_detection**: `boolean`

Enable Entity Detection, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[entity_detection](TranscriptRequest.md#entity_detection)

#### Defined in

[types/requests/transcript-request.ts:143](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L143)

___

### error

• `Optional` **error**: `string`

The error message if the transcript status is `error`.

#### Defined in

[types/responses/transcript-response.ts:26](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L26)

___

### filter\_profanity

• `Optional` **filter\_profanity**: `boolean`

Filter profanity from the transcribed text, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[filter_profanity](TranscriptRequest.md#filter_profanity)

#### Defined in

[types/requests/transcript-request.ts:59](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L59)

___

### format\_text

• `Optional` **format\_text**: `boolean`

Enable Text Formatting, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[format_text](TranscriptRequest.md#format_text)

#### Defined in

[types/requests/transcript-request.ts:31](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L31)

___

### iab\_categories

• `Optional` **iab\_categories**: `boolean`

Enable Topic Detection, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[iab_categories](TranscriptRequest.md#iab_categories)

#### Defined in

[types/requests/transcript-request.ts:123](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L123)

___

### iab\_categories\_result

• `Optional` **iab\_categories\_result**: [`IabCategoriesResult`](IabCategoriesResult.md)

Enable Topic Detection, can be `true` or `false`.

#### Defined in

[types/responses/transcript-response.ts:62](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L62)

___

### id

• `Optional` **id**: `string`

The unique identifier of your transcription.

#### Defined in

[types/responses/transcript-response.ts:18](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L18)

___

### language\_code

• `Optional` **language\_code**: `string`

The language of your audio file. Possible values are found in [Supported Languages](/#supported-languages "null"). The default value is `en_us`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[language_code](TranscriptRequest.md#language_code)

#### Defined in

[types/requests/transcript-request.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L23)

___

### punctuate

• `Optional` **punctuate**: `boolean`

Enable Automatic Punctuation, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[punctuate](TranscriptRequest.md#punctuate)

#### Defined in

[types/requests/transcript-request.ts:27](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L27)

___

### redact\_pii

• `Optional` **redact\_pii**: `boolean`

Redact PII from the transcribed text, can be `true` or `false`.

With PII Redaction, the API can automatically remove **Personally Identifiable Information (PII)**, such as phone numbers and social security numbers, from the transcription text before it is returned to you.

All redacted text will be replaced with `#` characters. For example, if the phone number `111-2222` was spoken in the audio, it would be transcribed as `###-####` in the text.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[redact_pii](TranscriptRequest.md#redact_pii)

#### Defined in

[types/requests/transcript-request.ts:67](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L67)

___

### redact\_pii\_audio

• `Optional` **redact\_pii\_audio**: `boolean`

Generate a copy of the original media file with spoken PII "beeped" out, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[redact_pii_audio](TranscriptRequest.md#redact_pii_audio)

#### Defined in

[types/requests/transcript-request.ts:71](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L71)

___

### redact\_pii\_policies

• `Optional` **redact\_pii\_policies**: `string`[]

The list of PII Redaction policies to enable.

To best-fit PII Redaction to your use case and data, you can select from a set of redaction policies when using PII Redaction. Simply include any or some of the below policy names in the `redact_pii_policies` array when making your POST request as shown on the right.

| Policy Name               | Description                                                                                                                   |
|---------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| medical_process           | Medical process, including treatments, procedures, and tests (e.g., heart surgery, CT scan)                                   |
| medical_condition         | Name of a medical condition, disease, syndrome, deficit, or disorder (e.g., chronic fatigue syndrome, arrhythmia, depression) |
| blood_type                | Blood type (e.g., O-, AB positive)                                                                                            |
| drug                      | Medications, vitamins, or supplements (e.g., Advil, Acetaminophen, Panadol)                                                   |
| injury                    | Bodily injury (e.g., I broke my arm, I have a sprained wrist)                                                                 |
| number_sequence           | A "lazy" rule that will redact any sequence of numbers equal to or greater than 2                                             |
| email_address             | Email address (e.g., [support@assemblyai.com](mailto:support@assemblyai.com "undefined")))                                                                                  |
| date_of_birth             | Date of Birth (e.g., Date of Birth: March 7,1961)                                                                             |
| phone_number              | Telephone or fax number                                                                                                       |
| us_social_security_number | Social Security Number or equivalent                                                                                          |
| credit_card_number        | Credit card number                                                                                                            |
| credit_card_expiration    | Expiration date of a credit card                                                                                              |
| credit_card_cvv           | Credit card verification code (e.g., CVV: 080)                                                                                |
| date                      | Specific calendar date (e.g., December 18)                                                                                    |
| nationality               | Terms indicating nationality, ethnicity, or race (e.g., American, Asian, Caucasian)                                           |
| event                     | Name of an event or holiday (e.g., Olympics, Yom Kippur)                                                                      |
| language                  | Name of a natural language (e.g., Spanish, French)                                                                            |
| location                  | Any Location reference including mailing address, postal code, city, state, province, or country                              |
| money_amount              | Name and/or amount of currency (e.g., 15 pesos, $94.50)                                                                       |
| person_name               | Name of a person (e.g., Bob, Doug Jones)                                                                                      |
| person_age                | Number associated with an age (e.g., 27, 75)                                                                                  |
| organization              | Name of an organization (e.g., CNN, McDonalds, University of Alaska)                                                          |
| political_affiliation     | Terms referring to a political party, movement, or ideology (e.g., Republican, Liberal)                                       |
| occupation                | Job title or profession (e.g., professor, actors, engineer, CPA)                                                              |
| religion                  | Terms indicating religious affiliation (e.g., Hindu, Catholic)                                                                |
| drivers_license           | Driver’s license number (e.g., DL# 356933-540)                                                                                |
| banking_information       | Banking information, including account and routing numbers                                                                    |

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[redact_pii_policies](TranscriptRequest.md#redact_pii_policies)

#### Defined in

[types/requests/transcript-request.ts:107](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L107)

___

### redact\_pii\_sub

• `Optional` **redact\_pii\_sub**: `string`

The replacement logic for detected PII, can be `"entity_type"` or `"hash"`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[redact_pii_sub](TranscriptRequest.md#redact_pii_sub)

#### Defined in

[types/requests/transcript-request.ts:111](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L111)

___

### sentiment\_analysis

• `Optional` **sentiment\_analysis**: `boolean`

Enable Sentiment Analysis, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[sentiment_analysis](TranscriptRequest.md#sentiment_analysis)

#### Defined in

[types/requests/transcript-request.ts:135](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L135)

___

### sentiment\_analysis\_results

• `Optional` **sentiment\_analysis\_results**: [`SentimentAnalysisResult`](SentimentAnalysisResult.md)[]

When Sentiment Analysis is enabled, the list of Sentiment Analysis results.

#### Defined in

[types/responses/transcript-response.ts:70](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L70)

___

### speaker\_labels

• `Optional` **speaker\_labels**: `boolean`

Enable Speaker Diarization, can be `true` or `false`.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[speaker_labels](TranscriptRequest.md#speaker_labels)

#### Defined in

[types/requests/transcript-request.ts:115](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L115)

___

### status

• `Optional` **status**: `string`

The status of your transcription. `queued`, `processing`, `completed`, or `error`

#### Defined in

[types/responses/transcript-response.ts:22](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L22)

___

### text

• `Optional` **text**: `string`

The text transcription of your media file.

#### Defined in

[types/responses/transcript-response.ts:30](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L30)

___

### utterances

• `Optional` **utterances**: [`Utterance`](Utterance.md)[]

When `dual_channel` or `speaker_labels` is enabled, a list of turn-by-turn utterances.

#### Defined in

[types/responses/transcript-response.ts:38](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L38)

___

### webhook\_status\_code

• `Optional` **webhook\_status\_code**: `string`

The status code we received from your server when delivering your webhook.

#### Defined in

[types/responses/transcript-response.ts:50](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L50)

___

### webhook\_url

• `Optional` **webhook\_url**: `string`

The URL we should send webhooks to when your transcript is complete.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[webhook_url](TranscriptRequest.md#webhook_url)

#### Defined in

[types/requests/transcript-request.ts:39](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L39)

___

### word\_boost

• `Optional` **word\_boost**: `string`[]

A list of custom vocabulary to boost accuracy for.

#### Inherited from

[TranscriptRequest](TranscriptRequest.md).[word_boost](TranscriptRequest.md#word_boost)

#### Defined in

[types/requests/transcript-request.ts:51](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/requests/transcript-request.ts#L51)

___

### words

• `Optional` **words**: [`Word`](Word.md)[]

A list of all the individual [words](Word.md) transcribed.

#### Defined in

[types/responses/transcript-response.ts:34](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/ccb7e39/src/types/responses/transcript-response.ts#L34)
