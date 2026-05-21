import { requestFormData } from './request.js';

function get(url, config) {
  return requestFormData('get', url, undefined, config);
}

function post(url, data, config) {
  return requestFormData('post', url, data, config);
}

function put(url, data, config) {
  return requestFormData('put', url, data, config);
}

function del(url, config) {
  return requestFormData('delete', url, undefined, config);
}

export const formDataApi = {
  get,
  post,
  put,
  del,
};
