const upload = require('./upload.js');
const submit = require('./submit.js');
const get = require('./get.js');
const assemblyai = async ({ApiKey, filePath, languageModel, acousticModel}) =>{
    console.log('languageModel',languageModel)
    try{
        const { upload_url } = await upload({ApiKey, filePath});
        const { id, status, words } = await submit({ApiKey, upload_url, languageModel, acousticModel});
        if(status === "completed"){
            return words;
        }
        else if(status === "queued" || status === "processing"){
            const resp = await get({ApiKey, trancriptId: id})
            return resp;
        }
        else{
            console.error('assemblyai status', status)
        }
    }catch(e){
        console.error('error uploading file to assemblyai')
        return e;
    }
}

module.exports = assemblyai;
