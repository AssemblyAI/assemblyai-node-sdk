This module is meant to be used with the AssemblyAI API which can be found here: https://docs.assemblyai.com/api/

# Installing the module:
  `npm i assemblyai`

# Setup of the module:

  ## Using Environment Variables
    If you have the `ASSEMBLYAI_API_KEY` environment variable set, then the application
    will automatically attempt to read it and use this value as the set key.

  ## Setting the value manually
  Here is what the code would look like if you were to set the value manually.
  ```javascript
  const assemblyai = require('assemblyai')
  assemblyai.setAPIKey("ENTER YOUR KEY HERE") // or dont...
  ```

# Usage

  This code is used for all examples below:
  ```javascript
  const assemblyai = require('assemblyai')
  assemblyai.setAPIKey() // Note that the value is loaded from an environment variable.
  ```
  The API Key is only required to be set once throughout the whole process. If the environment variable is set, this function invocation can be skipped.

  ## Transcript
    The class can be access like so:
    ```javascript
    const transcript = new assemblyai.Transcript()
    ```

  ### Creating a job
  When creating a job, you are required to pass in the audio source.
  If you have a model already, then you are able to pass that parameter in the object
  as well.

  An example with all of the options available is below, but the only one required
  would be `audio_src_url`.
  ```javascript
  const response = await transcript.create({
    audio_src_url: "SOME HOSTED URL",
    model_id: 123,
    options: {
      format_text: true || false
    }
  })
  ```
    
  ### Polling until job is complete
  Now that we have created a job, we can start polling for it. Below an example of how you would use this alongside the code which is above.
  ```javascript
    const { id } = response.get()
    const complete await transcript.poll(id)
  ```

  which will wait until the job is complete or errors out until returning.
  If the job were to error out during this stage, an exception will be thrown.

  ## Models
  The class can be access like so:
  ```javascript
  const model = new assemblyai.Model()
  ```
  
  ### Creating A Model
  Creating a model is very simple and is almost identical to creating a job.
  
  Here is some sample code:
  ```javascript
  const response = await model.create({
    name: "foobar",
    phrases: ["foo", "bar"]
  })
  ```
  
  ### Polling until the model has finished training
    This API is identical to the Transcript method which is used like so:

    ```javascript
    const { id } = response.get()
    await model.poll(id)
    ```

  ## Uploading
  If you just want to get right to speach to text, then here is a very simple way to do so.
  A local mp3 file has to be present on your machine in order for this to work...

  The base class for this subsection will be:

  ```javascript
  const upload = new assemblyai.Upload(***LocalFilePath***)
  ```
  The required parameter for the constructor would be a local file path which can be generated like so using the path module built into Node.JS:
  ```javascript
  path.resolve(__dirname, *relativePath*)
  ```

  ### Creating a Transcript job from a local file
  So, now that the initializing of the module is complete, you need to start the process.
  To do this, you just have to call the `create` function on the upload object like so:
  ```javascript
  const response = await upload.create()
  const { text } = response.get()
  console.log(text)
  ```
  This method will then upload your file to the cloud and make it available for the system to process. This is extremely easily if you would like to quickstart your usage of the API. The create method has a couple of flaws such as it likes to throw some errors, so be sure to catch them.

    
  ## The Response Object

  ### What is the purpose?
  The Response Object is used throughout the code to determine what the proper response would be. When using the `Response` object, you will find a couple of methods:
    `get()`
    `toString()`
    `stringify()`
  The method that you will most likely want to use will be `get()` which returns the full object one level down.
