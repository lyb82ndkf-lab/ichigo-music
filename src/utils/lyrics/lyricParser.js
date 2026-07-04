// src/utils/lyrics/lyricParser.js

/**
 * Enhanced standard LRC parser
 * Supports:
 * - 2/3 digits milliseconds
 * - Multiple timestamps on a single line ([01:00.00][02:00.00]text)
 */
export function parseLrc(lrcStr) {
  if (!lrcStr) return [];
  const lines = lrcStr.split('\n');
  const result = [];
  
  // Match one or more timestamp tags at the beginning of the line
  const timeTagRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/g;

  for (const line of lines) {
    const rawText = line.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').trim();
    if (!rawText) continue;

    timeTagRegex.lastIndex = 0;
    let match;
    while ((match = timeTagRegex.exec(line)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      let msStr = match[3] || '0';
      // Normalize to 3 digits
      if (msStr.length === 1) msStr += '00';
      else if (msStr.length === 2) msStr += '0';
      else if (msStr.length > 3) msStr = msStr.substring(0, 3);
      
      const ms = parseInt(msStr);
      const time = min * 60 + sec + ms / 1000;
      
      result.push({ time, text: rawText, isYrc: false });
    }
  }

  // Sort by time just in case multiple tags were out of order
  result.sort((a, b) => a.time - b.time);
  return result;
}

/**
 * Enhanced NetEase YRC word-by-word parser
 */
export function parseYrc(yrcStr) {
  if (!yrcStr) return [];
  
  const lines = yrcStr.split('\n');
  const result = [];
  const timeRegex = /\[(\d+):(\d+)(?:\.(\d+))?\]/;
  // Format: (startMs,durationMs,0)wordText
  const wordRegex = /\((\d+),(\d+),\d+\)([^\(\n]*)/g;

  for (const line of lines) {
    const timeMatch = timeRegex.exec(line);
    if (!timeMatch) continue;

    const min = parseInt(timeMatch[1]);
    const sec = parseInt(timeMatch[2]);
    let msStr = timeMatch[3] || '0';
    if (msStr.length === 1) msStr += '00';
    else if (msStr.length === 2) msStr += '0';
    else if (msStr.length > 3) msStr = msStr.substring(0, 3);
    
    const ms = parseInt(msStr);
    const lineTime = min * 60 + sec + ms / 1000;

    const words = [];
    let match;
    let rawLineText = '';

    wordRegex.lastIndex = 0;
    while ((match = wordRegex.exec(line)) !== null) {
      const start = parseInt(match[1]);
      const duration = parseInt(match[2]);
      const text = match[3];

      words.push({
        startSec: lineTime + start / 1000,
        endSec: lineTime + (start + duration) / 1000,
        durationSec: duration / 1000,
        text: text
      });
      rawLineText += text;
    }

    if (words.length > 0) {
      result.push({
        time: lineTime,
        text: rawLineText,
        words: words,
        isYrc: true
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

/**
 * Merge translation text into standard or YRC parsed lyrics
 */
export function mergeTranslation(lyrics, tlyricStr) {
  if (!tlyricStr || lyrics.length === 0) return lyrics;
  
  const translationLrc = parseLrc(tlyricStr);
  if (translationLrc.length === 0) return lyrics;

  return lyrics.map(line => {
    // Find the translation line with nearest timestamp (within 0.35s tolerance)
    const transLine = translationLrc.find(tLine => Math.abs(tLine.time - line.time) < 0.35);
    return {
      ...line,
      translation: transLine ? transLine.text : ''
    };
  });
}

export function computeLineDurations(lines) {
  if (!lines || lines.length === 0) return [];
  const processed = [];

  const createInterlude = (start, end) => {
    const duration = end - start;
    const wordDuration = duration / 6;
    const words = [];
    for (let index = 0; index < 6; index += 1) {
      words.push({
        text: '.',
        startSec: start + (index * wordDuration),
        endSec: start + ((index + 1) * wordDuration),
        durationSec: wordDuration
      });
    }
    return {
      time: start,
      text: '......',
      isYrc: true,
      duration: duration,
      words: words,
      translation: ''
    };
  };

  // 1. Calculate durations for all original lines first
  const rawLines = lines.map((line, idx) => {
    const current = { ...line };
    const next = lines[idx + 1];
    if (next) {
      current.duration = next.time - current.time;
    } else {
      current.duration = 8.0; // fallback default
    }
    return current;
  });

  // 2. Add initial interlude if song starts with a gap > 3.0 seconds
  if (rawLines[0].time > 3.0) {
    processed.push(createInterlude(0.5, rawLines[0].time - 0.5));
  }

  // 3. Loop through lines and insert gap interludes
  for (let i = 0; i < rawLines.length; i++) {
    const current = rawLines[i];
    processed.push(current);

    const next = rawLines[i + 1];
    if (next) {
      // Calculate current line's true vocal end time
      let currentEndTime = current.time + current.duration;
      if (current.isYrc && current.words && current.words.length > 0) {
        currentEndTime = current.words[current.words.length - 1].endSec;
      } else {
        // LRC line: assume vocal ends early
        currentEndTime = current.time + Math.min(current.duration - 0.5, current.duration * 0.85);
      }

      // Check if there is a gap to the next line
      const gap = next.time - currentEndTime;
      if (gap > 3.0) {
        processed.push(createInterlude(currentEndTime + 0.05, next.time - 0.05));
      }
    }
  }

  return processed;
}
