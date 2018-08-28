const Client = require('../Client')

class Model extends Client {
  constructor () {
    super()
    this.url = 'https://api.assemblyai.com/model'
  }

  async poll (id) {
    const response = await this._poll(this.url, id)
    return response.get()
  }

  async create (options) {
    const response = await this._create(this.url, options)
    return response.get()
  }
}

module.exports = Model
