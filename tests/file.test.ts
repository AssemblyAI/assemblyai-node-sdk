import { AssemblyAI } from '../src'
import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import path from "path"

const testDir = process.env["TESTDATA_DIR"] ?? '.'

const assembly = new AssemblyAI({
  apiKey: '',
})

describe('files', () => {
  it('should upload a file from path', async () => {
    const uploadUrl = await assembly.files.upload(path.join(testDir, 'gore.wav'))

    expect(uploadUrl).toBeTruthy()
  })

  it('should upload a file from stream', async () => {
    const stream = createReadStream(path.join(testDir, 'gore.wav'))
    const uploadUrl = await assembly.files.upload(stream)

    expect(uploadUrl).toBeTruthy()
  })

  it('should upload a file from buffer', async () => {
    const data = await readFile(path.join(testDir, 'gore.wav'))
    const uploadUrl = await assembly.files.upload(data)

    expect(uploadUrl).toBeTruthy()
  })
})
