// src/utils/lyrics/lyricExporter.js
// Lyrics serialization, formatting, and file export engine for ICHIGOMusic

import {
  annotateFurigana,
  toInlineRubyText,
  toReadingText,
  isJapaneseSong,
  isJapaneseKana
} from './furiganaHelper.js';

/**
 * Format seconds to standard LRC timestamp: [mm:ss.xx]
 * @param {number} sec
 * @param {number} decimals - 2 for [01:23.45], 3 for [01:23.456]
 * @returns {string} e.g. "01:23.45"
 */
export function formatTimestamp(sec, decimals = 2) {
  if (typeof sec !== 'number' || isNaN(sec) || sec < 0) sec = 0;
  
  if (decimals === 3) {
    const totalMs = Math.round(sec * 1000);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mmm = String(ms).padStart(3, '0');
    return `${mm}:${ss}.${mmm}`;
  }
  
  const totalCs = Math.round(sec * 100);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const cc = String(cs).padStart(2, '0');
  return `${mm}:${ss}.${cc}`;
}

/**
 * Format seconds to duration string: mm:ss
 */
export function formatDuration(sec) {
  if (typeof sec !== 'number' || isNaN(sec) || sec <= 0) return '';
  const minutes = Math.floor(sec / 60);
  const remainingSec = Math.floor(sec % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;
}

/**
 * Extract clean song metadata
 */
export function extractSongMeta(song) {
  if (!song) return { title: '', artist: '', album: '', durationSec: 0 };
  
  const title = song.name || song.title || '';
  
  let artist = '';
  if (Array.isArray(song.ar) && song.ar.length > 0) {
    artist = song.ar.map(a => a?.name).filter(Boolean).join(', ');
  } else if (Array.isArray(song.artists) && song.artists.length > 0) {
    artist = song.artists.map(a => a?.name).filter(Boolean).join(', ');
  } else if (typeof song.artist === 'string') {
    artist = song.artist;
  }
  
  let album = '';
  if (song.al?.name) album = song.al.name;
  else if (song.album?.name) album = song.album.name;
  else if (typeof song.album === 'string') album = song.album;
  
  const rawDur = song.durationMs ?? song.duration ?? song.dt ?? 0;
  const durationSec = Number(rawDur) > 1000 ? Number(rawDur) / 1000 : Number(rawDur);
  
  return { title, artist, album, durationSec };
}

/**
 * Sanitize filename for operating system compatibility
 */
export function sanitizeFilename(title, artist, ext = 'lrc') {
  let base = '';
  if (artist && title) {
    base = `${artist} - ${title}`;
  } else if (title) {
    base = title;
  } else if (artist) {
    base = artist;
  } else {
    base = 'lyrics';
  }
  
  // Replace invalid characters: / \ : * ? " < > |
  const safe = base.replace(/[/\\:*?"<>|]/g, '_').trim();
  const cleanExt = ext.replace(/^\./, '');
  return `${safe || 'lyrics'}.${cleanExt}`;
}

/**
 * Filter out pure placeholder interlude lines from exported lyrics
 */
export function filterExportLines(lines, skipInterlude = true) {
  if (!Array.isArray(lines)) return [];
  return lines.filter(line => {
    if (!line) return false;
    if (skipInterlude && line.isInterlude) return false;
    const text = (line.text || '').trim();
    if (skipInterlude && /^\.+$/.test(text)) return false;
    return Boolean(text || line.translation || line.romaji || line.furigana);
  });
}

/**
 * Formats a single line's main text with optional furigana ruby
 */
export function formatLineText(line, options = {}) {
  const { includeFurigana = false, furiganaMode = 'inline' } = options;
  const rawText = (line?.text || '').trim();
  if (!rawText) return '';

  // Only apply furigana if explicitly requested and text contains Japanese kana / furigana
  if (!includeFurigana) return rawText;

  if (furiganaMode === 'inline') {
    return toInlineRubyText(rawText);
  }
  if (furiganaMode === 'reading') {
    return toReadingText(rawText);
  }
  if (furiganaMode === 'ruby_html') {
    const segs = annotateFurigana(rawText);
    if (!Array.isArray(segs) || segs.length === 0) return rawText;
    return segs.map(s => s.ruby ? `<ruby>${s.text}<rt>${s.ruby}</rt></ruby>` : s.text).join('');
  }
  return rawText;
}

/**
 * Format as Standard LRC (line timestamp)
 */
export function formatAsStandardLrc(lines, options = {}) {
  const {
    song,
    includeMeta = true,
    offset = 0,
    skipInterlude = true,
    includeFurigana = false,
    furiganaMode = 'inline' // 'inline' | 'separate' | 'ruby_html' | 'reading'
  } = options;

  const meta = extractSongMeta(song);
  const out = [];

  if (includeMeta) {
    if (meta.title) out.push(`[ti:${meta.title}]`);
    if (meta.artist) out.push(`[ar:${meta.artist}]`);
    if (meta.album) out.push(`[al:${meta.album}]`);
    if (meta.durationSec > 0) out.push(`[length:${formatDuration(meta.durationSec)}]`);
    out.push('[by:ICHIGOMusic]');
    if (offset !== 0) {
      out.push(`[offset:${Math.round(offset * 1000)}]`);
    }
    if (out.length > 0) out.push('');
  }

  const validLines = filterExportLines(lines, skipInterlude);
  const hasJp = isJapaneseSong(validLines);

  for (const line of validLines) {
    const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
    const timestamp = `[${formatTimestamp(lineTime)}]`;
    const rawText = (line.text || '').trim();

    if (includeFurigana && hasJp && furiganaMode === 'separate') {
      // Main text line
      out.push(`${timestamp}${rawText}`);
      // Reading line
      const reading = toReadingText(rawText);
      if (reading && reading !== rawText) {
        out.push(`${timestamp}${reading}`);
      }
    } else {
      const lineText = formatLineText(line, { includeFurigana: includeFurigana && hasJp, furiganaMode });
      out.push(`${timestamp}${lineText}`);
    }
  }

  return out.join('\n');
}

/**
 * Format as Bilingual LRC (Original + Translation)
 * Mode:
 *  - 'interleaved': standard dual LRC lines with same timestamp:
 *      [00:12.34]原文
 *      [00:12.34]译文
 *  - 'combined': [00:12.34]原文 (译文)
 *  - 'block': all original lines followed by all translation lines
 */
export function formatAsBilingualLrc(lines, options = {}) {
  const {
    song,
    includeMeta = true,
    offset = 0,
    skipInterlude = true,
    bilingualMode = 'interleaved', // 'interleaved' | 'combined' | 'block'
    includeRomaji = false,
    includeFurigana = false,
    furiganaMode = 'inline'
  } = options;

  const meta = extractSongMeta(song);
  const out = [];

  if (includeMeta) {
    if (meta.title) out.push(`[ti:${meta.title}]`);
    if (meta.artist) out.push(`[ar:${meta.artist}]`);
    if (meta.album) out.push(`[al:${meta.album}]`);
    if (meta.durationSec > 0) out.push(`[length:${formatDuration(meta.durationSec)}]`);
    out.push('[by:ICHIGOMusic]');
    if (offset !== 0) {
      out.push(`[offset:${Math.round(offset * 1000)}]`);
    }
    if (out.length > 0) out.push('');
  }

  const validLines = filterExportLines(lines, skipInterlude);
  const hasJp = isJapaneseSong(validLines);

  if (bilingualMode === 'combined') {
    for (const line of validLines) {
      const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
      const timestamp = `[${formatTimestamp(lineTime)}]`;
      const text = formatLineText(line, { includeFurigana: includeFurigana && hasJp, furiganaMode });
      const trans = (line.translation || '').trim();
      const romaji = includeRomaji && (line.romaji || '').trim();
      
      let mergedText = text;
      if (romaji) mergedText += ` [${romaji}]`;
      if (trans) mergedText += ` (${trans})`;
      
      out.push(`${timestamp}${mergedText}`);
    }
  } else if (bilingualMode === 'block') {
    // Originals first
    for (const line of validLines) {
      const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
      const timestamp = `[${formatTimestamp(lineTime)}]`;
      const text = formatLineText(line, { includeFurigana: includeFurigana && hasJp, furiganaMode });
      out.push(`${timestamp}${text}`);
    }
    // Translations second
    const hasAnyTranslation = validLines.some(l => (l.translation || '').trim());
    if (hasAnyTranslation) {
      out.push('');
      for (const line of validLines) {
        const trans = (line.translation || '').trim();
        if (trans) {
          const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
          const timestamp = `[${formatTimestamp(lineTime)}]`;
          out.push(`${timestamp}${trans}`);
        }
      }
    }
  } else {
    // Default 'interleaved' (standard player friendly dual timestamps)
    for (const line of validLines) {
      const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
      const timestamp = `[${formatTimestamp(lineTime)}]`;
      const text = formatLineText(line, { includeFurigana: includeFurigana && hasJp, furiganaMode });
      const trans = (line.translation || '').trim();
      const romaji = includeRomaji && (line.romaji || '').trim();

      out.push(`${timestamp}${text}`);
      if (romaji) {
        out.push(`${timestamp}${romaji}`);
      }
      if (trans) {
        out.push(`${timestamp}${trans}`);
      }
    }
  }

  return out.join('\n');
}

/**
 * Format as NetEase YRC verbatim word-by-word format
 * e.g. [lineStartMs,lineDurMs](wordStartMs,wordDurMs,0)Word1(wordStartMs,wordDurMs,0)Word2
 */
export function formatAsYrc(lines, options = {}) {
  const { song, includeMeta = true, offset = 0, skipInterlude = true } = options;
  const meta = extractSongMeta(song);
  const out = [];

  if (includeMeta) {
    if (meta.title) out.push(`[ti:${meta.title}]`);
    if (meta.artist) out.push(`[ar:${meta.artist}]`);
    if (meta.album) out.push(`[al:${meta.album}]`);
    if (meta.durationSec > 0) out.push(`[length:${formatDuration(meta.durationSec)}]`);
    out.push('[by:ICHIGOMusic]');
    if (offset !== 0) {
      out.push(`[offset:${Math.round(offset * 1000)}]`);
    }
    if (out.length > 0) out.push('');
  }

  const validLines = filterExportLines(lines, skipInterlude);

  for (const line of validLines) {
    const lineTimeSec = Math.max(0, (Number(line.time) || 0) + (offset || 0));
    const lineDurationSec = Number(line.duration) || 5;
    const lineStartMs = Math.round(lineTimeSec * 1000);
    const lineDurMs = Math.round(lineDurationSec * 1000);

    if (Array.isArray(line.words) && line.words.length > 0) {
      let wordTokens = '';
      for (const w of line.words) {
        const wStartSec = Math.max(0, (Number(w.startSec) || 0) + (offset || 0));
        const wDurSec = Math.max(0.01, Number(w.durationSec) || (Number(w.endSec) - Number(w.startSec)) || 0.2);
        const wStartMs = Math.round(wStartSec * 1000);
        const wDurMs = Math.round(wDurSec * 1000);
        const wText = w.text || '';
        wordTokens += `(${wStartMs},${wDurMs},0)${wText}`;
      }
      out.push(`[${lineStartMs},${lineDurMs}]${wordTokens}`);
    } else {
      // Fallback line-level YRC token
      const text = (line.text || '').trim();
      out.push(`[${lineStartMs},${lineDurMs}](${lineStartMs},${lineDurMs},0)${text}`);
    }
  }

  return out.join('\n');
}

/**
 * Format as Enhanced LRC (Karaoke inline timestamp format)
 * e.g. [01:23.45]<01:23.45>Word1 <01:24.00>Word2
 */
export function formatAsEnhancedLrc(lines, options = {}) {
  const { song, includeMeta = true, offset = 0, skipInterlude = true } = options;
  const meta = extractSongMeta(song);
  const out = [];

  if (includeMeta) {
    if (meta.title) out.push(`[ti:${meta.title}]`);
    if (meta.artist) out.push(`[ar:${meta.artist}]`);
    if (meta.album) out.push(`[al:${meta.album}]`);
    if (meta.durationSec > 0) out.push(`[length:${formatDuration(meta.durationSec)}]`);
    out.push('[by:ICHIGOMusic]');
    if (out.length > 0) out.push('');
  }

  const validLines = filterExportLines(lines, skipInterlude);

  for (const line of validLines) {
    const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
    const lineTimestamp = `[${formatTimestamp(lineTime)}]`;

    if (Array.isArray(line.words) && line.words.length > 0) {
      let wordTokens = '';
      for (const w of line.words) {
        const wTime = Math.max(0, (Number(w.startSec) || 0) + (offset || 0));
        wordTokens += `<${formatTimestamp(wTime)}>${w.text || ''}`;
      }
      out.push(`${lineTimestamp}${wordTokens}`);
    } else {
      out.push(`${lineTimestamp}${(line.text || '').trim()}`);
    }
  }

  return out.join('\n');
}

/**
 * Format as Plain Text (no timestamps, ideal for reading/copying)
 */
export function formatAsPlainText(lines, options = {}) {
  const {
    song,
    includeMeta = true,
    includeTranslation = true,
    includeRomaji = false,
    includeFurigana = false,
    furiganaMode = 'inline',
    skipInterlude = true
  } = options;

  const meta = extractSongMeta(song);
  const out = [];

  if (includeMeta) {
    if (meta.title) out.push(`歌名：${meta.title}`);
    if (meta.artist) out.push(`歌手：${meta.artist}`);
    if (meta.album) out.push(`专辑：${meta.album}`);
    if (meta.durationSec > 0) out.push(`时长：${formatDuration(meta.durationSec)}`);
    if (out.length > 0) {
      out.push('----------------------------------------');
      out.push('');
    }
  }

  const validLines = filterExportLines(lines, skipInterlude);
  const hasJp = isJapaneseSong(validLines);

  for (const line of validLines) {
    const rawText = (line.text || '').trim();
    const trans = (line.translation || '').trim();
    const romaji = includeRomaji && (line.romaji || '').trim();
    const text = formatLineText(line, { includeFurigana: includeFurigana && hasJp, furiganaMode });

    if (text) out.push(text);
    if (romaji) out.push(romaji);
    if (includeTranslation && trans) out.push(trans);
    
    // Add spacer between lines if bilingual to make reading pleasant
    if ((includeTranslation && trans) || romaji) {
      out.push('');
    }
  }

  return out.join('\n').trim();
}

/**
 * Format as AMLL TTML (Timed Text Markup Language)
 */
export function formatAsTtml(lines, options = {}) {
  const { song, offset = 0, skipInterlude = true, includeFurigana = false } = options;
  const meta = extractSongMeta(song);
  const validLines = filterExportLines(lines, skipInterlude);
  const hasJp = isJapaneseSong(validLines);

  const escapeXml = (unsafe) => {
    return String(unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlLines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-extensions">',
    '  <head>',
    '    <metadata>',
    `      <ttm:title>${escapeXml(meta.title)}</ttm:title>`,
    `      <ttm:agent>${escapeXml(meta.artist)}</ttm:agent>`,
    '      <ttm:copyright>ICHIGOMusic</ttm:copyright>',
    '    </metadata>',
    '  </head>',
    '  <body>',
    '    <div>'
  ];

  for (const line of validLines) {
    const lineTime = Math.max(0, (Number(line.time) || 0) + (offset || 0));
    const lineDur = Number(line.duration) || 5;
    const lineEnd = lineTime + lineDur;
    
    const beginTime = formatTimestamp(lineTime, 3);
    const endTime = formatTimestamp(lineEnd, 3);

    if (Array.isArray(line.words) && line.words.length > 0) {
      let spans = '';
      for (const w of line.words) {
        const wStart = Math.max(0, (Number(w.startSec) || 0) + (offset || 0));
        const wEnd = Math.max(wStart + 0.05, (Number(w.endSec) || (wStart + 0.3)) + (offset || 0));
        const wText = escapeXml(w.text);
        spans += `<span begin="${formatTimestamp(wStart, 3)}" end="${formatTimestamp(wEnd, 3)}">${wText}</span>`;
      }
      xmlLines.push(`      <p begin="${beginTime}" end="${endTime}">${spans}</p>`);
    } else {
      if (includeFurigana && hasJp) {
        const segs = annotateFurigana(line.text || '');
        if (Array.isArray(segs) && segs.length > 0) {
          const rubyText = segs.map(s => s.ruby ? `<ruby><rb>${escapeXml(s.text)}</rb><rt>${escapeXml(s.ruby)}</rt></ruby>` : escapeXml(s.text)).join('');
          xmlLines.push(`      <p begin="${beginTime}" end="${endTime}">${rubyText}</p>`);
        } else {
          xmlLines.push(`      <p begin="${beginTime}" end="${endTime}">${escapeXml(line.text)}</p>`);
        }
      } else {
        xmlLines.push(`      <p begin="${beginTime}" end="${endTime}">${escapeXml(line.text)}</p>`);
      }
    }

    if (line.translation) {
      xmlLines.push(`      <!-- Translation: ${escapeXml(line.translation)} -->`);
    }
  }

  xmlLines.push('    </div>');
  xmlLines.push('  </body>');
  xmlLines.push('</tt>');

  return xmlLines.join('\n');
}

/**
 * Universal lyric export dispatcher
 * @param {Array} lines
 * @param {string} format - 'lrc' | 'bilingual_lrc' | 'yrc' | 'enhanced_lrc' | 'txt' | 'ttml'
 * @param {Object} options
 * @returns {string} Formatted lyric text
 */
export function generateLyricExport(lines, format = 'lrc', options = {}) {
  if (!lines || lines.length === 0) {
    return '暂无可用歌词数据';
  }

  switch (format) {
    case 'bilingual_lrc':
      return formatAsBilingualLrc(lines, options);
    case 'yrc':
      return formatAsYrc(lines, options);
    case 'enhanced_lrc':
      return formatAsEnhancedLrc(lines, options);
    case 'txt':
      return formatAsPlainText(lines, options);
    case 'ttml':
      return formatAsTtml(lines, options);
    case 'lrc':
    default:
      return formatAsStandardLrc(lines, options);
  }
}

/**
 * Get file extension for format
 */
export function getFormatExtension(format) {
  switch (format) {
    case 'txt':
      return 'txt';
    case 'yrc':
      return 'yrc';
    case 'ttml':
      return 'ttml';
    case 'bilingual_lrc':
    case 'enhanced_lrc':
    case 'lrc':
    default:
      return 'lrc';
  }
}

/**
 * Download or save lyric file using Electron IPC or browser download fallback
 */
export async function downloadLyricFile(content, filename = 'lyrics.lrc', mimeType = 'text/plain;charset=utf-8') {
  if (!content) return { success: false, error: '歌词内容为空' };

  // 1. Electron IPC save file dialog
  if (typeof window !== 'undefined' && window.electronAPI?.saveLyricFile) {
    try {
      const ext = filename.split('.').pop() || 'lrc';
      const filterName = `${ext.toUpperCase()} 歌词文件 (*.${ext})`;
      const res = await window.electronAPI.saveLyricFile({
        defaultFilename: filename,
        content,
        filters: [
          { name: filterName, extensions: [ext] },
          { name: '所有文件 (*.*)', extensions: ['*'] }
        ]
      });

      if (res?.success) {
        return { success: true, method: 'electron', filePath: res.filePath };
      }
      if (res?.canceled) {
        return { success: false, canceled: true };
      }
    } catch (err) {
      console.warn('Electron saveLyricFile failed, falling back to browser download', err);
    }
  }

  // 2. Browser fallback Blob download
  if (typeof document !== 'undefined') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return { success: true, method: 'browser' };
    } catch (err) {
      console.error('Browser download failed:', err);
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: '环境不支持文件导出' };
}

/**
 * Copy formatted lyrics to system clipboard
 */
export async function copyLyricToClipboard(content) {
  if (!content) return false;

  // 1. Modern navigator.clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed:', err);
    }
  }

  // 2. Legacy fallback
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback execCommand copy failed:', err);
      return false;
    }
  }

  return false;
}
