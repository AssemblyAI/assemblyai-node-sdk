const request = require('request');
const submit = ({ApiKey, upload_url}) =>{
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
                "acoustic_model":"assemblyai_default",
                "language_model": "assemblyai_media"
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
