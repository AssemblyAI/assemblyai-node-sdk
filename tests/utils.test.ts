import {
  createAxiosClient,
  throwApiError,
} from '../src/utils/axios';
const apiKey = '1234';
const baseUri = 'http://localhost:1234';

describe('utils', () => {
  it('should create Axios client', () => {
    const client = createAxiosClient({
      apiKey: apiKey,
      baseUrl: baseUri,
    });
    expect(client).toBeTruthy();
  })
  it('should throw AssemblyAI API error', async () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          error: 'Error message'
        }
      }
    }
    await expect(throwApiError(error)).rejects.toThrow(error.response.data.error);
  })
  it('should throw HTTP error', async () => {
    const error = {
      isAxiosError: true,
      response: null
    }
    await expect(throwApiError(error)).rejects.toBe(error);
  })
})
