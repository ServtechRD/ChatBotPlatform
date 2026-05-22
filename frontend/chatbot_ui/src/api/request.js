import httpClient from './httpClient.js';

/**
 * JSON 請求（GET / DELETE 或 JSON body）
 * 共用 httpClient：Bearer token、401 refresh 重試
 */
export async function requestJSON(method, url, data, config = {}) {
  const methodUpper = method.toUpperCase();
  const hasBody = data !== undefined && data !== null;
  const headers = { ...config.headers };

  if (
    hasBody &&
    !(data instanceof FormData) &&
    !(data instanceof URLSearchParams)
  ) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const response = await httpClient.request({
    method: methodUpper,
    url,
    ...(hasBody ? { data } : {}),
    ...config,
    headers,
  });
  return response.data;
}

/**
 * FormData / URLSearchParams 請求
 * URLSearchParams 自動設 application/x-www-form-urlencoded
 * FormData 由瀏覽器設定 multipart boundary
 */
export async function requestFormData(method, url, data, config = {}) {
  const methodUpper = method.toUpperCase();
  const headers = { ...config.headers };

  if (data instanceof URLSearchParams) {
    headers['Content-Type'] =
      headers['Content-Type'] ?? 'application/x-www-form-urlencoded';
  }

  const response = await httpClient.request({
    method: methodUpper,
    url,
    data,
    ...config,
    headers,
  });
  return response.data;
}
