const request = require('request');
const submit = ({ApiKey, upload_url, languageModel='assemblyai_default', acousticModel='assemblyai_default'}) =>{
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.assemblyai.com/v2/transcript',
            method: 'POST',
            headers:  {
                'authorization': ApiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                "audio_url": upload_url,
                // https://docs.assemblyai.com/overview/custom-models
                // assemblyai_default, assemblyai_en_au, assemblyai_en_za, assemblyai_en_uk
                "acoustic_model": acousticModel,
                // `language_model` can be assemblyai_default or assemblyai_media
                "language_model":  languageModel
            })
        }, (error, response, body) =>{
            if(error){
                reject(error)
            }
            if (!error && response.statusCode == 200) {
                resolve(JSON.parse(body))
            }
        });
    })
}

module.exports = submit;
