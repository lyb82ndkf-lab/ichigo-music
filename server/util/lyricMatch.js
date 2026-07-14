const crypto = require('crypto')
const { qrcDecrypt } = require('./qrcDecrypt')
const { krcDecrypt } = require('./krcDecrypt')

const AMLL_DB_BASE_URL = 'https://amll-ttml-db.stevexmh.net'
const QQ_API_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg'

function md5(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex')
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_()[\]（）【】《》<>「」『』,，.。?？!！:：;；'"“”‘’、·・…~～]/g, '')
}

function splitArtists(value) {
  return String(value || '')
    .split(/[\/,&，、;；|]+/)
    .map(v => v.trim())
    .filter(Boolean)
}

function scoreCandidate(target, song) {
  const targetTitle = normalizeText(target.title)
  const songTitle = normalizeText(song.name)
  const titleScore = targetTitle && songTitle
    ? (targetTitle === songTitle ? 52 : (targetTitle.includes(songTitle) || songTitle.includes(targetTitle) ? 42 : 0))
    : 0

  const targetArtists = splitArtists(target.artist).map(normalizeText).filter(Boolean)
  const songArtists = (song.artists || []).map(a => normalizeText(a.name)).filter(Boolean)
  const artistHit = targetArtists.length === 0 || targetArtists.some(a => songArtists.some(b => a === b || a.includes(b) || b.includes(a)))
  const artistScore = artistHit ? 28 : 0

  const durationMs = Number(target.durationMs || 0)
  const songDuration = Number(song.duration || 0)
  let durationScore = 0
  if (durationMs > 0 && songDuration > 0) {
    const diff = Math.abs(durationMs - songDuration)
    durationScore = diff <= 3000 ? 20 : diff <= 8000 ? 12 : diff <= 15000 ? 6 : 0
  }
  return titleScore + artistScore + durationScore
}

function pickBest(target, songs) {
  return (songs || [])
    .map(song => ({ song, score: scoreCandidate(target, song) }))
    .sort((a, b) => b.score - a.score)[0]
}

function rankCandidates(target, songs, minScore = 72, limit = 5) {
  return (songs || [])
    .map(song => ({ song, score: scoreCandidate(target, song) }))
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function isCreditText(text) {
  const value = String(text || '').trim().toLowerCase()
  const prefixes = [
    '\u4f5c\u8bcd', '\u4f5c\u66f2', '\u7f16\u66f2', '\u8bcd', '\u66f2',
    '\u76d1\u5236', '\u5236\u4f5c\u4eba', '\u6df7\u97f3', '\u5f55\u97f3',
    '\u5409\u4ed6', '\u94a2\u7434', '\u8d1d\u65af', '\u6bcd\u5e26',
    'composer', 'lyricist', 'lyrics', 'arranger', 'producer', 'mix', 'mastering', 'vocal'
  ]
  return prefixes.some(prefix => value.startsWith(prefix + ':') || value.startsWith(prefix + '\uff1a'))
}

function isInstrumentalLyric(lines) {
  const realLines = (lines || []).filter(line => line?.text && String(line.text).trim())
  const instrumentalWords = ['\u7eaf\u97f3\u4e50', '\u7eaf\u97f3', '\u65e0\u4eba\u58f0', '\u8bf7\u6b23\u8d4f', 'instrumental', 'off vocal', 'karaoke']
  return realLines.length <= 3 && realLines.some(line => {
    const value = String(line.text || '').toLowerCase()
    return instrumentalWords.some(word => value.includes(word))
  })
}

function assessMatchedLyric(result, target = {}) {
  const lines = Array.isArray(result?.lines) ? result.lines : []
  const realLines = lines.filter(line => line?.text && String(line.text).trim() && !/^\.+$/.test(String(line.text).trim()))
  const instrumentalLike = isInstrumentalLyric(realLines)
  const creditCount = realLines.filter(line => isCreditText(line.text)).length
  const creditOnly = realLines.length > 0 && realLines.length <= 8 && creditCount / realLines.length >= 0.6
  const wordTimed = realLines.some(line => Array.isArray(line.words) && line.words.length >= 2)
  const durationSec = Number(target.durationMs || 0) > 0 ? Number(target.durationMs) / 1000 : 0
  const lastEnd = realLines.reduce((max, line) => Math.max(max, Number(line.time || 0) + Number(line.duration || 0)), 0)
  const coverage = durationSec > 0 ? lastEnd / durationSec : 1
  const lowQuality = !instrumentalLike && (
    realLines.length === 0 ||
    realLines.length < 10 ||
    creditOnly ||
    (durationSec >= 90 && coverage > 0 && coverage < 0.28)
  )
  return { usable: !lowQuality, lowQuality, instrumentalLike, wordTimed, realLineCount: realLines.length, creditCount, coverage }
}

function isUsableMatchedLyric(result, target) {
  const quality = assessMatchedLyric(result, target)
  if (!quality.usable) {
    if (process.env.DEBUG_LYRIC_MATCH) {
      console.warn('[lyric-match] rejected low-quality lyric', { source: result?.source, format: result?.format, ...quality })
    }
    return false
  }
  return true
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, '')).trim()
}

function parseClock(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0
  if (/^-?\d+(?:\.\d+)?s$/.test(raw)) return Number(raw.slice(0, -1)) || 0
  if (/^-?\d+(?:\.\d+)?ms$/.test(raw)) return (Number(raw.slice(0, -2)) || 0) / 1000
  const parts = raw.replace(',', '.').split(':').map(Number)
  if (parts.some(n => Number.isNaN(n))) return Number(raw) || 0
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

function parseSimpleLrc(lrcText) {
  const lines = []
  const timeTagRe = /\[(\d+):(\d+)(?:\.(\d+))?\]/g
  for (const raw of String(lrcText || '').split(/\r?\n/)) {
    const text = raw.replace(/\[[^\]]+\]/g, '').trim()
    if (!text || text === '//') continue
    if (/^(?:TME|QQ音乐|腾讯音乐).*(?:翻译|著作权|版权)/i.test(text)) continue
    timeTagRe.lastIndex = 0
    let match
    while ((match = timeTagRe.exec(raw))) {
      const min = Number(match[1]) || 0
      const sec = Number(match[2]) || 0
      let msText = match[3] || '0'
      if (msText.length === 1) msText += '00'
      else if (msText.length === 2) msText += '0'
      else if (msText.length > 3) msText = msText.slice(0, 3)
      lines.push({ time: min * 60 + sec + (Number(msText) || 0) / 1000, text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}

function mergeTranslations(lines, lrcText, toleranceSec = 0.45) {
  const translations = parseSimpleLrc(lrcText)
  if (!translations.length) return lines
  return (lines || []).map(line => {
    const hit = translations.find(item => Math.abs(item.time - line.time) <= toleranceSec)
    return hit ? { ...line, translation: hit.text } : line
  })
}

function attr(tag, name) {
  const re = new RegExp(`${name}=["']([^"']+)["']`, 'i')
  return tag.match(re)?.[1]
}

function resolveWordStartMs(lineStartMs, markerStartMs) {
  // QRC providers may emit word markers as absolute song timestamps, while KRC
  // usually emits offsets relative to the line. Detect absolute markers by
  // comparing with the line start; otherwise fall back to relative offsets.
  return markerStartMs >= lineStartMs - 100 ? markerStartMs : lineStartMs + markerStartMs
}

function parseTtml(ttml) {
  const text = String(ttml || '')
  const lines = []
  const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi
  let pMatch
  while ((pMatch = pRe.exec(text))) {
    const pAttrs = pMatch[1]
    const body = pMatch[2]
    const start = parseClock(attr(pAttrs, 'begin'))
    let end = parseClock(attr(pAttrs, 'end'))
    const words = []
    const spanRe = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi
    let spanMatch
    let fullText = ''
    while ((spanMatch = spanRe.exec(body))) {
      const spanText = stripTags(spanMatch[2])
      if (!spanText) continue
      const wStart = parseClock(attr(spanMatch[1], 'begin')) || start
      const wEnd = parseClock(attr(spanMatch[1], 'end')) || wStart
      words.push({ text: spanText, startSec: wStart, endSec: wEnd, durationSec: Math.max(0.001, wEnd - wStart) })
      fullText += spanText
      if (wEnd > end) end = wEnd
    }
    if (!fullText) fullText = stripTags(body)
    if (fullText) lines.push({ time: start, text: fullText, duration: Math.max(0.001, end - start), words, isYrc: words.length > 0, sourceFormat: 'ttml' })
  }
  return finishLines(lines, 'amll')
}

function finishLines(lines, source) {
  const sorted = (lines || []).filter(l => l.text).sort((a, b) => a.time - b.time)
  for (let i = 0; i < sorted.length; i += 1) {
    const line = sorted[i]
    const next = sorted[i + 1]
    const wordEnd = line.words?.length ? line.words[line.words.length - 1].endSec : 0
    const end = Math.max(wordEnd, line.time + (line.duration || 0), next ? Math.min(next.time, line.time + 8) : line.time + 8)
    line.duration = Math.max(0.2, end - line.time)
    line.isYrc = Boolean(line.words && line.words.length)
    line.lyricSource = source
  }
  return sorted
}

function parseQrc(qrcText) {
  let content = String(qrcText || '')
  const xmlContent = content.match(/LyricContent="([\s\S]*?)"/i)?.[1]
  if (xmlContent) content = decodeHtml(xmlContent)
  const lines = []
  const lineRe = /\[(\d+),(\d+)\]([^\r\n]+)/g
  let lineMatch
  while ((lineMatch = lineRe.exec(content))) {
    const startMs = Number(lineMatch[1]) || 0
    const durMs = Number(lineMatch[2]) || 0
    const body = lineMatch[3]
    const words = []
    let text = ''
    const wordRe = /\((\d+),(\d+)\)/g
    const markers = Array.from(body.matchAll(wordRe))
    const suffixTimed = markers.length > 0 && body.slice(0, markers[0].index).trim()
    for (let i = 0; i < markers.length; i += 1) {
      const wm = markers[i]
      const offset = Number(wm[1]) || 0
      const dur = Number(wm[2]) || 0
      const wordText = suffixTimed
        ? body.slice(i === 0 ? 0 : markers[i - 1].index + markers[i - 1][0].length, wm.index)
        : body.slice(wm.index + wm[0].length, markers[i + 1]?.index ?? body.length)
      if (!wordText) continue
      const wordStartMs = resolveWordStartMs(startMs, offset)
      const startSec = wordStartMs / 1000
      const endSec = (wordStartMs + dur) / 1000
      words.push({ text: wordText, startSec, endSec, durationSec: Math.max(0.001, endSec - startSec) })
      text += wordText
    }
    if (!text) text = body.replace(/\(\d+,\d+\)/g, '').trim()
    if (text) lines.push({ time: startMs / 1000, text, duration: durMs / 1000, words, isYrc: words.length > 0, sourceFormat: 'qrc' })
  }
  return finishLines(lines, 'qq')
}

function parseKrc(krcText) {
  const lines = []
  for (const raw of String(krcText || '').split(/\r?\n/)) {
    const lineMatch = raw.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!lineMatch) continue
    const startMs = Number(lineMatch[1]) || 0
    const durMs = Number(lineMatch[2]) || 0
    const body = lineMatch[3]
    const words = []
    let text = ''
    const wordRe = /<(\d+),(\d+),\d+>/g
    const markers = Array.from(body.matchAll(wordRe))
    const suffixTimed = markers.length > 0 && body.slice(0, markers[0].index).trim()
    for (let i = 0; i < markers.length; i += 1) {
      const wm = markers[i]
      const offset = Number(wm[1]) || 0
      const dur = Number(wm[2]) || 0
      const wordText = suffixTimed
        ? body.slice(i === 0 ? 0 : markers[i - 1].index + markers[i - 1][0].length, wm.index)
        : body.slice(wm.index + wm[0].length, markers[i + 1]?.index ?? body.length)
      if (!wordText) continue
      const wordStartMs = resolveWordStartMs(startMs, offset)
      const startSec = wordStartMs / 1000
      const endSec = (wordStartMs + dur) / 1000
      words.push({ text: wordText, startSec, endSec, durationSec: Math.max(0.001, endSec - startSec) })
      text += wordText
    }
    if (!text) text = body.replace(/<\d+,\d+,\d+>/g, '').trim()
    if (text) lines.push({ time: startMs / 1000, text, duration: durMs / 1000, words, isYrc: words.length > 0, sourceFormat: 'krc' })
  }
  return finishLines(lines, 'kugou')
}

async function fetchText(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) return null
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, options = {}, timeoutMs = 5000) {
  const text = await fetchText(url, options, timeoutMs)
  if (!text) return null
  return JSON.parse(text)
}

async function fetchAmll(platform, id) {
  if (!id) return null
  const url = `${AMLL_DB_BASE_URL}/${platform}/${encodeURIComponent(String(id))}?format=ttml`
  try {
    const ttml = await fetchText(url, { headers: { 'User-Agent': 'ICHIGOMusic/1.0' } }, 4500)
    if (!ttml || !/<tt(?:\s|>)/i.test(ttml)) return null
    const lines = parseTtml(ttml)
    return lines.length ? { source: `amll:${platform}`, format: 'ttml', isWordByWord: true, lines } : null
  } catch (err) {
    return null
  }
}

function toBase64Utf8(str) {
  return Buffer.from(String(str || ''), 'utf8').toString('base64')
}

async function requestQQ(method, moduleName, param) {
  const payload = {
    comm: { ct: 11, cv: '1003006', v: '1003006', os_ver: '15', phonetype: '24122RKC7C', tmeAppID: 'qqmusiclight', nettype: 'NETWORK_WIFI', udid: '0', uid: '0' },
    request: { method, module: moduleName, param }
  }
  const data = await fetchJson(QQ_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': 'tmeLoginType=-1;', 'User-Agent': 'okhttp/3.14.9' },
    body: JSON.stringify(payload)
  }, 5000)
  if (!data || data.code !== 0 || data.request?.code !== 0) return null
  return data.request.data
}

async function searchQQ(keyword, limit = 8) {
  const param = { search_id: String(Math.floor(Math.random() * 1e14 + Date.now() % 86400000)), remoteplace: 'search.android.keyboard', query: String(keyword || '').slice(0, 60), search_type: 0, num_per_page: limit, page_num: 1, highlight: 0, nqc_flag: 0, page_id: 1, grp: 1 }
  const data = await requestQQ('DoSearchForQQMusicLite', 'music.search.SearchCgiService', param)
  const songs = data?.body?.item_song || []
  return songs.map(info => ({ id: Number(info.id || 0), name: info.title || '', artists: (info.singer || []).map((s, idx) => ({ id: s.id || idx, name: s.name || '' })), album: { id: Number(info.album?.id || 0), name: info.album?.name || '' }, duration: (info.interval || 0) * 1000, qqMid: info.mid }))
}

async function fetchQQ(song) {
  if (!song?.id || !song?.qqMid) return null
  const artistsStr = (song.artists || []).map(a => a.name).join(', ')
  const param = { albumName: toBase64Utf8(song.album?.name || ''), crypt: 1, ct: 19, cv: 2111, interval: Math.floor((song.duration || 0) / 1000), lrc_t: 0, qrc: 1, qrc_t: 0, roma: 1, roma_t: 0, singerName: toBase64Utf8(artistsStr), songID: Number(song.id), songName: toBase64Utf8(song.name), trans: 1, trans_t: 0, type: 0 }
  const data = await requestQQ('GetPlayLyricInfo', 'music.musichallSong.PlayLyricInfo', param)
  if (!data?.lyric) return null
  const decrypted = await qrcDecrypt(data.lyric)
  let lines = parseQrc(decrypted)
  if (data.trans) {
    try {
      lines = mergeTranslations(lines, await qrcDecrypt(data.trans))
    } catch (err) {}
  }
  return lines.length ? { source: 'qq', format: 'qrc', isWordByWord: true, providerSong: song, lines } : null
}

function signKugou(params) {
  const keys = Object.keys(params).sort()
  let str = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
  for (const key of keys) str += `${key}=${params[key]}`
  str += 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
  return md5(str)
}

async function requestKugou(url, params, moduleName, headers = {}) {
  const clientTimeMs = Date.now()
  const clientTimeSec = Math.floor(clientTimeMs / 1000)
  const mid = md5(String(clientTimeMs))
  const finalParams = { ...params }
  if (moduleName !== 'Lyric') Object.assign(finalParams, { userid: '0', appid: '3116', token: '', clienttime: clientTimeSec, iscorrection: '1', uuid: '-', mid, dfid: '-', clientver: '11070', platform: 'AndroidFilter' })
  else Object.assign(finalParams, { appid: '3116', clientver: '11070' })
  finalParams.signature = signKugou(finalParams)
  const u = new URL(url)
  Object.keys(finalParams).forEach(k => u.searchParams.set(k, String(finalParams[k])))
  return fetchJson(u.toString(), { headers: { 'User-Agent': `Android14-1070-11070-201-0-${moduleName}-wifi`, 'Connection': 'Keep-Alive', 'KG-Rec': '1', 'KG-RC': '1', 'KG-CLIENTTIMEMS': String(clientTimeMs), mid, ...headers } }, 5000)
}

async function searchKugou(keyword, limit = 8) {
  const data = await requestKugou('http://complexsearch.kugou.com/v2/search/song', { sorttype: '0', keyword, pagesize: limit, page: 1 }, 'SearchSong', { 'x-router': 'complexsearch.kugou.com' })
  const lists = data?.data?.lists || []
  return lists.map(info => ({ id: Number(info.ID || 0), name: info.SongName || '', artists: (info.Singers || []).map((s, idx) => ({ id: idx, name: s.name || '' })), album: { id: Number(info.AlbumID || 0), name: info.AlbumName || '' }, duration: (info.Duration || 0) * 1000, kgHash: info.FileHash }))
}

async function fetchKugou(song) {
  if (!song?.kgHash) return null
  const artistsStr = (song.artists || []).map(a => a.name).join(', ')
  const searchRes = await requestKugou('https://lyrics.kugou.com/v1/search', { album_audio_id: song.id, duration: song.duration, hash: song.kgHash, keyword: `${artistsStr} - ${song.name}`, lrctxt: '1', man: 'no' }, 'Lyric')
  const best = searchRes?.candidates?.[0]
  if (!best) return null
  const downloadRes = await requestKugou('http://lyrics.kugou.com/download', { accesskey: best.accesskey, charset: 'utf8', client: 'mobi', fmt: 'krc', id: best.id, ver: '1' }, 'Lyric')
  if (!downloadRes?.content) return null
  const bytes = Buffer.from(downloadRes.content, 'base64')
  let lyricText = ''
  if (bytes.length >= 4 && bytes[0] === 107 && bytes[1] === 114 && bytes[2] === 99 && bytes[3] === 49) lyricText = await krcDecrypt(bytes)
  else lyricText = bytes.toString('utf8')
  const lines = parseKrc(lyricText)
  return lines.length ? { source: 'kugou', format: 'krc', isWordByWord: true, providerSong: song, lines } : null
}

async function autoMatchLyric(query) {
  const target = { title: query.title || query.name || '', artist: query.artist || '', durationMs: Number(query.durationMs || query.duration || 0), album: query.album || '' }
  const keyword = [target.title, target.artist].filter(Boolean).join(' ')
  const sources = String(query.sources || 'amll,qq,kugou').split(',').map(s => s.trim()).filter(Boolean)

  if (sources.includes('amll') && query.id) {
    const amll = await fetchAmll('ncm', query.id)
    if (amll?.lines?.some(line => line.words?.length) && isUsableMatchedLyric(amll, target)) return amll
  }

  if (sources.includes('qq') && keyword) {
    try {
      const songs = await searchQQ(keyword)
      const candidates = rankCandidates(target, songs, 72, 5)
      for (const best of candidates) {
        const amllQQ = best.song.qqMid ? await fetchAmll('qq', best.song.qqMid) : null
        if (amllQQ?.lines?.some(line => line.words?.length)) {
          const candidate = { ...amllQQ, providerSong: best.song, matchScore: best.score }
          if (isUsableMatchedLyric(candidate, target)) return candidate
        }
        const qq = await fetchQQ(best.song)
        if (qq?.lines?.some(line => line.words?.length)) {
          const candidate = { ...qq, matchScore: best.score }
          if (isUsableMatchedLyric(candidate, target)) return candidate
        }
      }
    } catch (err) {}
  }

  if (sources.includes('kugou') && keyword) {
    try {
      const songs = await searchKugou(keyword)
      const candidates = rankCandidates(target, songs, 72, 5)
      for (const best of candidates) {
        const kg = await fetchKugou(best.song)
        if (kg?.lines?.some(line => line.words?.length)) {
          const candidate = { ...kg, matchScore: best.score }
          if (isUsableMatchedLyric(candidate, target)) return candidate
        }
      }
    } catch (err) {}
  }
  return null
}

module.exports = { autoMatchLyric, parseTtml, parseQrc, parseKrc, fetchAmll, searchQQ, fetchQQ, searchKugou, fetchKugou }
