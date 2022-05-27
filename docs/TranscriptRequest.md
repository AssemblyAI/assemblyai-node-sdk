# Class: TranscriptRequest

The request object to create a Transcript used in the [AssemblyClient.createTranscript](../wiki/AssemblyClient#createtranscript) function.

## Hierarchy

- **`TranscriptRequest`**

  ↳ [`TranscriptResponse`](../wiki/TranscriptResponse)

## Table of contents

### Constructors

- [constructor](../wiki/TranscriptRequest#constructor)

### Properties

- [audio\_end\_at](../wiki/TranscriptRequest#audio_end_at)
- [audio\_start\_from](../wiki/TranscriptRequest#audio_start_from)
- [audio\_url](../wiki/TranscriptRequest#audio_url)
- [auto\_chapters](../wiki/TranscriptRequest#auto_chapters)
- [boost\_param](../wiki/TranscriptRequest#boost_param)
- [content\_safety](../wiki/TranscriptRequest#content_safety)
- [custom\_spelling](../wiki/TranscriptRequest#custom_spelling)
- [disfluencies](../wiki/TranscriptRequest#disfluencies)
- [dual\_channel](../wiki/TranscriptRequest#dual_channel)
- [entity\_detection](../wiki/TranscriptRequest#entity_detection)
- [filter\_profanity](../wiki/TranscriptRequest#filter_profanity)
- [format\_text](../wiki/TranscriptRequest#format_text)
- [iab\_categories](../wiki/TranscriptRequest#iab_categories)
- [language\_code](../wiki/TranscriptRequest#language_code)
- [punctuate](../wiki/TranscriptRequest#punctuate)
- [redact\_pii](../wiki/TranscriptRequest#redact_pii)
- [redact\_pii\_audio](../wiki/TranscriptRequest#redact_pii_audio)
- [redact\_pii\_policies](../wiki/TranscriptRequest#redact_pii_policies)
- [redact\_pii\_sub](../wiki/TranscriptRequest#redact_pii_sub)
- [sentiment\_analysis](../wiki/TranscriptRequest#sentiment_analysis)
- [speaker\_labels](../wiki/TranscriptRequest#speaker_labels)
- [webhook\_url](../wiki/TranscriptRequest#webhook_url)
- [word\_boost](../wiki/TranscriptRequest#word_boost)

## Constructors

### constructor

• **new TranscriptRequest**(`audioUrl`)

Creates an instance of TranscriptRequest.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `audioUrl` | `string` | The URL of your media file to transcribe. |

#### Defined in

[types/requests/transcript-request.ts:12](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L12)

## Properties

### audio\_end\_at

• `Optional` **audio\_end\_at**: `number`

The point in time, in milliseconds, to stop transcribing in your media file.

#### Defined in

[types/requests/transcript-request.ts:47](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L47)

___

### audio\_start\_from

• `Optional` **audio\_start\_from**: `number`

The point in time, in milliseconds, to begin transcription from in your media file.

#### Defined in

[types/requests/transcript-request.ts:43](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L43)

___

### audio\_url

• **audio\_url**: `string`

The URL of your media file to transcribe.

#### Defined in

[types/requests/transcript-request.ts:19](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L19)

___

### auto\_chapters

• `Optional` **auto\_chapters**: `boolean`

Enable Auto Chapters, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:139](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L139)

___

### boost\_param

• `Optional` **boost\_param**: `string`

The weight to apply to words/phrases in the `word_boost` array; can be `"low"`, `"default"`, or `"high"`.

#### Defined in

[types/requests/transcript-request.ts:55](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L55)

___

### content\_safety

• `Optional` **content\_safety**: `boolean`

Enable Content Safety Detection, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:119](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L119)

___

### custom\_spelling

• `Optional` **custom\_spelling**: [`CustomSpelling`](../wiki/CustomSpelling)[]

Customize how words are spelled and formatted using `to` and `from` values.

#### Defined in

[types/requests/transcript-request.ts:127](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L127)

___

### disfluencies

• `Optional` **disfluencies**: `boolean`

Transcribe Filler Words, like "umm", in your media file; can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:131](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L131)

___

### dual\_channel

• `Optional` **dual\_channel**: `boolean`

Enable Dual Channel transcription, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:35](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L35)

___

### entity\_detection

• `Optional` **entity\_detection**: `boolean`

Enable Entity Detection, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:143](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L143)

___

### filter\_profanity

• `Optional` **filter\_profanity**: `boolean`

Filter profanity from the transcribed text, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:59](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L59)

___

### format\_text

• `Optional` **format\_text**: `boolean`

Enable Text Formatting, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:31](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L31)

___

### iab\_categories

• `Optional` **iab\_categories**: `boolean`

Enable Topic Detection, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:123](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L123)

___

### language\_code

• `Optional` **language\_code**: `string`

The language of your audio file. Possible values are found in [Supported Languages](/#supported-languages "null"). The default value is `en_us`.

#### Defined in

[types/requests/transcript-request.ts:23](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L23)

___

### punctuate

• `Optional` **punctuate**: `boolean`

Enable Automatic Punctuation, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:27](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L27)

___

### redact\_pii

• `Optional` **redact\_pii**: `boolean`

Redact PII from the transcribed text, can be `true` or `false`.

With PII Redaction, the API can automatically remove **Personally Identifiable Information (PII)**, such as phone numbers and social security numbers, from the transcription text before it is returned to you.

All redacted text will be replaced with `#` characters. For example, if the phone number `111-2222` was spoken in the audio, it would be transcribed as `###-####` in the text.

#### Defined in

[types/requests/transcript-request.ts:67](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L67)

___

### redact\_pii\_audio

• `Optional` **redact\_pii\_audio**: `boolean`

Generate a copy of the original media file with spoken PII "beeped" out, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:71](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L71)

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

#### Defined in

[types/requests/transcript-request.ts:107](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L107)

___

### redact\_pii\_sub

• `Optional` **redact\_pii\_sub**: `string`

The replacement logic for detected PII, can be `"entity_type"` or `"hash"`.

#### Defined in

[types/requests/transcript-request.ts:111](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L111)

___

### sentiment\_analysis

• `Optional` **sentiment\_analysis**: `boolean`

Enable Sentiment Analysis, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:135](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L135)

___

### speaker\_labels

• `Optional` **speaker\_labels**: `boolean`

Enable Speaker Diarization, can be `true` or `false`.

#### Defined in

[types/requests/transcript-request.ts:115](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L115)

___

### webhook\_url

• `Optional` **webhook\_url**: `string`

The URL we should send webhooks to when your transcript is complete.

#### Defined in

[types/requests/transcript-request.ts:39](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L39)

___

### word\_boost

• `Optional` **word\_boost**: `string`[]

A list of custom vocabulary to boost accuracy for.

#### Defined in

[types/requests/transcript-request.ts:51](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/requests/transcript-request.ts#L51)
