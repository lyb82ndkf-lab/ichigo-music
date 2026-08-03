export function isLocalMediaSource(source) {
  return /^file:/i.test(String(source || ''));
}
