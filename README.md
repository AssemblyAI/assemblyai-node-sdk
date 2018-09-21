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

### Initialization

The initialization of the module of course has to be at the beginning of your project. 

```javascript
const assemblyai = require('assemblyai')
assemblyai.setAPIKey("ENTER YOUR KEY HERE")
```

### Upload an audio file for transcription

```javascript
async function upload () {
  try {
    const transcript = new assemblyai.Upload('/path/to/audiofile.wav')
    const response = await transcript.create()
    const data = response.get()
    
    // do something with the JSON response
    console.log(data);
    
  } catch (e) {
    // Do some error handling here
  }
}
```

### Transcribe audio from a URL

The only required parameter is the `audio_src_url` parameter. For more information about transcribing audio, please see the full API documentation [here](https://docs.assemblyai.com/api/#posttranscript).

```javascript
async function transcribe () {
  try {
    const transcript = new assemblyai.Transcript()
    const response = await transcript.create({
      audio_src_url: "https://example.com/example.wav",
      model_id: 123,
      options: {
        format_text: true || false
      }
    })
    const { id } = response.get()
    const data = await transcript.poll(id)
    
    // do something with the response data.
    // `data` is a wrapper of the API's JSON
    // response. `data.get()` returns the JSON
    // response of the API
    var responseJson = data.get();
    console.log(responseJson);
    
  } catch (e) {
    // Do some error handling here
  }
}
```

### Create a custom model

Boost accuracy for keywords/phrases, and add custom terms to the vocabulary with a custom model. For more information, please see the full API documentation [here](https://docs.assemblyai.com/guides/custom_models_101/).

```javascript
async function model() {
  try {
    const instance = new assemblyai.Model()
    const response = await instance.create({
      phrases: ['foo', 'bar']
    })
    const { id } = response.get()
    const data = await instance.poll(id)
    
    // do something with the response data.
    // `data` is a wrapper of the API's JSON
    // response. `data.get()` returns the JSON
    // response of the API
    var responseJson = data.get();
    console.log(responseJson);
    
  } catch (e) {
    // Do some error handling
  }
}
```
    
### The Response Object

When using the `Response` object, you will find a couple of methods:

- `get()`
- `toString()`
- `stringify()`

The method that you will most likely want to use will be `get()` which returns the full JSON object from the API, one level down.
