const Request = require('./Http/Request')
const Response = require('./Http/Response')

module.exports = {
  Poll (url, id) {
    return new Promise((resolve, reject) => {
      const request = new Request({
        method: 'GET',
        url: `${url}/${id}`
      })

      const interval = setInterval(async () => {
        try {
          const apiResponse = await request.send()
          const response = new Response(apiResponse)
          const json = response.get()
          if (json.status === 'completed') {
            clearInterval(interval)
            resolve(response)
          }
          if (json.status === 'trained') {
            clearInterval(interval)
            resolve(response)
          }
          if (json.status === 'error') {
            clearInterval(interval)
            reject(json.error)
          }
        } catch (e) {
          clearInterval(interval)
          reject(e)
        }
      }, 3000)
    })
  },
  async Create (url, options) {
    const request = new Request({
      method: 'POST',
      url: url,
      body: options.upload ? '' : options || {}
    })
    const apiResponse = await request.send()
    if (options.json === false) {
      return apiResponse
    }
    return new Response(apiResponse)
  }
}
