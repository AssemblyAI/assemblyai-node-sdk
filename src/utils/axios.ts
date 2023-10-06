import axios, { isAxiosError } from "axios";
import { BaseServiceParams } from "../.";

export function createAxiosClient(params: BaseServiceParams) {
  const client = axios.create({
    baseURL: params.baseUrl,
    headers: { Authorization: params.apiKey },
  });

  client.interceptors.response.use(undefined, throwApiError);
  return client;
}

export function throwApiError(error: unknown) {
  if (isAxiosError(error) && error.response?.data?.error) {
    return Promise.reject(new Error(error.response.data.error));
  }
  return Promise.reject(error);
}
