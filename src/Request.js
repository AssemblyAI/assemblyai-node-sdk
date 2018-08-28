const http = require('http')
const Client = require('./Client')

class Request {
  /**
   *
   * @param {Object} options The HTTP Options
   * @param {String} options.method The HTTP Method
   * @param {String} options.url THE HTTP URL
   * @param {Object} options.body optional HTTP Body
   */
  constructor (options) {
    this.method = options.method || 'GET'
    this.url = options.url || ''
    this.body = options.body || {}
  }

  /**
   * Sends an HTTP request using the node HTTP module
   *
   * @returns {Promise<Object>} Parsed JSON of the response
   */
  _request () {
    const options = {
      host: this.url,
      method: this.method,
      headers: {
        authorization: Client.API_KEY
      }
    }
    return new Promise((resolve, reject) => {
      const request = http.request(options, (res) => {
        let data = ''
        res
          .on('data', chunk => {
            data += chunk
          })
          .on('end', () => resolve(JSON.parse(data)))
          .on('error', err => reject(err))
      })
        .on('error', err => reject(err))

      if (this.method === 'POST') {
        request.write(JSON.stringify(this.body))
      }
      request.end()
    })
  }

  /**
   * Sends a request to the API
   *
   * @throws {Error} the error receieved from the API
   */
  async send () {
    Client.checkKey()
    const response = await this._request()
    if (response.error) {
      throw new Error(response.error)
    }
    return response
  }
}

module.exports = Request
