class Response {
  constructor (responseJSON) {
    this.json = responseJSON
    if (responseJSON.error) {
      throw new Error(responseJSON.error)
    }
    this.type = responseJSON.transcript ? 'transcript' : 'model'
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
