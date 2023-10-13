import * as axiosImport from 'axios'
import type { LemurBaseParameters } from '../../src'
import { get, post, deleteMethod } from './api'

const axios = jest.createMockFromModule('axios') as jest.Mocked<
  typeof axiosImport.default
>
axios.create = jest.fn(() => axios)

type MakeEndpoints = (
  input: unknown,
) => Record<string, unknown | (() => unknown)>
const useKnownEndpoints =
  (makeEndpoints: MakeEndpoints) => (url: string, input: unknown) => {
    const endpoints = makeEndpoints(input as LemurBaseParameters)
    if (!(url in endpoints))
      return Promise.reject(new axiosImport.AxiosError(`${url}: not found`, '404'))

    const resolver = endpoints[url as keyof typeof endpoints]
    if (typeof resolver === 'function')
      return Promise.resolve(withData(resolver(input)))

    return Promise.resolve(withData(resolver))
  }

axios.post.mockImplementation(useKnownEndpoints(post))
axios.get.mockImplementation(useKnownEndpoints(get))
axios.delete.mockImplementation(useKnownEndpoints(deleteMethod))

export const withData = (data: unknown) => ({ data })
export const isAxiosError = axiosImport.isAxiosError
export default axios
