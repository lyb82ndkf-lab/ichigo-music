import J from './jizuraLib.js';
import { buildJizuraProject, createJizuraPlan, STYLE_ALIAS_MAP } from './plannerBridge.js';

/**
 * 根据容器实际像素宽高动态计算高保真矢量设计画幅 [W, H]
 * 横屏基准高 1080，竖屏基准宽 1080，比例完全吻合视口，彻底消除裁切与黑边
 */
export function getAdaptiveDesignSize(width, height) {
  const w = Math.max(320, Math.floor(width || 1920));
  const h = Math.max(240, Math.floor(height || 1080));
  const ratio = w / h;

  if (ratio >= 1) {
    const H = 1080;
    const W = Math.round((1080 * ratio) / 2) * 2;
    return [Math.max(1080, Math.min(3840, W)), H];
  } else {
    const W = 1080;
    const H = Math.round((1080 / ratio) / 2) * 2;
    return [W, Math.max(1080, Math.min(3840, H))];
  }
}

export class JizuraEngine {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.resizeObserver = null;
    this.resizeDebounceTimer = null;

    this.project = null;
    this.plan = null;
    this.lyrics = [];
    this.songMeta = { id: '', title: '', artist: '', album: '' };

    this.currentTime = 0;
    this.isPlaying = false;
    this.rafId = null;

    // 历史版本堆栈（供 ◀ 前一个案 / 次の案 ▶）
    this.history = [];
    this.historyIndex = -1;

    // 用户调节参数
    this.styleKey = 'noir';
    this.moodKey = null;
    this.themeKey = null;
    this.fxConfig = {
      motion: 0.7,
      glitch: 0.55,
      chroma: 0.7,
      texture: 0.6,
      onTwos: true,
      koma: 12
    };

    // 封面与音频 Analyser
    this.coverImage = null;
    this.useCover = true;
    this.audioAnalyser = null;
    this.freqData = null;
    this.smoothedBass = 0;

    // 兼容旧 API 属性
    this._animationSpeed = 1.0;
    this._motionIntensity = 1.0;
    this._effectOpacity = 1.0;
    this.showTranslation = true;
    this.showFurigana = true;
    this.showTitleCard = true;

    this.isReady = false;
  }

  async init(container) {
    if (!container) return;
    this.container = container;

    // 创建 Canvas 画布
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'kpv-jizura-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.renderer = new J.Renderer();

    // 绑定大小侦听与高分屏 DPI 缩放
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);
    this.handleResize();

    // 默认空项目
    this.rebuildProject();
    this.isReady = true;

    // 开始基础渲染循序
    this.startLoop();
  }

  handleResize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 限制最大 2x DPI 以防 4K 下性能损耗

    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const newAspect = getAdaptiveDesignSize(w, h);

    // 动态适配项目画幅比
    if (this.project) {
      const curAspect = Array.isArray(this.project.aspect) ? this.project.aspect : [1920, 1080];
      const curRatio = curAspect[0] / curAspect[1];
      const newRatio = newAspect[0] / newAspect[1];
      const diff = Math.abs(curRatio - newRatio) / curRatio;

      this.project.aspect = newAspect;

      // 画幅长宽比变化超过 1.5% 时触发排版分镜重构
      if (!this.plan || diff > 0.015) {
        if (this.resizeDebounceTimer) clearTimeout(this.resizeDebounceTimer);
        this.resizeDebounceTimer = setTimeout(() => {
          this.rebuildPlan();
        }, 80);
      }
    }

    this.drawCurrentFrame();
  }

  setSongInfo(meta = {}) {
    const isNewSong = meta.id && this.songMeta.id && String(meta.id) !== String(this.songMeta.id);
    this.songMeta = { ...this.songMeta, ...meta };
    if (isNewSong) {
      this.currentTime = 0;
      this.lyrics = [];
    }
    this.rebuildProject();
  }

  setLyrics(lyrics = [], songMeta = null) {
    this.lyrics = Array.isArray(lyrics) ? lyrics : [];
    if (songMeta) {
      this.songMeta = { ...this.songMeta, ...songMeta };
    }
    this.rebuildProject();
  }

  // 兼容旧接口 setLyricTimeline
  setLyricTimeline(timeline, offset = 0) {
    this.setLyrics(timeline);
  }

  setStyle(styleKey) {
    if (!styleKey) return null;
    let target = STYLE_ALIAS_MAP[styleKey] || styleKey;
    if (target === 'auto' || target === 'multi') {
      target = 'noir';
    }
    if (!J.STYLES[target]) {
      target = 'noir';
    }
    this.styleKey = target;

    if (!this.project) {
      this.rebuildProject();
    } else {
      this.project.style = target;
      // 重置调色盘覆盖，让目标风格专属配色与材质即时生效
      if (this.project.colors) {
        this.project.colors = { enabled: false, accentOn: false };
      }
      // 生成新的随机数种子，使新风格的排版布局与镜头即时重新编排
      this.project.seed = Math.floor(Math.random() * 1e9);
      this.rebuildPlan();
    }

    // 压入历史栈，确保“上一案 / 下一案”可随时返回或前进
    this.pushHistory(this.project);

    // 无论是否播放中，强制立即重绘当前帧
    this.drawCurrentFrame();

    return {
      style: this.project.style,
      mood: this.project.mood,
      themeId: this.project.themeId,
      seed: this.project.seed,
      proposalIndex: this.historyIndex + 1,
      historyTotal: this.history.length
    };
  }

  // 兼容旧接口 loadTemplate
  loadTemplate(tpl) {
    if (!tpl) return;
    const name = tpl.nameKey || tpl.name || tpl.id || '';
    return this.setStyle(name);
  }

  setMood(mood) {
    this.moodKey = mood || null;
    if (this.project) {
      this.project.mood = this.moodKey;
      this.rebuildPlan();
    }
  }

  setTheme(themeId) {
    this.themeKey = themeId || null;
    if (this.project) {
      this.project.themeId = this.themeKey;
      this.rebuildPlan();
    }
  }

  setFxConfig(patch = {}) {
    this.fxConfig = { ...this.fxConfig, ...patch };
    if (this.project && this.project.fx) {
      Object.assign(this.project.fx, this.fxConfig);
      this.rebuildPlan();
    }
  }

  // 历史版本管理 (供 ◀ 上一案 / 下一案 ▶ 完整步进)
  pushHistory(proj) {
    if (!proj) return;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(JSON.parse(JSON.stringify(proj)));
    if (this.history.length > 30) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  // “おまかせ”智能换案（一键随机重混）
  omakase(themeId = null, moodId = null) {
    if (!this.project) {
      this.rebuildProject();
    }
    if (!this.project || !J.omakase) return null;
    const targetTheme = themeId || this.themeKey;

    // 若此前没有历史节点，将当前底案作为起点压栈
    if (this.history.length === 0) {
      this.history = [JSON.parse(JSON.stringify(this.project))];
      this.historyIndex = 0;
    }

    const r = J.omakase(this.project, Math.random, targetTheme);
    if (!r) return null;

    // 关键修复：J.omakase 仅计算风格与技术参数增量（style, mood, fx, enabled, fonts, colors, overrides, seed），
    // 绝不可直接覆盖项目！必须使用 Object.assign 合并，从而完整保留歌词 (lyrics)、歌曲信息、画幅与时间轴！
    Object.assign(this.project, r);
    if (moodId && J.MOODS[moodId]) {
      this.project.mood = moodId;
    }

    // 压入新案到历史队列
    this.pushHistory(this.project);

    this.styleKey = this.project.style;
    this.moodKey = this.project.mood;
    this.rebuildPlan();
    this.drawCurrentFrame();

    return {
      style: this.project.style,
      mood: this.project.mood,
      themeId: this.project.themeId,
      seed: this.project.seed,
      proposalIndex: this.historyIndex + 1,
      historyTotal: this.history.length
    };
  }

  undoOmakase() {
    if (this.historyIndex <= 0 || !this.history.length) return null;
    this.historyIndex--;
    this.project = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.styleKey = this.project.style;
    this.moodKey = this.project.mood;
    this.rebuildPlan();
    this.drawCurrentFrame();
    return {
      style: this.project.style,
      mood: this.project.mood,
      themeId: this.project.themeId,
      seed: this.project.seed,
      proposalIndex: this.historyIndex + 1,
      historyTotal: this.history.length
    };
  }

  redoOmakase() {
    if (this.historyIndex >= this.history.length - 1) return null;
    this.historyIndex++;
    this.project = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
    this.styleKey = this.project.style;
    this.moodKey = this.project.mood;
    this.rebuildPlan();
    this.drawCurrentFrame();
    return {
      style: this.project.style,
      mood: this.project.mood,
      themeId: this.project.themeId,
      seed: this.project.seed,
      proposalIndex: this.historyIndex + 1,
      historyTotal: this.history.length
    };
  }

  rebuildProject() {
    const w = this.canvas && this.canvas.width > 0 ? this.canvas.width : 1920;
    const h = this.canvas && this.canvas.height > 0 ? this.canvas.height : 1080;
    const aspect = getAdaptiveDesignSize(w, h);

    this.project = buildJizuraProject({
      lyrics: this.lyrics,
      songMeta: this.songMeta,
      style: this.styleKey,
      mood: this.moodKey,
      themeId: this.themeKey,
      aspect,
      fxConfig: this.fxConfig
    });

    // 初始化历史堆栈，确保底案始终存在（历史索引 0）
    this.history = [JSON.parse(JSON.stringify(this.project))];
    this.historyIndex = 0;

    this.rebuildPlan();
  }

  rebuildPlan() {
    if (!this.project) {
      this.rebuildProject();
      return;
    }

    // 确保歌词和基础元数据始终完备，杜绝任何热重载或切案时丢失
    if (!this.project.lyrics || !this.project.timing) {
      const rawLrc = formatLyricsToLrc(this.lyrics);
      this.project.lyrics = rawLrc && rawLrc.trim().length > 0 ? rawLrc : '[00:00.00][间奏 999]';
      if (!this.project.title && this.songMeta?.title) this.project.title = this.songMeta.title;
      if (!this.project.artist && this.songMeta?.artist) this.project.artist = this.songMeta.artist;
      if (!this.project.timing) {
        this.project.timing = { bpm: 0, offset: 0.1, snap: true, tail: 0.9, lineTimes: {}, lineScale: 1 };
      }
    }

    try {
      this.plan = createJizuraPlan(this.project);
    } catch (err) {
      console.warn('[JizuraEngine] createJizuraPlan failed, fallback to rebuildProject:', err);
      this.rebuildProject();
      return;
    }

    this.drawCurrentFrame();
  }

  setPlaybackTime(timeInSeconds, isPlaying = false) {
    this.currentTime = Math.max(0, timeInSeconds || 0);
    this.isPlaying = Boolean(isPlaying);
    if (!isPlaying) {
      this.drawCurrentFrame();
    }
  }

  setAudioAnalyser(analyser) {
    this.audioAnalyser = analyser;
    if (analyser && !this.freqData) {
      this.freqData = new Uint8Array(analyser.frequencyBinCount || 128);
    }
  }

  async addMediaUrl(url) {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    }).catch(() => {});
    this.coverImage = img;
    this.drawCurrentFrame();
  }

  clearMedia() {
    this.coverImage = null;
    this.drawCurrentFrame();
  }

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const tick = () => {
      if (this.isPlaying) {
        this.drawCurrentFrame();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  drawCurrentFrame() {
    if (!this.ctx || !this.canvas || !this.renderer || !this.plan) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (cw <= 0 || ch <= 0) return;

    const W = this.plan.W || 1920;
    const H = this.plan.H || 1080;

    // 自适应精确缩放：以 contain 为基准保障绝无任何边缘被裁切，配合居中偏移
    const scale = Math.min(cw / W, ch / H);
    const offsetX = Math.round((cw - W * scale) / 2);
    const offsetY = Math.round((ch - H * scale) / 2);

    // 音频 Analyser 实时低频驱动
    if (this.audioAnalyser && this.freqData && this.isPlaying) {
      this.audioAnalyser.getByteFrequencyData(this.freqData);
      // 取前 8 个频段能量 (低频 sub-bass)
      let bassSum = 0;
      for (let i = 0; i < 8; i++) bassSum += this.freqData[i] || 0;
      const bassLevel = (bassSum / (8 * 255));
      this.smoothedBass = this.smoothedBass * 0.7 + bassLevel * 0.3;
    } else {
      this.smoothedBass = 0;
    }

    // 调用 JIZURA 原生 Renderer 绘制分镜（transparent: false 确保风格专属背景色、径向光晕与纸质肌理完整呈现，传入居中偏移）
    const t = this.currentTime;
    try {
      this.renderer.frame(this.ctx, this.plan, t, { scale, offsetX, offsetY, transparent: false });
    } catch (e) {
      console.warn('[JizuraEngine] render frame error:', e);
    }

    // 黑客帝国专属：动态数字代码雨流光 (Matrix Code Rain)
    if (this.styleKey === 'matrix') {
      this.drawMatrixRain(this.ctx, cw, ch);
    }

    // 绘制封面光影底图（如果开启）：采用 soft-light 柔光模式与高斯模糊叠加在底层，既有专辑光影质感又绝不破坏风格本体调色
    if (this.coverImage && this.useCover) {
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'soft-light';
      this.ctx.globalAlpha = 0.25 * (this._effectOpacity ?? 1);
      this.ctx.filter = 'blur(40px) brightness(0.85)';
      this.ctx.drawImage(this.coverImage, 0, 0, cw, ch);
      this.ctx.restore();
    }
  }

  // 矩阵代码雨画布流光
  drawMatrixRain(ctx, cw, ch) {
    if (!this.matrixColumns || this.matrixColumns.length === 0 || this.matrixCw !== cw) {
      this.matrixCw = cw;
      const colWidth = 24;
      const count = Math.max(10, Math.floor(cw / colWidth));
      const charsPool = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
      this.matrixColumns = Array.from({ length: count }, (_, i) => ({
        x: i * colWidth + 12,
        y: Math.random() * ch - ch,
        speed: 120 + Math.random() * 240,
        chars: Array.from({ length: 14 + Math.floor(Math.random() * 10) }, () => charsPool[Math.floor(Math.random() * charsPool.length)])
      }));
    }

    const bass = this.smoothedBass || 0;
    const speedMult = (1.0 + bass * 1.8) * (this._animationSpeed || 1);
    const fontSize = 14;
    ctx.save();
    ctx.font = `bold ${fontSize}px "Consolas", "Courier New", monospace`;
    ctx.textAlign = 'center';

    const charsPool = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
    for (const col of this.matrixColumns) {
      col.y += (col.speed * speedMult) * (1 / 60);
      if (col.y - col.chars.length * fontSize > ch) {
        col.y = -Math.random() * 120;
        col.speed = 120 + Math.random() * 240;
      }
      if (Math.random() < 0.12) {
        col.chars[Math.floor(Math.random() * col.chars.length)] = charsPool[Math.floor(Math.random() * charsPool.length)];
      }

      for (let j = 0; j < col.chars.length; j++) {
        const py = col.y - j * fontSize;
        if (py < -20 || py > ch + 20) continue;
        const tailFrac = 1 - j / col.chars.length;
        if (j === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 0.95;
        } else if (j < 2) {
          ctx.fillStyle = '#66ff99';
          ctx.globalAlpha = Math.max(0.2, tailFrac * 0.85);
        } else {
          ctx.fillStyle = '#00ff41';
          ctx.globalAlpha = Math.max(0.06, tailFrac * 0.45);
        }
        ctx.fillText(col.chars[j], col.x, py);
      }
    }
    ctx.restore();
  }

  pause() {
    this.isPlaying = false;
    this.drawCurrentFrame();
  }

  resume() {
    this.isPlaying = true;
  }

  // 属性 getters/setters 供旧代码与滑块调节
  get animationSpeed() { return this._animationSpeed; }
  set animationSpeed(v) {
    this._animationSpeed = Number(v) || 1;
    this.setFxConfig({ motion: Math.max(0.2, (this._motionIntensity || 1) * this._animationSpeed * 0.7) });
  }

  get motionIntensity() { return this._motionIntensity; }
  set motionIntensity(v) {
    this._motionIntensity = Number(v) || 1;
    this.setFxConfig({ motion: Math.max(0.2, this._motionIntensity * (this._animationSpeed || 1) * 0.7) });
  }

  get effectOpacity() { return this._effectOpacity; }
  set effectOpacity(v) {
    this._effectOpacity = Number(v) || 1;
    this.drawCurrentFrame();
  }

  destroy() {
    this.stopLoop();
    if (this.resizeDebounceTimer) {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.project = null;
    this.plan = null;
    this.history = [];
    this.isReady = false;
  }
}

export default JizuraEngine;
