require('dotenv').config();
const fs = require('fs');
const assemblyai = require('./index.js');
const ApiKey = process.env.ASSEMBLYAI_API_KEY;

const filePath = __dirname + '/example.mp3'; // some path to a local file, in .gitignore

async function upload() {
  try {
    const response = await assemblyai({
      ApiKey,
      filePath,
      languageModel: 'assemblyai_media',
      acousticModel: 'assemblyai_default',
      autoHighlights: false,
      iabCategories: false,
    });
    console.log('response', response);
    fs.writeFileSync(__dirname + '/example-speakers.json', JSON.stringify(response, null, 2));
  } catch (e) {
    // Do some error handling here
    console.log('error in example usage:: ', e);
  }
}

upload();
