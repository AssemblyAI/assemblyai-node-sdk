# AssemblyAI Node SDK v2

Example usage 
```js
require('dotenv').config()
const assemblyai = require('./index.js');
const ApiKey = process.env.ASSEMBLYAI_API_KEY;

const filePath = "./example.mp3"; // some path to a local file, in .gitignore 

async function upload() {
    try {
        const response = await assemblyai({ApiKey, filePath});
        console.log('response', response)
    } catch (e) { // Do some error handling here
        console.log('error in example usage:: ', e)
    }
}

upload();
```

examples assumes there is a `.env` file, but you can also handle your credentials in the parent app how you see fit.
```env
ASSEMBLYAI_API_KEY=YOUR_ASSEMBLYAI_CREDENTIAL
```

## TODO
- [x] ~Initialization~
- [x] Upload an audio file for transcription
- [ ] Transcribe audio from a URL
- [ ] Create a custom model
