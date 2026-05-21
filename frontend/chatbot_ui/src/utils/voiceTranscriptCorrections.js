/** 語音辨識常見錯字 → 正確專有名詞（鍵為辨識結果片段，值為欲送出的文字） */
export const VOICE_TRANSCRIPT_CORRECTIONS = {
  // 場域
  常玉: '場域',
  長鈺: '場域',
  长钰: '場域',

  // 科智企業
  柯志企業: '科智企業',
  客製企業: '科智企業',
  科技企業: '科智企業',

  // JarvisAI
  Japan: 'JarvisAI',
  japan: 'JarvisAI',
  'justice AI': 'JarvisAI',
  'Justice AI': 'JarvisAI',
  'justice ai': 'JarvisAI',

  // MusesAI
  Musesian: 'MusesAI',
  musesian: 'MusesAI',
  'music AI': 'MusesAI',
  'music ai': 'MusesAI',
  'Music AI': 'MusesAI',
  'Music ai': 'MusesAI',
  music: 'Muses',
  Music: 'Muses',
  amr: 'AMR',

  // AI SOP
  'a i s o b': 'AI SOP',
  'A I S O B': 'AI SOP',
  'ai sob': 'AI SOP',
  AISOB: 'AI SOP',
  aisob: 'AI SOP',
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
