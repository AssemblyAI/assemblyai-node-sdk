const Transcript = require('./src/api/Transcript')
const Model = require('./src/api/Model')
const Upload = require('./src/api/Upload')
const Client = require('./src/Client')

module.exports = {
  Transcript,
  Model,
  Upload,
  setAPIKey (key) {
    Client.API_KEY = key
  }
}


