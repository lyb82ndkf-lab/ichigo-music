export function isLegacyFileMediaSource(source) {
  return /^file:/i.test(String(source || ''));
}

export function isLocalMediaSource(source) {
  return isLegacyFileMediaSource(source) || /^ichigo-cache:\/\/audio\//i.test(String(source || ''));
}
