export function isLegacyFileMediaSource(source) {
  return /^file:/i.test(String(source || ''));
}

export function isLocalMediaSource(source) {
  return isLegacyFileMediaSource(source) || /^ichigo-cache:\/\/audio\//i.test(String(source || ''));
}

// Remote CDN tracks and cached audio are re-served through the local HTTP
// proxy so the media element is CORS-approved for Web Audio analysis (see
// getAudioStreamUrl IPC). This is a standard http://127.0.0.1:<port>/audio?...
// URL that createMediaElementSource can reliably feed the analyser with.
export function isStreamMediaSource(source) {
  return /^ichigo-cache:\/\/stream\//i.test(String(source || ''))
    || /^http:\/\/127\.0\.0\.1:\d+\/audio\?/i.test(String(source || ''));
}

export function isProxyMediaSource(source) {
  return isLocalMediaSource(source) || isStreamMediaSource(source);
}
