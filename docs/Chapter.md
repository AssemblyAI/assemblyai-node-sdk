# Class: Chapter

**Auto Chapters** provides a "summary over time" for audio files transcribed with AssemblyAI.
It works by first segmenting your audio files into logical "chapters" as the topic of conversation changes,
and then provides an automatically generated summary for each "chapter" of content.

For more information on **Auto Chapters**, check out the [announcement on our blog](https://www.assemblyai.com/blog/introducing-assemblyai-auto-chapters-summarize-audio-and-video-files).

When submitting a file for transcription, simply include the `auto_chapters` parameter in your `POST` request, and set this to `true`.

When your [transcription is completed](/walkthroughs#getting-the-transcription-result "null"), you'll see a `chapters` key in the JSON response, as shown on the right. For each chapter that was detected, the API will include the `start` and `end` timestamps (in milliseconds), a `summary` - which is a few sentence summary of the content spoken during that timeframe, a short `headline`, which can be thought of as a "summary of the summary", and a `gist`, which is an ultra-short, few word summary of the chapter of content.

## Table of contents

### Constructors

- [constructor](../wiki/Chapter#constructor)

### Properties

- [end](../wiki/Chapter#end)
- [gist](../wiki/Chapter#gist)
- [headline](../wiki/Chapter#headline)
- [start](../wiki/Chapter#start)
- [summary](../wiki/Chapter#summary)

## Constructors

### constructor

• **new Chapter**()

## Properties

### end

• `Optional` **end**: `number`

Ending timestamp (in milliseconds) of the portion of audio being summarized.

#### Defined in

[types/chapter.ts:20](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/chapter.ts#L20)

___

### gist

• `Optional` **gist**: `string`

An ultra-short summary, just a few words, of the content spoken during this timeframe.

#### Defined in

[types/chapter.ts:24](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/chapter.ts#L24)

___

### headline

• `Optional` **headline**: `string`

A single sentence summary of the content spoken during this timeframe.

#### Defined in

[types/chapter.ts:28](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/chapter.ts#L28)

___

### start

• `Optional` **start**: `number`

Starting timestamp (in milliseconds) of the portion of audio being summarized.

#### Defined in

[types/chapter.ts:16](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/chapter.ts#L16)

___

### summary

• `Optional` **summary**: `string`

An ultra-short summary, just a few words, of the content spoken during this timeframe.

#### Defined in

[types/chapter.ts:32](https://github.com/PhillipChaffee/assemblyai-node-sdk/blob/a493ce0/src/types/chapter.ts#L32)
