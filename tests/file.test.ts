import AssemblyAI from '../src'
import path from "path"

const testDir = process.env["TESTDATA_DIR"] ?? '.'

const assembly = new AssemblyAI({
  apiKey: '',
})

describe('files', () => {
  it('should upload a file', async () => {
    const uploadUrl = await assembly.files.upload(path.join(testDir, 'gore.wav'))

    expect(uploadUrl).toBeTruthy()
  }, 10_000)

  it('should not find file', async () => {
    const promise = assembly.files.upload(path.join(testDir, 'bad-path.wav'))
    await expect(promise).rejects.toThrowError(
      "ENOENT: no such file or directory, open '" + testDir + "/bad-path.wav'",
    )
  })
})
