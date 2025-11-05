// urlUtils.js
// 處理圖片和影片 URL

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

  // 優先使用靜態資源專用 URL,如果沒有則使用 API URL
  const staticBaseUrl =
    process.env.REACT_APP_STATIC_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    '';

  // 如果有設定基礎網址,就加上去
  if (staticBaseUrl) {
    // 移除結尾的斜線(如果有)
    const baseUrl = staticBaseUrl.replace(/\/$/, '');
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

/**
 * 取得 API 基礎 URL (用於 API 請求,不是靜態資源)
 * @returns {string} - API 基礎 URL
 */
export const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_BASE_URL || '';
};
