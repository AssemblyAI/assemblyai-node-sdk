const fs = require('fs');
const request = require('request');
const upload = ({ApiKey, filePath}) => {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.assemblyai.com/v2/upload',
            method: 'POST',
            headers: {
                'authorization': ApiKey,
                'Transfer-Encoding': 'chunked'
            },
            encoding: null,
            body: fs.createReadStream(filePath)
        }, (error, response, body) => {
            if (error) {
                reject(res)
            } else {
                resolve(JSON.parse(response.body.toString()))
            }
        });
    })
}

module.exports = upload;
