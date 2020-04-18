const request = require('request');
const seconds = 30;
const checkAgainInMilliseconds = seconds * 1000;

const get = async ({ApiKey, trancriptId}) => {
    return new Promise((resolve, reject) => {
        request({
            url: `https://api.assemblyai.com/v2/transcript/${trancriptId}`,
            headers: {
                'authorization': ApiKey,
                'content-type': 'application/json'
            }
        }, (error, response, body) => {
            if (error) {
                reject(error)
            }
            if (!error && response.statusCode == 200) { 
                resolve(JSON.parse(response.body.toString()))
            }
        });
    })
}

const retry = ({ApiKey, trancriptId}) => {
    return new Promise(async (resolve, reject) => {
        const interval = setInterval(async () => {
            console.log('inside interval')
            try {
                const resp = await get({ApiKey, trancriptId});
                if (resp.status === 'completed') {
                    clearInterval(interval);
                    resolve(resp)
                }
            } catch (e) {
                clearInterval(interval);
                reject(e)
            }
        }, checkAgainInMilliseconds);
    });
};


module.exports = retry;
