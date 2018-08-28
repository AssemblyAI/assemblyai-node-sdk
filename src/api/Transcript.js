const { Poll, Create } = require('./util')
class Transcript {
  constructor () {
    this.url = 'https://api.assemblyai.com/transcript'
  }

  poll (id) {
    return Poll(this.url, id)
  }

  create (options) {
    return Create(this.url, options)
  }
}

module.exports = Transcript
