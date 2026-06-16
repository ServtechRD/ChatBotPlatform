/**
 * 聊天 WebSocket UI 防呆共用邏輯（不含 useWSClient 實作）
 */

export function getWsConnectionLabel(status) {
  if (status === 'connected') return '已連線';
  if (status === 'connecting') return '連線中…';
  return '已斷線';
}

export function canSubmitChatMessage({ status, isThinking, text, isSending }) {
  if (!text || !String(text).trim()) return false;
  if (status !== 'connected') return false;
  if (isThinking) return false;
  if (isSending) return false;
  return true;
}

export function shouldShowReconnectButton(status) {
  return status === 'disconnected';
}

export const SEND_FAILED_MESSAGE = '訊息送出失敗，請確認連線後再試。';
