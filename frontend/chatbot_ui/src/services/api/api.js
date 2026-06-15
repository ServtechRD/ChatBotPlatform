import { requestJSON } from './request.js';

function get(url, config) {
  return requestJSON('get', url, undefined, config);
}

function post(url, data, config) {
  return requestJSON('post', url, data, config);
}

function put(url, data, config) {
  return requestJSON('put', url, data, config);
}

function del(url, config) {
  return requestJSON('delete', url, undefined, config);
}

export const api = {
  get,
  post,
  put,
  del,
};
