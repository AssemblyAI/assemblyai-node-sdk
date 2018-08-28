class Response {
  constructor (responseJSON) {
    this.json = responseJSON
    this.type = responseJSON.transcipt ? 'transcript' : 'model'
  }

  toString () {
    return JSON.stringify(this.json[this.type])
  }

  stringify () {
    return this.toString()
  }

  get () {
    return this.json[this.type]
  }
}

module.exports = Response
