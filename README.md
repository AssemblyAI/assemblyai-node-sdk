## Installing the module:

  `npm i assemblyai`

## Authenticating with the API

### Using Environment Variables

If you have the `ASSEMBLYAI_API_KEY` environment variable set, then the application
will attempt to read it and use this value to authenticate with the API.

### Setting the value manually

Here is what the code would look like if you were to set the API token manually.

```javascript
const assemblyai = require('assemblyai')
assemblyai.setAPIKey("ENTER YOUR KEY HERE")
```

## Usage

```javascript
const assemblyai = require('assemblyai')
assemblyai.setAPIKey() // Note that the value is loaded from an environment variable.
```

### Transcript

Transcribing audio from a URL

```javascript
const transcript = new assemblyai.Transcript()
```

#### Creating a job

When creating a job, you are required to pass in the audio source.

An example with all of the options available is below, but the only required param would be `audio_src_url`.

```javascript
const response = await transcript.create({
  audio_src_url: "https://example.com/example.wav",
  model_id: 123,
  options: {
    format_text: true || false
  }
})
```
    
#### Polling until job is complete

Now that we have created a job, we can start polling for it.

```javascript
const { id } = response.get()
const complete await transcript.poll(id)
```

This ^ will wait until the job is complete or errors out until returning.
If the job were to error out, an exception would be thrown.

### Models

Create a custom model to boost accuracy for phrases/keywords, or to add custom vocabulary.

```javascript
const model = new assemblyai.Model()
```
  
#### Creating A Model

Creating a model is very simple and is almost identical to creating a job.
  
```javascript
const response = await model.create({
  name: "foobar",
  phrases: ["foo", "bar"]
})
```
  
#### Polling until the model has finished training

This API is identical to the Transcript method which is used like so:

```javascript
const { id } = response.get()
await model.poll(id)
```

### Uploading audio files for transcription

```javascript
const upload = new assemblyai.Upload('/path/to/some/file.wav')
```

```javascript
const response = await upload.create()
const { text } = response.get()
console.log(text)
```
    
## The Response Object

When using the `Response` object, you will find a couple of methods:

- `get()`
- `toString()`
- `stringify()`

The method that you will most likely want to use will be `get()` which returns the full JSON object from the API, one level down.