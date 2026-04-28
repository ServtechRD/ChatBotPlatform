// urlUtils.js
// 處理圖片和影片 URL

const trimTrailingSlash = value => value.replace(/\/+$/, '');
const trimLeadingSlash = value => value.replace(/^\/+/, '');

export const getApiBaseUrl = () => {
  const envApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (envApiBaseUrl) {
    return trimTrailingSlash(envApiBaseUrl);
  }

  // env 未設定時，預設走同源 /api 反向代理
  return `${window.location.origin}/api`;
};

export const buildApiUrl = path => {
  const baseUrl = trimTrailingSlash(getApiBaseUrl());
  const normalizedPath = `/${trimLeadingSlash(path)}`;
  const baseHasApiSuffix = /\/api$/i.test(baseUrl);
  const pathHasApiPrefix = /^\/api(?:\/|$)/i.test(normalizedPath);

  // 避免 base 與 path 都帶 /api 造成 /api/api 重複
  if (baseHasApiSuffix && pathHasApiPrefix) {
    return `${baseUrl}${normalizedPath.replace(/^\/api/i, '')}`;
  }

  return `${baseUrl}${normalizedPath}`;
};

export const getWsBaseUrl = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const envWsBaseUrl = process.env.REACT_APP_API_BASE_WS_URL;

  if (envWsBaseUrl) {
    const normalizedWsUrl =
      envWsBaseUrl.startsWith('ws://') || envWsBaseUrl.startsWith('wss://')
        ? envWsBaseUrl
        : `${wsProtocol}//${envWsBaseUrl}`;
    return trimTrailingSlash(normalizedWsUrl);
  }

  return `${wsProtocol}//${window.location.host}`;
};

/**
 * 格式化圖片 URL
 * @param {string} url - API 回傳的圖片路徑
 * @returns {string} - 完整的圖片 URL
 */
export const formatImageUrl = url => {
  if (!url) return '';

  // 如果已經是完整的 http/https URL,直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 如果是 data:image base64 格式,直接返回
  if (url.startsWith('data:image')) {
    return url;
  }

  // 移除開頭的 /public/
  let cleanUrl = url.replace(/^\/public\//, '');

  // 確保開頭有斜線
  if (!cleanUrl.startsWith('/')) {
    cleanUrl = '/' + cleanUrl;
  }

  // 優先使用 API URL（env 未設定時會 fallback 到同源 /api）
  const staticBaseUrl = getApiBaseUrl();

  // 如果有設定基礎網址,就加上去
  if (staticBaseUrl) {
    // 移除結尾的斜線(如果有)
    const baseUrl = trimTrailingSlash(staticBaseUrl);
    return `${baseUrl}${cleanUrl}`;
  }

  // 沒有設定就使用相對路徑
  return cleanUrl;
};

/**
 * 格式化影片 URL (與圖片邏輯相同)
 * @param {string} url - API 回傳的影片路徑
 * @returns {string} - 完整的影片 URL
 */
export const formatVideoUrl = url => {
  return formatImageUrl(url);
};

