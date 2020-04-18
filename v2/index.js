const upload = require('./upload.js');
const submit = require('./submit.js');
const get = require('./get.js');
const assemblyai = async ({ApiKey, filePath}) =>{
    try{
        const { upload_url } = await upload({ApiKey, filePath});
        console.log('assemblyai upload_url',upload_url)
        const { id, status, words } = await submit({ApiKey, upload_url});
        console.log('assemblyai id',id)
        if(status === "completed"){
            console.log('assemblyai completed')
            return words;
        }
        else if(status === "queued" || status === "processing"){
            console.log('assemblyai queued processing')
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
