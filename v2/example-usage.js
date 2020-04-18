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
