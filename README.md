# @phillipchaffee/assemblyai-v2-node-sdk

## Getting started

### Installing the module

`npm i @phillipchaffee/assemblyai-v2-node-sdk`

### Initialization

To start using the client, just instantiate a new instance with your AssemblyAI API key.

```javascript
const assemblyai = require('@phillipchaffee/assemblyai-v2-node-sdk');
const client = new assemblyai.AssemblyClient('ENTER YOUR ASSEMBLY KEY HERE');
```

### Upload an audio file for transcription

```javascript
const transcript = await client.createTranscript({
  audio_url: 'my-public-audio-url.wav',
});

client.pollForTranscript(transcript.id).then(result => {
  console.log(result);
});
```

## AssemblyClient

The main interface you will use is the AssemblyClient. You can find documentation for it [here](https://phillipchaffee.github.io/assemblyai-node-sdk/classes/AssemblyClient.html).

## Full Documentation

For more detailed information on the functionality available read the [docs](https://phillipchaffee.github.io/assemblyai-node-sdk/index.html).

You may also want to reference the [AssemblyAI API documentation](https://docs.assemblyai.com/).
