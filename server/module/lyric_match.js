// Multi-source word-by-word lyric matcher inspired by folia-major.
const { autoMatchLyric } = require('../util/lyricMatch')

module.exports = async (query) => {
  const result = await autoMatchLyric(query || {})
  if (!result) {
    return { code: 404, message: 'No matched word-by-word lyric found', data: null }
  }
  return { code: 200, data: result }
}
