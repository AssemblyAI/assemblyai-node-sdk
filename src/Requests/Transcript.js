const Client = require('../Client')

class Transcript extends Client {
  /**
   * Sets all the requirements for the Transcipt request
   */
  constructor () {
    super()
    this.url = 'https://api.assemblyai.com/transcript'
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

module.exports = Transcript
