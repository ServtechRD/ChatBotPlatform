/** 語音辨識常見錯字 → 正確專有名詞（鍵為辨識結果片段，值為欲送出的文字） */
export const VOICE_TRANSCRIPT_CORRECTIONS = {
  '柯志企業': '科智企業',
  'amr' : "AMR",
  'music AI' : "MusesAI",
  'music ai' : "MusesAI",
  'Music AI' : "MusesAI",
  'Music ai' : "MusesAI",
  "music" : "Muses",
  "Music" : "Muses",
};

export function applyVoiceTranscriptCorrections(text) {
  if (!text || typeof text !== 'string') return text;
  let result = text;
  const entries = Object.entries(VOICE_TRANSCRIPT_CORRECTIONS)
    .filter(([from]) => from && typeof from === 'string')
    .sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    if (from === '') continue;
    const replacement = to == null ? '' : String(to);
    result = result.split(from).join(replacement);
  }
  return result;
}
