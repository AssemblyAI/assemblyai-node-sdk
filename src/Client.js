let _apiKey = ''

class Client {
  static set API_KEY (key) {
    _apiKey = key
  }

  static get API_KEY () {
    return _apiKey
  }

  static checkKey () {
    if (process.env.ASSEMBLYAI_API_KEY) {
      _apiKey = process.env.ASSEMBLYAI_API_KEY
    }
    if (!_apiKey) {
      throw new Error(`
        Unable to find the API Key.
        You can set this value by using the setAPIKey method.
        Example: """ const assemblyai = require('assemblyai')
                     assemblyai.setAPIKey('example') """
      `)
    }
    return true
  }
}

module.exports = Client
