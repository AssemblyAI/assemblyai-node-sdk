const Request = require('./Request')
const Response = require('./Response')

class Client {
  constructor (apiKey) {
    if (apiKey) {
      Client.API_KEY = apiKey
    }
  }

  _poll (url, id) {
    return new Promise((resolve, reject) => {
      const request = new Request({
        method: 'GET',
        url: `${url}/${id}`
      })

      const interval = setInterval(async () => {
        try {
          const apiResponse = await request.send()
          const response = new Response(apiResponse)
          if (response.get().status === 'complete') {
            clearInterval(interval)
            resolve(response)
          }
        } catch (e) {
          clearInterval(interval)
          reject(e)
        }
      }, 2000)
    })
  }

  async _create (url, options) {
    const request = new Request({
      method: 'POST',
      url: url,
      body: options || {}
    })
    const apiResponse = await request.send()
    const response = new Response(apiResponse)
    return response
  }
}

Client.API_KEY = ''
Client.checkKey = () => {
  if (!Client.API_KEY) {
    throw new Error(`
      You must set an API key before initializing this class.
      Please set the API key like so: Client.API_KEY = 'key'
    `)
  }
}

module.exports = Client
