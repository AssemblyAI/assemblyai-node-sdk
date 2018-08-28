const { Poll, Create } = require('./util')

class Model {
  constructor () {
    this.url = 'https://api.assemblyai.com/model'
  }

  poll (id) {
    return Poll(this.url, id)
  }

  create (options) {
    return Create(this.url, options)
  }
}

module.exports = Model
