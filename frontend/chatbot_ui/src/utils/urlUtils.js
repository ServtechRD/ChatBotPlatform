export const formatImageUrl = url => {
  if (!url) return '';

  // 如果是完整的 http/https URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // 移除開頭的 /public/
  return url.replace(/^\/public\//, '');
};
