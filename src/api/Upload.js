const fs = require('fs')
const Request = require('./Http/Request')
const request = require('request')

const Transcribe = require('./Transcript')

class Upload {
  constructor (filePath) {
    this.url = 'https://api.assemblyai.com/upload'
    this.filePath = filePath
  }

  async create () {
    const req = new Request({
      method: 'POST',
      url: this.url
    })
    const uploadUrl = await req.send(false)

    await new Promise((resolve, reject) => {
      fs.readFile(this.filePath, (err, data) => {
        if (err) return reject(err)
        request.put(uploadUrl, { body: data }, (err, response, body) => {
          if (err) return reject(err)
          resolve(body)
        })
      })
    })

    const url = uploadUrl.split('?')[0]
    const transcribe = new Transcribe()
    const response = await transcribe.create({
      audio_src_url: url
    })
    const { id } = response.get()

    return transcribe.poll(id)
  }
}

module.exports = Upload
