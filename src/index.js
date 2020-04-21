const upload = require('./upload.js');
const submit = require('./submit.js');
const get = require('./get.js');
const assemblyai = async ({ApiKey, filePath, audioUrl, languageModel, acousticModel}) =>{
    try{
        let tmpAudioUrl;
        if(audioUrl){
            tmpAudioUrl = audioUrl
        }else if(filePath){
            const { upload_url } = await upload({ApiKey, filePath});
            tmpAudioUrl = upload_url;
        }
        else{
            throw new Error(`You need to provide either a filePath or audioUrl to request a transcription. audioUrl takes precedence over filePath if you accidentally provide both.`)
        }
        const { id, status, words } = await submit({ApiKey, upload_url: tmpAudioUrl, languageModel, acousticModel});
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
