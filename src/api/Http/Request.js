const request = require('request')
const Client = require('../../Client')

class Request {
  /**
   * Initializes the class
   * @param {Object} options The HTTP Options
   * @param {String} options.method The HTTP Method
   * @param {String} options.url THE HTTP URL
   * @param {Object} options.body optional HTTP Body
   */
  constructor (options) {
    this.method = options.method || 'GET'
    this.url = options.url || ''
    this.body = options.body || ''
  }

  /**
   * Sends an HTTP request using the node HTTP module
   *
   * @returns {Promise<Object>} Parsed JSON of the response
   */
  _request (isJSON) {
    const options = {
      uri: this.url,
      method: this.method,
      headers: {
        authorization: Client.API_KEY
      }
    }

    if (this.method === 'POST' || this.method === 'PUT') {
      if (this.body && this.body.constructor !== String) {
        options.body = JSON.stringify(this.body)
      } else {
        options.body = ''
      }
    }

    return new Promise((resolve, reject) => {
      request(options, (err, response, body) => {
        if (err) return reject(err)
        try {
          if (isJSON) {
            resolve(JSON.parse(body))
          } else {
            resolve(body)
          }
        } catch (e) {
          console.log('HERE:', e)
          reject(new Error(`
            Unable to recieve a proper JSON response from the API.
            Please contact customer service.
          `))
        }
      })
    })
  }

  /**
   * Sends a request to the API
   *
   * @throws {Error} the error receieved from the API
   */
  async send (isJSON = true) {
    Client.checkKey()
    let response = null
    let retries = 1
    while (!response) {
      if (retries === 5) {
        throw new Error(`
          Retry limit reached. Some things that could cause this to happen
          would be your network connection or slow internet (request timeout).
          Please look into this before continuing to use this SDK
        `)
      }

      response = await new Promise(resolve => {
        setTimeout(async () => {
          try {
            const res = await this._request(isJSON)
            resolve(res)
          } catch (e) {
            retries += 1
            /**
             * The reason for resolving the null value would be so response is still *falsey*
             * allowing the loop to run again. If no value is resolved here, the loop will hang
             * until the value is resolved (which would be never)
             */
            resolve(null)
          }
        }, (retries * retries) * 100) // TODO: exponential timeout. Change this value to whatever you want
      })
    }
    return response
  }
}

module.exports = Request

// curl --request POST \
//     --url https://api.assemblyai.com/transcript \
//     --header 'authorization: 6f33815060fa4eb29e96356a3ec536c8' \
//     --data '
//     {
//       "audio_src_url": "https://s3-us-west-2.amazonaws.com/blog.assemblyai.com/audio/8-7-2018-post/7510.mp3",
//       "model_id": 265
//     }'
