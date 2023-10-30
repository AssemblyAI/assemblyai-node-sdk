import fetchMock from "jest-fetch-mock";
import { AssemblyAI } from "../src";

fetchMock.enableMocks();

const assembly = new AssemblyAI({
  apiKey: '',
})

beforeEach(() => {
  fetchMock.doMock()
});

describe('utils', () => {
  it('should throw AssemblyAI API error', async () => {
    const error = {error: 'error'};
    fetchMock.mockResponseOnce(JSON.stringify(error), {status: 500});
    await expect(() => assembly.transcripts.get('123')).rejects.toThrow(error.error);
  })
  it('should throw HTTP error', async () => {
    const error = 'error';
    fetchMock.mockResponseOnce(JSON.stringify(error), {status: 500});
    await expect(() => assembly.transcripts.get('123')).rejects.toThrow(error);
  })
})
