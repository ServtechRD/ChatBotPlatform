/** 從 API 錯誤取出可顯示訊息（含 409 重複 wrong_text） */
export function getSpeechCorrectionErrorMessage(err, fallback = '操作失敗，請稍後再試') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const dup = detail.duplicate_wrong_texts;
    if (Array.isArray(dup) && dup.length > 0) {
      return `${detail.message || '錯誤文字已存在'}：${dup.join('、')}`;
    }
    if (detail.message) return String(detail.message);
  }
  if (err?.message) return err.message;
  return fallback;
}
