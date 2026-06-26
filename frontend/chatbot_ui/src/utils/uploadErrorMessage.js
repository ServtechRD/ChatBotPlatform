const UPLOAD_ERROR_MESSAGES = {
  429: '目前上傳人數較多，系統佇列已滿，請稍候 1～2 分鐘再試。',
  504: '處理時間過長已逾時，檔案可能仍在背景處理；請稍後重新整理知識庫列表確認。',
};

const DEFAULT_UPLOAD_ERROR_MESSAGE =
  '上傳失敗（可能逾時或網路錯誤），請稍後再試。若後端已處理完成，重整頁面後知識庫會顯示新資料。';

export function getUploadErrorMessage(error) {
  const status = error?.response?.status;
  if (status && UPLOAD_ERROR_MESSAGES[status]) {
    return UPLOAD_ERROR_MESSAGES[status];
  }
  return DEFAULT_UPLOAD_ERROR_MESSAGE;
}

export const UPLOAD_SUCCESS_MESSAGE =
  '已接收內容，正在向量化並寫入知識庫；完成後對話才會使用新內容，請稍候 1～3 分鐘。';

export const KNOWLEDGE_UPDATE_SUCCESS_MESSAGE =
  '已更新內容，正在重新向量化；完成後對話才會使用新內容，請稍候 1～3 分鐘。';
