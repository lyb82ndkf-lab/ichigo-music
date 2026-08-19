// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

export type LayerType = 'background' | 'decoration' | 'media' | 'text' | 'overlay';

export interface ColorPalette {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

export interface EffectEntry {
  type: string;
  layer: LayerType;
  config: Record<string, any>;
}

export interface TemplateConfig {
  name: string;
  nameKey?: string;
  palette: ColorPalette;
  effects: EffectEntry[];
  bpm?: number;
  animationSpeed?: number;
  bgOpacity?: number;
  postfx?: {
    shake?: number;
    zoom?: number;
    tilt?: number;
    glitch?: number;
    hueShift?: number;
  };
  features?: {
    mediaOutline?: boolean;
    autoExtractColors?: boolean;
    motionDetection?: boolean;
    invertMedia?: boolean;
    thresholdMedia?: boolean;
  };
}

export interface MotionTargetInfo {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
}

export interface WordTiming {
  text: string;
  time: number;      // absolute seconds
  duration: number;  // duration in seconds
}

export interface CharTiming {
  char: string;
  time: number;
  duration: number;
  index: number;
}

export interface LyricLine {
  time: number;
  text: string;
  duration?: number;
  translation?: string;
  words?: WordTiming[];
}

export interface UpdateContext {
  time: number;
  deltaTime: number;
  fps: number;
  /** Seconds elapsed since the current text segment / lyric line started */
  segmentTime: number;
  screenWidth: number;
  screenHeight: number;
  palette: ColorPalette;
  animationSpeed: number;
  motionIntensity: number;
  currentText: string;
  translation?: string;
  currentLine?: LyricLine;
  currentLineIndex: number;
  currentLineProgress: number; // 0..1
  currentWordIndex: number;    // active word index in line
  currentWordProgress: number; // 0..1 in current word
  charTimings: CharTiming[];   // interpolated / native character timeline
  beatIntensity: number;
  motionTargets: MotionTargetInfo[];
  songInfo?: {
    title: string;
    artist: string;
    album: string;
  };
  showTitleCard?: boolean;
  showTranslation?: boolean;
}


export interface Beat {
  time: number;
  type: 'kick' | 'snare' | 'accent';
}

export interface LyricChar {
  text: string;
  startTime: number;
  endTime: number;
}

export interface LyricPhrase {
  chars: LyricChar[];
  startTime: number;
  endTime: number;
}

export interface Segment {
  type: 'verse' | 'chorus' | 'bridge';
  startTime: number;
  endTime: number;
}

export interface MusicData {
  bpm: number;
  beats: Beat[];
  lyrics: LyricPhrase[];
  segments: Segment[];
}


function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function resolveColor(color: string, palette: ColorPalette): string {
  if (color === '$line') {
    return luminance(palette.background) > 0.55 ? '#999999' : '#ffffff';
  }
  if (color.startsWith('$')) {
    const key = color.slice(1) as keyof ColorPalette;
    return palette[key] || '#000000';
  }
  return color;
}