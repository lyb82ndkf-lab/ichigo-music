// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import type { TemplateConfig, UpdateContext, ColorPalette, LayerType, MotionTargetInfo, LyricLine } from './types';
import { createEffect, BaseEffect } from '../effects';
import { extractDominantColors } from './colorExtractor';
import { MediaOutlineRenderer } from './mediaOutline';
import { GlitchFilter } from './glitchFilter';
import { BeatProvider } from './beatProvider';
import { MotionDetector } from './motionDetector';
import { NowPlayingProvider } from './nowPlayingProvider';
import type { NowPlayingTrack } from './nowPlayingProvider';

const EFFECT_LAYERS: LayerType[] = ['background', 'decoration', 'text', 'overlay'];

export class PVEngine {
  private app: PIXI.Application;
  private layers = new Map<LayerType, PIXI.Container>();
  private effectsRoot!: PIXI.Container;
  private activeEffects: BaseEffect[] = [];
  private palette: ColorPalette = {
    background: '#ffffff',
    primary: '#000000',
    secondary: '#666666',
    accent: '#ff0000',
    text: '#000000',
  };
  private currentTemplate: TemplateConfig | null = null;
  private userText = '';

  private _animationSpeed = 2;
  private _motionIntensity = 1;
  private textSegments: string[] = [''];
  private lyricTimeline: LyricLine[] | null = null;
  private lyricOffsetSeconds = 0;
  private lyricCursor = 0;
  private lastLyricTime = -1;
  private _segmentDuration = 3;
  private _srtTimeline: { startMs: number; endMs: number; text: string }[] | null = null;
  private _effectOpacity = 1;
  private _alphaMode = false;
  private _hueShift = 0;
  private _nowPlayingListening = false;
  private hueFilter: PIXI.ColorMatrixFilter;
  private glitchFilter: GlitchFilter;
  private bgFill!: PIXI.Graphics;

  private _shake = 0;
  private _zoom = 0;
  private _tilt = 0;
  private _glitch = 0;

  private mediaElement: HTMLVideoElement | HTMLImageElement | null = null;
  private outlineRenderer: MediaOutlineRenderer | null = null;
  private _outlineEnabled = false;
  private extractingColors = false;

  private motionDetector: MotionDetector | null = null;
  private _motionDetectionEnabled = false;
  private motionTargets: MotionTargetInfo[] = [];

  private invertFilter: PIXI.ColorMatrixFilter | null = null;
  private _invertMediaEnabled = false;
  private _thresholdMediaEnabled = false;

  readonly beat = new BeatProvider();
  private _beatReactivity = 0.5;

  private _nativeDPR = 1;
  private _currentResolution = 1;
  private _resizeParent: HTMLElement | null = null;
  private _loading = false;
  private _bgColorOverride: string | null = null;
  private _tick = 0;
  private _playbackTime = 0;
  private _paused = false;
  private _time = 0;
  private _lastFrameTime = 0;

  // Now Playing state
  private npProvider: NowPlayingProvider | null = null;
  private _npActive = false;
  private _npPaused = false;
  private _npTime = 0;
  private _npDuration = 0;
  private _npTrack: NowPlayingTrack | null = null;
  private _npSavedUserText: string | null = null;

  private _externalTime: number | null = null;
  private _audioFreqBuffer: Uint8Array | null = null;
  private _smoothedBass = 0;
  private _smoothedMid = 0;
  private _smoothedTreble = 0;
  private _smoothedEnergy = 0;
  private _lastBeatTime = 0;

  constructor() {
    this.app = new PIXI.Application();
    this.hueFilter = new PIXI.ColorMatrixFilter();
    this.glitchFilter = new GlitchFilter();
  }

  async init(parent: HTMLElement) {
    this._nativeDPR = Math.min(window.devicePixelRatio || 1, 3);
    this._currentResolution = this._nativeDPR;
    this._resizeParent = parent;

    await this.app.init({
      resizeTo: parent,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      antialias: true,
      resolution: this._nativeDPR,
      autoDensity: true,
      preserveDrawingBuffer: true,
    });
    parent.appendChild(this.app.canvas);
    this.app.ticker.maxFPS = 60;

    // Media layer at the very bottom
    const mediaLayer = new PIXI.Container();
    this.layers.set('media', mediaLayer);
    this.app.stage.addChild(mediaLayer);

    // All effect layers inside one container, on top of media
    this.effectsRoot = new PIXI.Container();
    this.app.stage.addChild(this.effectsRoot);

    // Solid background fill as the first child — ensures full coverage over media
    this.bgFill = new PIXI.Graphics();
    this.effectsRoot.addChild(this.bgFill);

    for (const layerType of EFFECT_LAYERS) {
      const container = new PIXI.Container();
      this.layers.set(layerType, container);
      this.effectsRoot.addChild(container);
    }

    // 歌曲开场标题卡容器
    this.titleCardContainer = new PIXI.Container();
    this.titleCardGfx = new PIXI.Graphics();
    this.titleCardBadge = new PIXI.Text({
      text: 'NOW PLAYING',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "Inter", sans-serif',
        fontSize: 10,
        fontWeight: '800',
        fill: '#ffffff',
        letterSpacing: 2
      })
    });
    this.titleCardTitle = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 28,
        fontWeight: 'bold',
        fill: '#ffffff',
        dropShadow: {
          color: '#000000',
          blur: 12,
          distance: 2,
          alpha: 0.8
        }
      })
    });
    this.titleCardSubtitle = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 14,
        fill: 'rgba(255, 255, 255, 0.75)'
      })
    });

    this.titleCardContainer.addChild(this.titleCardGfx);
    this.titleCardContainer.addChild(this.titleCardBadge);
    this.titleCardContainer.addChild(this.titleCardTitle);
    this.titleCardContainer.addChild(this.titleCardSubtitle);
    this.titleCardContainer.visible = false;
    this.effectsRoot.addChild(this.titleCardContainer);

    this._lastFrameTime = performance.now();

    this.app.stage.filters = [this.hueFilter, this.glitchFilter];


    this.app.ticker.add((ticker) => {
      const now = performance.now();
      const dt = (now - this._lastFrameTime) / 1000;
      this._lastFrameTime = now;

      if (!this._paused) {
        if (this._externalTime !== null) {
          // 平滑帧插值：在外部播放器 timeupdate (通常 50ms~250ms) 间隔内，每帧依真实 dt 匀速推进，确保 60fps/120fps 极度丝滑逐字渲染
          this._externalTime += dt;
          this._time = this._externalTime;
        } else if (this._npActive) {
          // In Now Playing mode, advance time locally when not paused
          if (!this._npPaused) {
            this._npTime += dt;
          }
          this._time = this._npTime;
        } else if (this.beat.isAudioMode) {
          this._time = this.beat.currentTime;
        } else {
          this._time += dt;
        }
      }

      // ticker.deltaTime is normalised to "1 = 1 frame at maxFPS"; divide
      // by maxFPS to convert to real seconds. Reading maxFPS dynamically
      // (instead of hardcoding 60) keeps the conversion correct if the
      // ticker target is ever retuned.
      const targetFps = this.app.ticker.maxFPS || 60;
      this.update(this._time, this._paused ? 0 : ticker.deltaTime / targetFps);
    });
  }

  get paused() { return this._paused; }

  setPlaybackTime(time: number, isPlaying = true) {
    this._externalTime = Math.max(0, time);
    this._time = this._externalTime;
    if (isPlaying) {
      if (this._paused) this.resume();
    } else {
      if (!this._paused) this.pause();
    }
  }

  clearExternalTime() {
    this._externalTime = null;
  }

  pause() {
    this._paused = true;
    this.beat.pause();
  }

  resume() {
    this._paused = false;
    this._lastFrameTime = performance.now();
    this.beat.resume();
  }

  seek(time: number) {
    this._time = Math.max(0, time);
    if (this._externalTime !== null) {
      this._externalTime = this._time;
    }
    if (this._npActive) {
      this._npTime = this._time;
    } else if (this.beat.isAudioMode) {
      this.beat.seek(this._time);
    }
  }

  private _songInfo: { title: string; artist: string; album: string } | null = null;

  private _showTitleCard = true;
  private _showTranslation = true;
  private titleCardContainer!: PIXI.Container;
  private titleCardTitle!: PIXI.Text;
  private titleCardSubtitle!: PIXI.Text;
  private titleCardBadge!: PIXI.Text;
  private titleCardGfx!: PIXI.Graphics;

  loadTemplate(template: TemplateConfig) {
    try {
      this.clearEffects();

      // 彻底重置所有后处理与滤镜状态，杜绝模板切换后产生崩坏或残留撕裂
      this._shake = 0;
      this._zoom = 0;
      this._tilt = 0;
      this.glitch = 0;
      this.hueShift = 0;
      if (this.app?.stage) {
        this.app.stage.position.set(0, 0);
        this.app.stage.scale.set(1, 1);
        this.app.stage.rotation = 0;
      }
      if (this.glitchFilter) {
        this.glitchFilter.strength = 0;
      }
      if (this.hueFilter) {
        this.hueFilter.reset();
      }

      this.currentTemplate = template;
      this.palette = { ...template.palette };

      this.beat.bpm = template.bpm ?? 120;
      if (template.animationSpeed !== undefined) {
        this._animationSpeed = template.animationSpeed;
      }
      if (template.bgOpacity !== undefined) {
        this._effectOpacity = template.bgOpacity;
        if (this.bgFill) this.bgFill.alpha = template.bgOpacity;
      }

      this._outlineEnabled = template.features?.mediaOutline ?? false;
      this._motionDetectionEnabled = template.features?.motionDetection ?? false;
      this._invertMediaEnabled = template.features?.invertMedia ?? false;
      this._thresholdMediaEnabled = template.features?.thresholdMedia ?? false;
      this.syncMotionDetector();
      this.syncInvertFilter();

      if (template.features?.autoExtractColors && this.mediaElement && !this.extractingColors) {
        this.applyExtractedColors();
      }

      if (this._bgColorOverride) {
        this.palette.background = this._bgColorOverride;
      }
      if (!this._alphaMode && this.app?.renderer?.background) {
        this.app.renderer.background.color = new PIXI.Color(this.palette.background).toNumber();
      }
      this.updateBgFill();

      for (const entry of template.effects) {
        const layer = this.layers.get(entry.layer);
        if (!layer) continue;

        const config = { ...entry.config };
        if (this.userText) {
          config._userText = this.textSegments[0] || this.userText;
        }

        try {
          const effect = createEffect(entry.type, layer, config, this.palette, this.app.renderer);
          this.activeEffects.push(effect);
        } catch (err) {
          console.warn(`[PVEngine] Failed to create effect "${entry.type}":`, err);
        }
      }

      if (template.postfx) {
        this._shake = template.postfx.shake ?? 0;
        this._zoom = template.postfx.zoom ?? 0;
        this._tilt = template.postfx.tilt ?? 0;
        this.glitch = template.postfx.glitch ?? 0;
        this.hueShift = template.postfx.hueShift ?? 0;
      }

      this.syncOutline();
      this.syncResolution();
    } catch (err) {
      console.warn('[PVEngine] loadTemplate error:', err);
    }
  }

  setSongInfo(info: { title?: string; artist?: string; album?: string }) {
    this._songInfo = {
      title: info.title || '',
      artist: info.artist || '',
      album: info.album || ''
    };
  }

  set showTitleCard(val: boolean) {
    this._showTitleCard = val;
  }
  get showTitleCard() {
    return this._showTitleCard;
  }

  set showTranslation(val: boolean) {
    this._showTranslation = val;
  }
  get showTranslation() {
    return this._showTranslation;
  }

  private _showFurigana = true;
  set showFurigana(val: boolean) {
    this._showFurigana = val;
  }
  get showFurigana() {
    return this._showFurigana;
  }


  setText(text: string) {
    this.clearLyricTimeline();
    this.userText = text;
    this.textSegments = text
      .split('/')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    if (this.textSegments.length === 0) {
      this.textSegments = [''];
    }
    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  set animationSpeed(val: number) { this._animationSpeed = val; }
  get animationSpeed() { return this._animationSpeed; }

  set motionIntensity(val: number) { this._motionIntensity = val; }
  get motionIntensity() { return this._motionIntensity; }

  set segmentDuration(val: number) { this._segmentDuration = val; }
  get segmentDuration() { return this._segmentDuration; }

  setSrtTimeline(entries: { startMs: number; endMs: number; text: string }[] | null) {
    this._srtTimeline = entries;
    if (entries && entries.length > 0) {
      this.clearLyricTimeline();
    }
  }

  setLyricTimeline(lines: LyricLine[], offsetSeconds = 0): void {
    if (!lines || lines.length === 0) {
      this.clearLyricTimeline();
      return;
    }

    this._srtTimeline = null;
    this.lyricOffsetSeconds = offsetSeconds;

    // 智能加工时间轴：计算每行持续时间，并对无逐字时间戳的 LRC 行进行智能字符插值
    const sorted = [...lines].filter(l => l && typeof l.time === 'number' && (l.text || '').trim()).sort((a, b) => a.time - b.time);
    
    this.lyricTimeline = sorted.map((line, idx) => {
      const nextLine = sorted[idx + 1];
      const fallbackDuration = nextLine ? Math.max(0.8, nextLine.time - line.time) : 4.0;
      const duration = typeof line.duration === 'number' && line.duration > 0 ? line.duration : Math.min(fallbackDuration, 8.0);
      
      let words = line.words;
      if (!Array.isArray(words) || words.length === 0) {
        // 智能平滑插值：根据字数、标点与语言音节分配每个字/词的时间
        words = this.interpolateWordTimings(line.text, line.time, duration);
      }

      return {
        ...line,
        duration,
        words
      };
    });

    this.lyricCursor = 0;
    this.lastLyricTime = -1;

    if (this.lyricTimeline.length > 0) {
      this.userText = this.lyricTimeline[0].text;
      this.textSegments = [this.userText];
    }

    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  /**
   * 智能音节/字符平滑插值算法：对普通 LRC 行生成自然的逐字毫秒时间戳
   */
  private interpolateWordTimings(text: string, startTime: number, totalDuration: number) {
    const chars = [...text];
    if (chars.length === 0) return [];

    const activeDuration = Math.max(0.6, Math.min(totalDuration * 0.88, Math.max(chars.length * 0.22, 1.2)));
    const step = activeDuration / chars.length;

    return chars.map((char, i) => ({
      text: char,
      time: startTime + i * step,
      duration: Math.max(0.16, step)
    }));
  }

  clearLyricTimeline(): void {
    this.lyricTimeline = null;
    this.lyricCursor = 0;
    this.lastLyricTime = -1;
    this.lyricOffsetSeconds = 0;
  }

  get hasLyricTimeline(): boolean {
    return !!this.lyricTimeline && this.lyricTimeline.length > 0;
  }

  get lyricLineCount(): number {
    return this.lyricTimeline?.length ?? 0;
  }

  set lyricOffset(val: number) {
    this.lyricOffsetSeconds = val;
  }

  get lyricOffset(): number {
    return this.lyricOffsetSeconds;
  }

  getCurrentLyricLine(time: number) {
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) return undefined;
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return undefined;
    return this.lyricTimeline[this.lyricCursor];
  }

  getCurrentLyricIndex(time: number): number {
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) return -1;
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return -1;
    return this.lyricCursor;
  }

  computeCharTimings(line: any, time: number) {
    if (!line) return [];
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    let words = line.words;
    if (!Array.isArray(words) || words.length === 0) {
      const lineDuration = typeof line.duration === 'number' && line.duration > 0 ? line.duration : 4.0;
      words = this.interpolateWordTimings(line.text || '', line.time ?? t, lineDuration);
    }

    if (words && words.length > 0) {
      // 遍历所有 words。若某个 word 包含多个字符（如分词短语），将其拆解为单字符并平滑分配时间
      const result: { char: string; time: number; duration: number; index: number }[] = [];
      let charIdx = 0;
      for (const w of words) {
        const text = String(w.text || '');
        const chars = [...text];
        const wTime = typeof w.time === 'number'
          ? w.time
          : (typeof w.startSec === 'number' ? w.startSec : (typeof w.start === 'number' ? w.start / 1000 : (line.time ?? t)));
        const wDur = typeof w.duration === 'number'
          ? w.duration
          : (typeof w.durationSec === 'number' ? w.durationSec : (typeof w.endSec === 'number' && typeof w.startSec === 'number' ? w.endSec - w.startSec : 0.3));
        if (chars.length <= 1) {
          result.push({
            char: text,
            time: wTime,
            duration: wDur,
            index: charIdx++
          });
        } else {
          const stepDur = wDur / chars.length;
          chars.forEach((c, ci) => {
            result.push({
              char: c,
              time: wTime + ci * stepDur,
              duration: stepDur,
              index: charIdx++
            });
          });
        }
      }
      return result;
    }
    return [];
  }


  computeWordProgress(line: any, time: number) {
    if (!line) {
      return { wordIndex: -1, wordProgress: 0, lineProgress: 0 };
    }
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    const lineStart = line.time;
    const lineDuration = line.duration || 4.0;
    const lineProgress = Math.max(0, Math.min(1, (t - lineStart) / lineDuration));

    const words = line.words || [];
    if (words.length === 0) {
      return { wordIndex: -1, wordProgress: lineProgress, lineProgress };
    }

    let activeWordIdx = -1;
    let wordProgress = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (t >= w.time && t < w.time + w.duration) {
        activeWordIdx = i;
        wordProgress = Math.max(0, Math.min(1, (t - w.time) / (w.duration || 0.1)));
        break;
      } else if (t >= w.time + w.duration) {
        activeWordIdx = i;
        wordProgress = 1;
      }
    }

    return {
      wordIndex: activeWordIdx,
      wordProgress,
      lineProgress
    };
  }

  /** Side-effect-only step: advance lyricCursor to whichever line is
   *  active at `time`. Must be called once per frame BEFORE the read
   *  functions getDisplayText / getSegmentTime, but the call site is
   *  explicit (not implicit through getDisplayText) — so the two reads
   *  can sit in any order in the ctx literal without an order-of-eval
   *  footgun for future maintainers. */
  private advanceLyric(time: number): void {
    if (this._srtTimeline) return;
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) return;
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lastLyricTime) {
      this.lyricCursor = 0;
    }
    this.lastLyricTime = t;
    while (
      this.lyricCursor + 1 < this.lyricTimeline.length
      && this.lyricTimeline[this.lyricCursor + 1].time <= t
    ) {
      this.lyricCursor++;
    }
    while (
      this.lyricCursor > 0
      && this.lyricTimeline[this.lyricCursor].time > t
    ) {
      this.lyricCursor--;
    }
  }

  private getDisplayText(time: number): string {
    if (this._srtTimeline) {
      const ms = time * 1000;
      const entry = this._srtTimeline.find(e => ms >= e.startMs && ms < e.endMs);
      return entry?.text ?? '';
    }

    if (!this.lyricTimeline || this.lyricTimeline.length === 0) {
      const segIdx = this.textSegments.length > 1
        ? Math.floor(time / this._segmentDuration) % this.textSegments.length
        : 0;
      return this.textSegments[segIdx] || '';
    }

    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return '';
    return this.lyricTimeline[this.lyricCursor].text;
  }

  /** Seconds elapsed since the start of the current text segment / lyric
   *  line. Pure read — depends on lyricCursor, which advanceLyric() must
   *  have updated for the same `time` first. */
  private getSegmentTime(time: number): number {
    if (this._srtTimeline) {
      const ms = time * 1000;
      const entry = this._srtTimeline.find(e => ms >= e.startMs && ms < e.endMs);
      return entry ? time - entry.startMs / 1000 : 0;
    }
    if (!this.lyricTimeline || this.lyricTimeline.length === 0) {
      return time % this._segmentDuration;
    }
    const t = Math.max(0, time + this.lyricOffsetSeconds);
    if (t < this.lyricTimeline[0].time) return 0;
    return t - this.lyricTimeline[this.lyricCursor].time;
  }


  set effectOpacity(val: number) {
    this._effectOpacity = val;
    if (this.bgFill) this.bgFill.alpha = val;
  }
  get effectOpacity() { return this._effectOpacity; }

  set alphaMode(val: boolean) {
    this._alphaMode = val;
    const bgLayer = this.layers.get('background');
    if (val) {
      if (this.bgFill) this.bgFill.visible = false;
      if (bgLayer) bgLayer.visible = false;
      if (this.app?.renderer?.background) this.app.renderer.background.alpha = 0;
    } else {
      if (this.bgFill) this.bgFill.visible = true;
      if (bgLayer) bgLayer.visible = true;
      if (this.app?.renderer?.background) this.app.renderer.background.alpha = 1;
    }
  }
  get alphaMode() { return this._alphaMode; }


  // Now Playing listener toggle — connects or disconnects the WebSocket
  set nowPlayingListening(val: boolean) {
    if (this._nowPlayingListening === val) return;
    this._nowPlayingListening = val;

    if (val) {
      this.startNowPlaying();
    } else {
      this.stopNowPlaying();
    }
  }
  get nowPlayingListening() { return this._nowPlayingListening; }

  /** The current Now Playing track info, or null if not listening. */
  get nowPlayingTrack(): NowPlayingTrack | null {
    return this._npActive ? this._npTrack : null;
  }

  private startNowPlaying(): void {
    if (this.npProvider) return;

    this._npActive = true;
    this._npPaused = false;
    this._npTime = 0;
    this._npDuration = 0;
    this._npTrack = null;
    this._npSavedUserText = this.userText;

    this.npProvider = new NowPlayingProvider({
      onTrack: (track) => {
        this._npTrack = track;
        this._npDuration = track.duration;
        // Reset progress on track change
        this._npTime = 0;
        this._npPaused = false;
      },

      onLyric: (lines) => {
        if (lines && lines.length > 0) {
          this.setLyricTimeline(lines);
        } else {
          this.clearLyricTimeline();
          // Show track title as fallback text when no lyrics available
          if (this._npTrack) {
            this.userText = this._npTrack.title;
            this.textSegments = [this._npTrack.title];
          }
        }
      },

      onPauseState: (isPaused) => {
        this._npPaused = isPaused;
      },

      onProgress: (progressMs) => {
        this._npTime = progressMs / 1000;
      },

      onReplay: () => {
        this._npTime = 0;
        this._npPaused = false;
        this.lyricCursor = 0;
        this.lastLyricTime = -1;
      },
    });

    this.npProvider.connect();
  }

  private stopNowPlaying(): void {
    if (this.npProvider) {
      this.npProvider.destroy();
      this.npProvider = null;
    }
    this._npActive = false;
    this._npPaused = false;
    this._npTime = 0;
    this._npDuration = 0;
    this._npTrack = null;

    // Restore the original user text
    this.clearLyricTimeline();
    const saved = this._npSavedUserText;
    this._npSavedUserText = null;
    if (saved !== null) {
      this.userText = saved;
      this.textSegments = saved
        .split('/')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      if (this.textSegments.length === 0) {
        this.textSegments = [''];
      }
    }
    if (this.currentTemplate) {
      this.loadTemplate(this.currentTemplate);
    }
  }

  private updateBgFill() {
    if (!this.bgFill) return;
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const pad = Math.max(w, h) * 0.5;
    this.bgFill.clear();
    this.bgFill.rect(-pad, -pad, w + pad * 2, h + pad * 2);
    this.bgFill.fill({ color: this.palette.background });
  }

  private getMediaSprite(): PIXI.Sprite | null {
    const layer = this.layers.get('media');
    return (layer?.children[0] as PIXI.Sprite) ?? null;
  }

  setMediaOffset(dx: number, dy: number): void {
    const s = this.getMediaSprite();
    if (!s) return;
    s.x = this.app.screen.width / 2 + dx;
    s.y = this.app.screen.height / 2 + dy;
    this.syncOutline();
  }

  setMediaScale(scale: number): void {
    const s = this.getMediaSprite();
    if (!s) return;
    const base = Math.max(
      this.app.screen.width / s.texture.width,
      this.app.screen.height / s.texture.height,
    );
    s.scale.set(base * scale);
    this.syncOutline();
  }

  getMediaState(): { offsetX: number; offsetY: number; scale: number } | null {
    const s = this.getMediaSprite();
    if (!s) return null;
    const base = Math.max(
      this.app.screen.width / s.texture.width,
      this.app.screen.height / s.texture.height,
    );
    return {
      offsetX: s.x - this.app.screen.width / 2,
      offsetY: s.y - this.app.screen.height / 2,
      scale: s.scale.x / base,
    };
  }

  set shake(val: number) { this._shake = val; }
  get shake() { return this._shake; }
  set zoom(val: number) { this._zoom = val; }
  get zoom() { return this._zoom; }
  set tilt(val: number) { this._tilt = val; }
  get tilt() { return this._tilt; }
  set glitch(val: number) {
    this._glitch = val;
    this.glitchFilter.intensity = val;
  }
  get glitch() { return this._glitch; }

  set beatReactivity(val: number) { this._beatReactivity = val; }
  get beatReactivity() { return this._beatReactivity; }

  set canvasColor(color: string | null) {
    this._bgColorOverride = color;
    if (color) {
      this.palette.background = color;
      this.app.renderer.background.color = new PIXI.Color(color).toNumber();
      this.updateBgFill();
    } else if (this.currentTemplate) {
      this.palette.background = this.currentTemplate.palette.background;
      this.app.renderer.background.color = new PIXI.Color(this.palette.background).toNumber();
      this.updateBgFill();
    }
  }
  get canvasColor() { return this._bgColorOverride; }

  set hueShift(degrees: number) {
    this._hueShift = degrees;
    this.hueFilter.matrix = [1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0];
    this.hueFilter.hue(degrees, false);
  }
  get hueShift() { return this._hueShift; }

  async addMedia(file: File, mode: 'fit' | 'free' = 'fit'): Promise<void> {
    if (this._loading) return;
    this._loading = true;

    const url = URL.createObjectURL(file);

    try {
      const mediaLayer = this.layers.get('media')!;
      this.destroyOutline();
      mediaLayer.removeChildren().forEach(c => c.destroy({ children: true }));

      const isVideo = file.type.startsWith('video/');

      if (isVideo) {
        const video = document.createElement('video');
        video.src = url;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;

        await video.play();
        this.mediaElement = video;

        const texture = PIXI.Texture.from(video);
        const sprite = new PIXI.Sprite(texture);

        if (mode === 'fit') {
          const scale = Math.max(
            this.app.screen.width / video.videoWidth,
            this.app.screen.height / video.videoHeight
          );
          sprite.scale.set(scale);
        } else {
          const scale = Math.min(
            this.app.screen.width * 0.6 / video.videoWidth,
            this.app.screen.height * 0.6 / video.videoHeight
          );
          sprite.scale.set(scale);
        }

        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        mediaLayer.addChild(sprite);
      } else {
        const img = new Image();
        img.src = url;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load failed'));
        });

        // Downscale if image exceeds WebGL max texture size (typically 4096 or 8192)
        const maxDim = 4096;
        if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
          const downscale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.naturalWidth * downscale);
          canvas.height = Math.round(img.naturalHeight * downscale);
          const dctx = canvas.getContext('2d')!;
          dctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const smallImg = new Image();
          smallImg.src = canvas.toDataURL();
          await new Promise<void>((res) => { smallImg.onload = () => res(); });
          this.mediaElement = smallImg;
        } else {
          this.mediaElement = img;
        }

        const texture = PIXI.Texture.from(this.mediaElement as HTMLImageElement);
        const sprite = new PIXI.Sprite(texture);

        if (mode === 'fit') {
          const scale = Math.max(
            this.app.screen.width / sprite.texture.width,
            this.app.screen.height / sprite.texture.height
          );
          sprite.scale.set(scale);
        } else {
          const scale = Math.min(
            this.app.screen.width * 0.6 / sprite.texture.width,
            this.app.screen.height * 0.6 / sprite.texture.height
          );
          sprite.scale.set(scale);
        }

        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width / 2;
        sprite.y = this.app.screen.height / 2;
        mediaLayer.addChild(sprite);
      }

      if (this.currentTemplate?.features?.autoExtractColors) {
        this.extractingColors = true;
        this.applyExtractedColors();
        this._loading = false;
        this.loadTemplate(this.currentTemplate);
        this.extractingColors = false;
        return;
      }

      this.syncOutline();
      this.syncMotionDetector();
    } catch (err) {
      console.warn('[PVEngine] addMedia failed:', err);
    } finally {
      URL.revokeObjectURL(url);
      this._loading = false;
    }
  }

  async addMediaUrl(url: string, mode: 'fit' | 'free' = 'fit'): Promise<void> {
    if (this._loading || !url) return;
    this._loading = true;

    try {
      const mediaLayer = this.layers.get('media')!;
      this.destroyOutline();
      mediaLayer.removeChildren().forEach(c => c.destroy({ children: true }));

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
      });

      const maxDim = 4096;
      if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
        const downscale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * downscale);
        canvas.height = Math.round(img.naturalHeight * downscale);
        const dctx = canvas.getContext('2d')!;
        dctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const smallImg = new Image();
        smallImg.src = canvas.toDataURL();
        await new Promise<void>((res) => { smallImg.onload = () => res(); });
        this.mediaElement = smallImg;
      } else {
        this.mediaElement = img;
      }

      const texture = PIXI.Texture.from(this.mediaElement as HTMLImageElement);
      const sprite = new PIXI.Sprite(texture);

      if (mode === 'fit') {
        const scale = Math.max(
          this.app.screen.width / sprite.texture.width,
          this.app.screen.height / sprite.texture.height
        );
        sprite.scale.set(scale);
      } else {
        const scale = Math.min(
          this.app.screen.width * 0.6 / sprite.texture.width,
          this.app.screen.height * 0.6 / sprite.texture.height
        );
        sprite.scale.set(scale);
      }

      sprite.anchor.set(0.5);
      sprite.x = this.app.screen.width / 2;
      sprite.y = this.app.screen.height / 2;
      mediaLayer.addChild(sprite);

      if (this.currentTemplate?.features?.autoExtractColors) {
        this.extractingColors = true;
        this.applyExtractedColors();
        this._loading = false;
        this.loadTemplate(this.currentTemplate);
        this.extractingColors = false;
        return;
      }

      this.syncOutline();
      this.syncMotionDetector();
    } catch (err) {
      console.warn('[PVEngine] addMediaUrl failed:', err);
    } finally {
      this._loading = false;
    }
  }

  clearMedia(): void {
    const mediaLayer = this.layers.get('media');
    if (mediaLayer) {
      this.destroyOutline();
      mediaLayer.removeChildren().forEach(c => c.destroy({ children: true }));
    }
    this.mediaElement = null;
  }


  private applyExtractedColors(): void {
    if (!this.mediaElement) return;
    const colors = extractDominantColors(this.mediaElement);
    this.palette = {
      background: colors.primary,
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.complement,
      text: '#ffffff',
    };
  }

  private syncOutline(): void {
    if (!this._outlineEnabled || !this.mediaElement) {
      this.destroyOutline();
      return;
    }

    const mediaLayer = this.layers.get('media')!;
    const mediaSprite = mediaLayer.children[0] as PIXI.Sprite | undefined;
    if (!mediaSprite) return;

    if (this.outlineRenderer) return;

    const srcW = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoWidth
      : this.mediaElement.naturalWidth;
    const srcH = this.mediaElement instanceof HTMLVideoElement
      ? this.mediaElement.videoHeight
      : this.mediaElement.naturalHeight;

    this.outlineRenderer = new MediaOutlineRenderer(srcW, srcH);
    const os = this.outlineRenderer.sprite;
    os.anchor.set(0.5);
    os.x = mediaSprite.x;
    os.y = mediaSprite.y;
    os.width = mediaSprite.width;
    os.height = mediaSprite.height;
    mediaLayer.addChild(os);
  }

  private destroyOutline(): void {
    if (this.outlineRenderer) {
      this.outlineRenderer.destroy();
      this.outlineRenderer = null;
    }
  }

  private syncInvertFilter(): void {
    const mediaLayer = this.layers.get('media')!;
    // Each toggle re-allocates ColorMatrixFilter instances; destroy the
    // previous batch first so swapping invert/threshold modes back-and-
    // forth doesn't leak filter shaders. invertFilter is the one filter
    // we DO reuse across calls; skip it here so that the assignment
    // below re-attaches the same instance instead of touching a freshly
    // destroyed one. PIXI v8 types `mediaLayer.filters` as readonly
    // Filter[] | null | undefined, so normalise to an array first.
    const prev: PIXI.Filter[] = mediaLayer.filters
      ? Array.isArray(mediaLayer.filters)
        ? [...mediaLayer.filters]
        : [mediaLayer.filters as unknown as PIXI.Filter]
      : [];
    this.disposeFilters(prev.filter(f => f !== this.invertFilter));
    if (this._thresholdMediaEnabled) {
      // High-contrast B&W: desaturate → extreme contrast (threshold-like)
      const desat = new PIXI.ColorMatrixFilter();
      desat.desaturate();
      const contrast = new PIXI.ColorMatrixFilter();
      contrast.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      contrast.contrast(1.8, false);
      const bright = new PIXI.ColorMatrixFilter();
      bright.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      bright.brightness(1.15, false);
      mediaLayer.filters = [desat, contrast, bright];
      // invertFilter is unused in threshold mode; release it so the
      // next mode switch back to invert reallocates fresh.
      if (this.invertFilter) {
        try { this.invertFilter.destroy(); } catch { /* ignore */ }
        this.invertFilter = null;
      }
    } else if (this._invertMediaEnabled) {
      if (!this.invertFilter) {
        this.invertFilter = new PIXI.ColorMatrixFilter();
      }
      const m = this.invertFilter;
      m.matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
      m.desaturate();
      m.negative(false);
      const tint = new PIXI.ColorMatrixFilter();
      tint.matrix = [
        1.06, 0, 0, 0, 0.08,
        0, 1.02, 0, 0, 0.04,
        0, 0, 0.94, 0, 0,
        0, 0, 0, 1, 0,
      ];
      mediaLayer.filters = [this.invertFilter, tint];
    } else {
      if (this.invertFilter) {
        try { this.invertFilter.destroy(); } catch { /* ignore */ }
        this.invertFilter = null;
      }
      mediaLayer.filters = [];
    }
  }

  /**
   * Scale renderer resolution down when many effects are active.
   * Keeps visuals sharp with few effects, avoids GPU overload with many.
   * Mobile devices get more aggressive downscaling.
   */
  private syncResolution(): void {
    const n = this.activeEffects.length;
    const dpr = this._nativeDPR;
    const mobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    let target: number;
    if (mobile) {
      if (n <= 4) {
        target = Math.min(dpr, 2);
      } else if (n <= 8) {
        target = Math.min(dpr, 1.5);
      } else {
        target = 1;
      }
    } else {
      if (n <= 6) {
        target = dpr;
      } else if (n <= 12) {
        target = Math.min(dpr, 2);
      } else if (n <= 18) {
        target = Math.min(dpr, 1.5);
      } else {
        target = 1;
      }
    }

    // Round to avoid sub-pixel jitter
    target = Math.round(target * 4) / 4;

    if (target !== this._currentResolution) {
      this._currentResolution = target;
      this.app.renderer.resolution = target;
      if (this._resizeParent) {
        const w = this._resizeParent.clientWidth;
        const h = this._resizeParent.clientHeight;
        this.app.renderer.resize(w, h);
      }
    }
  }

  private syncMotionDetector(): void {
    if (this._motionDetectionEnabled && this.mediaElement instanceof HTMLVideoElement) {
      if (!this.motionDetector) {
        this.motionDetector = new MotionDetector();
      }
    } else {
      if (this.motionDetector) {
        this.motionDetector.destroy();
        this.motionDetector = null;
      }
      this.motionTargets = [];
    }
  }

  private clearEffects() {
    for (const e of this.activeEffects) {
      try { e.destroy(); } catch { /* safe */ }
    }
    this.activeEffects = [];
    for (const [key, layer] of this.layers) {
      if (key !== 'media') {
        try {
          while (layer.children.length > 0) {
            const child = layer.children[0];
            layer.removeChild(child);
            try { child.destroy({ children: true }); } catch { /* safe */ }
          }
        } catch { /* safe */ }
      }
    }
  }


  private update(time: number, deltaTime: number) {
    const lyricClock = this._npActive
      ? this._npTime
      : this.beat.isAudioMode
        ? this.beat.currentTime
        : time;
    this._playbackTime = lyricClock;

    if (this.motionDetector && this.mediaElement instanceof HTMLVideoElement) {
      this.motionDetector.detect(this.mediaElement);
      const srcW = this.mediaElement.videoWidth || 1;
      const srcH = this.mediaElement.videoHeight || 1;
      this.motionTargets = this.motionDetector.getTargetsForDisplay(
        this.app.screen.width, this.app.screen.height, srcW, srcH,
      );
    }

    // Advance lyricCursor first; getDisplayText / getSegmentTime then
    // both read it as pure functions (call order in the ctx literal no
    // longer matters).
    this.advanceLyric(lyricClock);
    const currentLine = this.getCurrentLyricLine(lyricClock);
    const currentLineIndex = this.getCurrentLyricIndex(lyricClock);
    const charTimings = this.computeCharTimings(currentLine, lyricClock);
    const { wordIndex, wordProgress, lineProgress } = this.computeWordProgress(currentLine, lyricClock);

    // 实时音频反应性分析（低频/中频/高频/能量/律动鼓点）
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let energy = 0;
    let isBeat = false;

    const analyser = (typeof window !== 'undefined' ? (window as any).ichigoAnalyser : null);
    if (analyser?.getByteFrequencyData && analyser.frequencyBinCount > 0) {
      if (!this._audioFreqBuffer || this._audioFreqBuffer.length !== analyser.frequencyBinCount) {
        this._audioFreqBuffer = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(this._audioFreqBuffer);
      const len = this._audioFreqBuffer.length;
      const bassBins = Math.max(1, Math.floor(len * 0.08));
      const midBins = Math.max(1, Math.floor(len * 0.42));

      let bSum = 0;
      for (let i = 0; i < bassBins; i++) bSum += this._audioFreqBuffer[i];
      let mSum = 0;
      for (let i = bassBins; i < midBins; i++) mSum += this._audioFreqBuffer[i];
      let tSum = 0;
      for (let i = midBins; i < len; i++) tSum += this._audioFreqBuffer[i];

      const rawBass = bSum / (bassBins * 255);
      const rawMid = mSum / (Math.max(1, midBins - bassBins) * 255);
      const rawTreble = tSum / (Math.max(1, len - midBins) * 255);
      const rawEnergy = (rawBass * 0.5 + rawMid * 0.35 + rawTreble * 0.15);

      this._smoothedBass += (rawBass - this._smoothedBass) * 0.28;
      this._smoothedMid += (rawMid - this._smoothedMid) * 0.22;
      this._smoothedTreble += (rawTreble - this._smoothedTreble) * 0.25;
      this._smoothedEnergy += (rawEnergy - this._smoothedEnergy) * 0.25;

      bass = this._smoothedBass;
      mid = this._smoothedMid;
      treble = this._smoothedTreble;
      energy = this._smoothedEnergy;

      if (rawBass > 0.40 && (time - this._lastBeatTime > 0.20)) {
        isBeat = true;
        this._lastBeatTime = time;
      }
    } else {
      const synth = Math.sin(time * 2.2) * 0.5 + 0.5;
      bass = synth * 0.22;
      mid = synth * 0.18;
      treble = synth * 0.15;
      energy = synth * 0.20;
    }

    const ctx: UpdateContext = {
      time,
      deltaTime,
      fps: this.app.ticker.maxFPS,
      screenWidth: this.app.screen.width,
      screenHeight: this.app.screen.height,
      palette: this.palette,
      animationSpeed: this._animationSpeed,
      motionIntensity: this._motionIntensity,
      currentText: this.getDisplayText(lyricClock),
      translation: currentLine?.translation || '',
      currentLine,
      currentLineIndex,
      currentLineProgress: lineProgress,
      currentWordIndex: wordIndex,
      currentWordProgress: wordProgress,
      charTimings,
      segmentTime: this.getSegmentTime(lyricClock),
      beatIntensity: (isBeat ? 1.0 : (bass * 1.6)) * this._beatReactivity,
      motionTargets: this.motionTargets,
      songInfo: this._songInfo || undefined,
      showTitleCard: this._showTitleCard,
      showTranslation: this._showTranslation,
      showFurigana: this._showFurigana !== false,
      audioReact: {
        bass,
        mid,
        treble,
        energy,
        isBeat,
      },
    };

    // 渲染各模板专属风格的歌曲开场标题卡 (Opening Cinematic Title Card: 0~4.5s)
    if (this._showTitleCard && this._songInfo && this._songInfo.title && lyricClock >= 0 && lyricClock <= 4.5) {
      this.renderThemedTitleCard(lyricClock);
    } else if (this.titleCardContainer) {
      this.titleCardContainer.visible = false;
    }

    this.updateBgFill();
    this.applyCameraFX(time);

    if (this.outlineRenderer && this.mediaElement) {
      this.outlineRenderer.update(this.mediaElement as HTMLVideoElement);
    }

    this._tick++;

    // Legacy render-loop guard for pre-v0.9.14 compatibility
    if (this._tick === 0x7fffffff) this._tick = 0;

    // Throttle heavy effects when many are active
    const n = this.activeEffects.length;
    const heavySkip = n > 15 ? 3 : n > 8 ? 2 : 0;

    for (const effect of this.activeEffects) {
      try {
        if (heavySkip && effect.heavy && this._tick % heavySkip !== 0) continue;
        effect.update(ctx);
      } catch (err) {
        console.warn(`[PVEngine] Effect "${effect.name}" update error:`, err);
      }
    }
  }

  private renderThemedTitleCard(lyricClock: number): void {
    if (!this.titleCardContainer || !this._songInfo) return;
    this.titleCardContainer.visible = true;

    let cardAlpha = 1;
    let cardOffset = 0;
    if (lyricClock < 0.8) {
      cardAlpha = lyricClock / 0.8;
      cardOffset = (1 - cardAlpha) * 25;
    } else if (lyricClock > 3.5) {
      cardAlpha = Math.max(0, (4.5 - lyricClock) / 1.0);
      cardOffset = (1 - cardAlpha) * -20;
    }

    this.titleCardContainer.alpha = cardAlpha;
    const tplKey = (this.currentTemplate?.nameKey || this.currentTemplate?.name || '').toLowerCase();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    const titleStr = this._songInfo.title || '';
    const subStr = [this._songInfo.artist, this._songInfo.album].filter(Boolean).join(' • ');

    this.titleCardTitle.text = titleStr;
    this.titleCardSubtitle.text = subStr;

    const g = this.titleCardGfx;
    g.clear();

    if (tplKey.includes('p5')) {
      // ── P5 怪盗专属开场预告信贴纸 ──────────────────
      this.titleCardContainer.x = 56;
      this.titleCardContainer.y = h - 200 + cardOffset;

      this.titleCardBadge.text = '★ CALLING CARD / TARGET ★';
      this.titleCardBadge.style.fontFamily = '"Impact", "Arial Black", sans-serif';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#111111';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Impact", "Arial Black", "PingFang SC", sans-serif';
      this.titleCardTitle.style.fontSize = 28;
      this.titleCardTitle.style.fill = '#ffffff';

      this.titleCardSubtitle.style.fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#ffea00';

      this.titleCardBadge.x = 4;
      this.titleCardBadge.y = -2;
      this.titleCardTitle.x = 4;
      this.titleCardTitle.y = 22;
      this.titleCardSubtitle.x = 4;
      this.titleCardSubtitle.y = 60;

      const cardW = Math.max(300, this.titleCardTitle.width + 36);
      // 斜切黑底贴纸
      g.poly([
        -16, -16,
        cardW + 12, -22,
        cardW + 4, 88,
        -20, 84
      ]);
      g.fill({ color: 0x111111, alpha: 0.96 });
      g.stroke({ color: 0xffea00, width: 2.5 });

      // 顶部黄色小标签
      g.poly([
        -10, -14,
        180, -18,
        176, 12,
        -12, 14
      ]);
      g.fill({ color: 0xffea00, alpha: 1 });

      // 红色五角星标
      const starX = cardW - 8;
      const starY = 32;
      g.circle(starX, starY, 12);
      g.fill({ color: 0xd6001c, alpha: 1 });
    } else if (tplKey.includes('pixel') || tplKey.includes('kawai')) {
      // ── Kawaii 像素窗口开场 ───────────────────────
      this.titleCardContainer.x = 44;
      this.titleCardContainer.y = h - 185 + cardOffset;

      this.titleCardBadge.text = '♡ TRACK 01.EXE ♡';
      this.titleCardBadge.style.fontFamily = '"DotGothic16", "Press Start 2P", monospace';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#ffffff';
      this.titleCardBadge.style.letterSpacing = 1;

      this.titleCardTitle.style.fontFamily = '"DotGothic16", "PingFang SC", monospace';
      this.titleCardTitle.style.fontSize = 24;
      this.titleCardTitle.style.fill = '#5a3a5a';

      this.titleCardSubtitle.style.fontFamily = '"DotGothic16", "PingFang SC", monospace';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#8a5a8a';

      this.titleCardBadge.x = 8;
      this.titleCardBadge.y = 2;
      this.titleCardTitle.x = 8;
      this.titleCardTitle.y = 30;
      this.titleCardSubtitle.x = 8;
      this.titleCardSubtitle.y = 64;

      const cardW = Math.max(280, this.titleCardTitle.width + 44);
      // 像素外框阴影
      g.rect(-8, -4, cardW + 6, 96);
      g.fill({ color: 0x000000, alpha: 0.3 });

      // 像素卡片底
      g.rect(-12, -8, cardW, 96);
      g.fill({ color: 0xffffff, alpha: 0.95 });
      g.stroke({ color: 0xffb3d9, width: 3 });

      // 粉色标题栏
      g.rect(-12, -8, cardW, 24);
      g.fill({ color: 0xffb3d9, alpha: 1 });

      // 右侧像素 [X]
      g.rect(cardW - 32, -6, 18, 18);
      g.fill({ color: 0xff85b3, alpha: 1 });
    } else if (tplKey.includes('shinkuu') || tplKey.includes('moon') || tplKey.includes('space')) {
      // ── Fly Me to the Moon 深空水晶开场 ─────────────
      this.titleCardContainer.x = 50;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = '✦ FLY ME TO THE MOON ✦';
      this.titleCardBadge.style.fontFamily = '"Outfit", "Cinzel", serif';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#a0d0ff';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardTitle.style.fontSize = 28;
      this.titleCardTitle.style.fill = '#ffffff';

      this.titleCardSubtitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardSubtitle.style.fontSize = 14;
      this.titleCardSubtitle.style.fill = '#b8d4f8';

      this.titleCardBadge.x = 8;
      this.titleCardBadge.y = 0;
      this.titleCardTitle.x = 8;
      this.titleCardTitle.y = 20;
      this.titleCardSubtitle.x = 8;
      this.titleCardSubtitle.y = 58;

      const cardW = Math.max(290, this.titleCardTitle.width + 36);
      g.roundRect(-12, -10, cardW, 96, 12);
      g.fill({ color: 0x050d1a, alpha: 0.7 });
      g.stroke({ color: 0x66a6ff, width: 1.5, alpha: 0.6 });

      // 左侧发光月牙细弧
      g.circle(-2, 38, 14);
      g.fill({ color: 0xd0e4ff, alpha: 0.85 });
      g.circle(-6, 36, 12);
      g.fill({ color: 0x050d1a, alpha: 1 });
    } else if (tplKey.includes('pink') || tplKey.includes('cloud') || tplKey.includes('sweet')) {
      // ── 少女云朵软萌棉花糖开场 ────────────────────
      this.titleCardContainer.x = 48;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = '♡ SWEET MELODY ♡';
      this.titleCardBadge.style.fontFamily = '"Outfit", "PingFang SC", sans-serif';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#ff85b3';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardTitle.style.fontSize = 26;
      this.titleCardTitle.style.fill = '#5c3349';

      this.titleCardSubtitle.style.fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#945d7a';

      this.titleCardBadge.x = 12;
      this.titleCardBadge.y = 2;
      this.titleCardTitle.x = 12;
      this.titleCardTitle.y = 22;
      this.titleCardSubtitle.x = 12;
      this.titleCardSubtitle.y = 58;

      const cardW = Math.max(280, this.titleCardTitle.width + 42);
      g.roundRect(-10, -8, cardW, 94, 20);
      g.fill({ color: 0xffffff, alpha: 0.92 });
      g.stroke({ color: 0xffb8d2, width: 2 });

      // 左侧粉嫩爱心
      g.circle(-2, 38, 10);
      g.fill({ color: 0xff85b3, alpha: 0.9 });
    } else if (tplKey.includes('sakura') || tplKey.includes('yozakura')) {
      // ── 春日樱 / 和纸金箔开场 ────────────────────
      this.titleCardContainer.x = 52;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = '❀ SAKURA BLOSSOM ❀';
      this.titleCardBadge.style.fontFamily = '"Noto Serif JP", serif';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#ffb7c5';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardTitle.style.fontSize = 27;
      this.titleCardTitle.style.fill = '#ffffff';

      this.titleCardSubtitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#ffc8d6';

      this.titleCardBadge.x = 8;
      this.titleCardBadge.y = 0;
      this.titleCardTitle.x = 8;
      this.titleCardTitle.y = 20;
      this.titleCardSubtitle.x = 8;
      this.titleCardSubtitle.y = 56;

      const cardW = Math.max(280, this.titleCardTitle.width + 36);
      g.roundRect(-12, -8, cardW, 92, 8);
      g.fill({ color: 0x141422, alpha: 0.75 });
      g.stroke({ color: 0xffb7c5, width: 1.5, alpha: 0.7 });

      // 樱花金印条
      g.rect(-12, -8, 5, 92);
      g.fill({ color: 0xffb7c5, alpha: 0.95 });
    } else if (tplKey.includes('umi') || tplKey.includes('sea')) {
      // ── 深海波澜开场 ─────────────────────────────
      this.titleCardContainer.x = 48;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = '≈ DEEP OCEAN AUDIO ≈';
      this.titleCardBadge.style.fontFamily = '"Outfit", sans-serif';
      this.titleCardBadge.style.fontSize = 11;
      this.titleCardBadge.style.fill = '#5cd3ea';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Noto Serif JP", "PingFang SC", serif';
      this.titleCardTitle.style.fontSize = 27;
      this.titleCardTitle.style.fill = '#f0fbff';

      this.titleCardSubtitle.style.fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#a8f5ff';

      this.titleCardBadge.x = 8;
      this.titleCardBadge.y = 0;
      this.titleCardTitle.x = 8;
      this.titleCardTitle.y = 20;
      this.titleCardSubtitle.x = 8;
      this.titleCardSubtitle.y = 56;

      const cardW = Math.max(280, this.titleCardTitle.width + 36);
      g.roundRect(-12, -8, cardW, 92, 14);
      g.fill({ color: 0x041824, alpha: 0.75 });
      g.stroke({ color: 0x5cd3ea, width: 1.5, alpha: 0.6 });

      // 碧蓝波纹侧条
      g.rect(-12, -8, 5, 92);
      g.fill({ color: 0x5cd3ea, alpha: 0.95 });
    } else if (tplKey.includes('hakushi')) {
      // ── 白纸极简开场 ─────────────────────────────
      this.titleCardContainer.x = 48;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = 'NO. 01 / TRACK';
      this.titleCardBadge.style.fontFamily = '"Noto Serif JP", serif';
      this.titleCardBadge.style.fontSize = 10;
      this.titleCardBadge.style.fill = '#666666';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardTitle.style.fontSize = 26;
      this.titleCardTitle.style.fill = '#181816';

      this.titleCardSubtitle.style.fontFamily = '"Noto Serif JP", "Yu Mincho", serif';
      this.titleCardSubtitle.style.fontSize = 13;
      this.titleCardSubtitle.style.fill = '#4a4844';

      this.titleCardBadge.x = 8;
      this.titleCardBadge.y = 0;
      this.titleCardTitle.x = 8;
      this.titleCardTitle.y = 18;
      this.titleCardSubtitle.x = 8;
      this.titleCardSubtitle.y = 54;

      const cardW = Math.max(270, this.titleCardTitle.width + 36);
      g.rect(-12, -8, cardW, 88);
      g.fill({ color: 0xf8f8f5, alpha: 0.9 });
      g.stroke({ color: 0x1a1a1a, width: 1 });

      g.rect(-12, -8, 3, 88);
      g.fill({ color: 0x1a1a1a, alpha: 1 });
    } else {
      // ── 默认现代精美毛玻璃开场 ──────────────────────
      this.titleCardContainer.x = 48;
      this.titleCardContainer.y = h - 180 + cardOffset;

      this.titleCardBadge.text = 'NOW PLAYING';
      this.titleCardBadge.style.fontFamily = '"Outfit", "Inter", sans-serif';
      this.titleCardBadge.style.fontSize = 10;
      this.titleCardBadge.style.fill = '#ffffff';
      this.titleCardBadge.style.letterSpacing = 2;

      this.titleCardTitle.style.fontFamily = '"Outfit", "PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardTitle.style.fontSize = 28;
      this.titleCardTitle.style.fill = '#ffffff';

      this.titleCardSubtitle.style.fontFamily = '"Outfit", "PingFang SC", "Microsoft YaHei", sans-serif';
      this.titleCardSubtitle.style.fontSize = 14;
      this.titleCardSubtitle.style.fill = 'rgba(255, 255, 255, 0.8)';

      this.titleCardBadge.x = 0;
      this.titleCardBadge.y = 0;
      this.titleCardTitle.x = 0;
      this.titleCardTitle.y = 18;
      this.titleCardSubtitle.x = 0;
      this.titleCardSubtitle.y = 56;

      const cardW = Math.max(270, this.titleCardTitle.width + 36);
      g.roundRect(-16, -10, cardW, 90, 10);
      g.fill({ color: 0x000000, alpha: 0.5 });
      g.stroke({ color: 0xffffff, width: 1, alpha: 0.2 });

      g.rect(-16, -10, 4, 90);
      g.fill({ color: 0xff4477, alpha: 0.95 });
    }
  }

  private applyCameraFX(time: number): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const cx = w / 2;
    const cy = h / 2;

    this.app.stage.pivot.set(cx, cy);

    let px = cx, py = cy;

    const beatShake = this.beat.getIntensity(time) * this._beatReactivity;
    const totalShake = this._shake + beatShake * 0.15;
    if (totalShake > 0 && !this._paused) {
      px += (Math.random() - 0.5) * totalShake * 30;
      py += (Math.random() - 0.5) * totalShake * 20;
    }

    this.app.stage.position.set(px, py);
    this.app.stage.scale.set(1 + this._zoom * 0.5);
    this.app.stage.rotation = this._tilt * 0.3;

    this.glitchFilter.time = time;
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get playbackTime(): number {
    return this._playbackTime;
  }

  get timelineDuration(): number {
    // When Now Playing is active, use NP-provided duration
    if (this._npActive && this._npDuration > 0) {
      return this._npDuration;
    }

    const audioDuration = this.beat.duration;
    if (Number.isFinite(audioDuration) && audioDuration > 0) {
      return audioDuration;
    }

    if (this.lyricTimeline && this.lyricTimeline.length > 0) {
      return Math.max(this.lyricTimeline[this.lyricTimeline.length - 1].time + 2, 1);
    }

    return Math.max(this.textSegments.length * this._segmentDuration, this._segmentDuration);
  }

  destroy() {
    this.stopNowPlaying();
    this.clearEffects();
    // Release media + render-side helpers explicitly. app.destroy(true,
    // true) tears down the PIXI tree (children + textures) but cannot
    // clean up our own subsystems (video decoder via mediaElement, motion
    // detector worker / canvas, outline renderer texture, BeatProvider
    // audio context, stage AND container-level filter shaders). Without
    // this, SPA hot-reload or re-init leaks accumulate.
    this.destroyOutline();
    if (this.motionDetector) {
      this.motionDetector.destroy();
      this.motionDetector = null;
    }
    if (this.mediaElement instanceof HTMLVideoElement) {
      try { this.mediaElement.pause(); } catch { /* ignore */ }
      this.mediaElement.src = '';
      this.mediaElement.load();
    }
    this.mediaElement = null;
    // BeatProvider.dispose() = audioCtx.close + source.disconnect +
    // analyser.disconnect + audioEl.pause + nulls — full cleanup. Plain
    // pause() leaks the AudioContext (browsers cap concurrent contexts
    // around 6 — SPA hot-reload would burn the budget within ~6 reloads).
    try { this.beat.dispose(); } catch { /* ignore */ }
    // stage-level filters explicitly destroyed because Container.destroy()
    // only nulls the _filterEffect ref — Shader.destroy() is what clears
    // the GL bind group. Pass nothing (default destroyPrograms=false) so
    // PIXI's shared shader-program cache stays alive for any other live
    // filter instances using the same program.
    this.disposeFilters(this.app.stage.filters);
    this.app.stage.filters = [];
    // Same treatment for any container-level filters set via
    // syncInvertFilter / syncOutline. Each layer may carry its own
    // ColorMatrixFilter / FilterEffect from the media post-processing
    // pipeline.
    for (const layer of this.layers.values()) {
      this.disposeFilters(layer.filters);
      if (layer.filters) layer.filters = [];
    }
    // Recursive children/texture cleanup. Default `app.destroy(true)` is
    // `app.destroy(true, false)` → stage.destroy(false) leaves the layer
    // containers / bgFill / effectsRoot detached but still referenced
    // from this.layers / this.bgFill — soft JS leak until the engine
    // itself is GC'd. true,true forces deep destroy.
    this.app.destroy(true, true);
  }

  private disposeFilters(filters: PIXI.Filter | readonly PIXI.Filter[] | null | undefined): void {
    if (!filters) return;
    const arr = Array.isArray(filters) ? filters : [filters];
    for (const f of arr) {
      try { f.destroy(); } catch { /* already destroyed */ }
    }
  }
}