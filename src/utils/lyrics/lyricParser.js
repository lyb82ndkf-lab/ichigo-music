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
  
  const lines = yrcStr.split(/\r?\n/);
  const result = [];
  
  // Matches either [min:sec.ms] or [lineStartTimeMs,lineDurationMs]
  const lrcTimeRegex = /^\[(\d+):(\d+)(?:\.(\d+))?\]/;
  const yrcTimeRegex = /^\[(\d+),(\d+)\]/;
  
  // Format: (startMs,durationMs,0)wordText
  const wordRegex = /\((\d+),(\d+),\d+\)([^\(\n]*)/g;

  for (const line of lines) {
    let lineTime = 0;
    let lineDuration = 0;
    let rest = line;
    let isYrcFormat = false;

    const yrcTimeMatch = yrcTimeRegex.exec(line);
    if (yrcTimeMatch) {
      const lineStartTimeMs = parseInt(yrcTimeMatch[1], 10);
      const lineDurationMs = parseInt(yrcTimeMatch[2], 10);
      lineTime = lineStartTimeMs / 1000;
      lineDuration = lineDurationMs / 1000;
      rest = line.substring(yrcTimeMatch[0].length);
      isYrcFormat = true;
    } else {
      const lrcTimeMatch = lrcTimeRegex.exec(line);
      if (lrcTimeMatch) {
        const min = parseInt(lrcTimeMatch[1], 10);
        const sec = parseInt(lrcTimeMatch[2], 10);
        let msStr = lrcTimeMatch[3] || '0';
        if (msStr.length === 1) msStr += '00';
        else if (msStr.length === 2) msStr += '0';
        else if (msStr.length > 3) msStr = msStr.substring(0, 3);
        const ms = parseInt(msStr, 10);
        lineTime = min * 60 + sec + ms / 1000;
        rest = line.substring(lrcTimeMatch[0].length);
        isYrcFormat = true;
      }
    }

    if (!isYrcFormat) continue;

    const words = [];
    let match;
    let rawLineText = '';

    wordRegex.lastIndex = 0;
    while ((match = wordRegex.exec(rest)) !== null) {
      const startVal = parseInt(match[1], 10);
      const durationVal = parseInt(match[2], 10);
      const text = match[3];

      let wordStartSec = 0;
      // If startVal is an absolute timestamp (in ms), it will be greater than or equal to lineTime * 1000.
      // But to be safe, if startVal is greater than lineTime (meaning it's not a relative small offset),
      // we treat it as absolute.
      if (startVal >= lineTime * 1000 - 100) {
        wordStartSec = startVal / 1000;
      } else {
        wordStartSec = lineTime + startVal / 1000;
      }
      
      const wordDurationSec = durationVal / 1000;
      const wordEndSec = wordStartSec + wordDurationSec;

      words.push({
        startSec: wordStartSec,
        endSec: wordEndSec,
        durationSec: wordDurationSec,
        text: text
      });
      rawLineText += text;
    }

    if (words.length > 0) {
      result.push({
        time: lineTime,
        duration: lineDuration || (words[words.length - 1].endSec - lineTime),
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
    
    if (!(current.words && current.words.length > 0)) {
      let duration = next ? next.time - current.time : 5;
      const estimatedReadingTime = (current.text || '').length * 0.5;
      if (duration > estimatedReadingTime + 2 && duration > 5) {
        duration = Math.min(duration, estimatedReadingTime + 2);
      }
      current.duration = duration;
    } else {
      if (next) {
        current.duration = next.time - current.time;
      } else {
        current.duration = 8.0; // fallback default
      }
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
      if (current.words && current.words.length > 0) {
        currentEndTime = current.words[current.words.length - 1].endSec;
      } else {
        // LRC line: assume vocal ends early
        currentEndTime = current.time + Math.min(current.duration - 0.5, current.duration * 0.85);
      }

      // Check if there is a gap to the next line
      const gap = next.time - currentEndTime;
      if (gap > 3.0) {
        current.duration = currentEndTime - current.time;
        processed.push(createInterlude(currentEndTime + 0.05, next.time - 0.05));
      }
    }
  }

  return processed;
}
