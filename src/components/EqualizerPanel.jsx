import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Sliders, Volume2, RotateCcw, Plus, Trash2, X, Activity, Sparkles, Waves } from 'lucide-react';
import {
  EQ_BAND_FREQUENCIES,
  EQ_BAND_LABELS,
  EQ_PRESETS,
  EQ_PRESET_NAMES
} from '../utils/settingsProfile';

export default function EqualizerPanel({ isModal = false, onClose }) {
  const { audioConfig, saveAudioConfig, isPlaying, colorMode, immersiveColor } = useApp();

  const eqConfig = audioConfig?.equalizer || {
    enabled: false,
    preset: 'none',
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    customPresets: []
  };

  const isLight = colorMode === 'light';
  const isEnabled = eqConfig.enabled === true;
  const currentPreset = eqConfig.preset || 'none';
  const customPresets = Array.isArray(eqConfig?.customPresets) ? eqConfig.customPresets : [];
  const crossfadeDuration = audioConfig?.crossfade ?? 1.0;

  const currentBands = useMemo(() => {
    let raw = eqConfig.bands;
    if (!Array.isArray(raw)) {
      if (raw && typeof raw === 'object') {
        const legacyKeys = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
        raw = legacyKeys.map((k) => Number(raw[k] || 0));
      } else {
        raw = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      }
    }
    const safe = [...raw];
    while (safe.length < 10) safe.push(0);
    return safe.slice(0, 10).map((v) => Math.max(-12, Math.min(12, Number(v) || 0)));
  }, [eqConfig.bands]);

  const [savingPresetName, setSavingPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  // Toggle Equalizer Master Switch
  const toggleEq = () => {
    saveAudioConfig({
      equalizer: {
        ...eqConfig,
        enabled: !isEnabled
      }
    });
  };

  // Change Preset
  const handleSelectPreset = (presetKey) => {
    if (EQ_PRESETS[presetKey]) {
      saveAudioConfig({
        equalizer: {
          ...eqConfig,
          preset: presetKey,
          bands: [...EQ_PRESETS[presetKey]]
        }
      });
    }
  };

  // Select Custom Preset
  const handleSelectCustomPreset = (customPreset) => {
    if (customPreset && Array.isArray(customPreset.bands)) {
      saveAudioConfig({
        equalizer: {
          ...eqConfig,
          preset: `custom:${customPreset.id}`,
          bands: [...customPreset.bands]
        }
      });
    }
  };

  // Save Current as Custom Preset
  const handleSaveCustomPreset = () => {
    const name = savingPresetName.trim();
    if (!name) return;
    const newCustom = {
      id: `custom_${Date.now()}`,
      name,
      bands: [...currentBands]
    };
    const updatedCustoms = [...customPresets, newCustom];
    saveAudioConfig({
      equalizer: {
        ...eqConfig,
        preset: `custom:${newCustom.id}`,
        customPresets: updatedCustoms
      }
    });
    setSavingPresetName('');
    setShowSaveInput(false);
  };

  // Delete Custom Preset
  const handleDeleteCustomPreset = (id, e) => {
    e.stopPropagation();
    const updated = (Array.isArray(customPresets) ? customPresets : []).filter((p) => p && p.id !== id);
    const nextPreset = currentPreset === `custom:${id}` ? 'none' : currentPreset;
    saveAudioConfig({
      equalizer: {
        ...eqConfig,
        preset: nextPreset,
        customPresets: updated
      }
    });
  };

  // Adjust Single Band Slider
  const handleBandChange = (index, value) => {
    const nextBands = [...currentBands];
    nextBands[index] = Math.max(-12, Math.min(12, Number(value)));
    saveAudioConfig({
      equalizer: {
        ...eqConfig,
        preset: 'custom',
        bands: nextBands
      }
    });
  };

  // Reset Single Band to 0
  const handleResetBand = (index) => {
    handleBandChange(index, 0);
  };

  // Reset All Bands to Flat
  const handleResetAll = () => {
    saveAudioConfig({
      equalizer: {
        ...eqConfig,
        preset: 'none',
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    });
  };

  // Update Crossfade Duration (0~10s)
  const handleCrossfadeChange = (val) => {
    const clamped = Math.max(0, Math.min(10, Math.round(Number(val) * 10) / 10));
    saveAudioConfig({
      crossfade: clamped
    });
  };

  // Real-time Canvas Spectrum & EQ Response Curve Visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let smoothSpectrum = new Float32Array(10);
    const sampleBuffer = new Uint8Array(256);

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // 1. Background Grid and 0dB Reference Line
      const dbSteps = [12, 6, 0, -6, -12];
      dbSteps.forEach((db) => {
        const y = height * 0.5 - (db / 12) * (height * 0.42);
        ctx.beginPath();
        if (db === 0) {
          ctx.strokeStyle = isLight ? 'rgba(255, 64, 129, 0.4)' : 'rgba(255, 64, 129, 0.3)';
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
          ctx.setLineDash([]);
        }
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // 2. Sample Audio Spectrum from Analyser
      const analyser = window.ichigoAnalyser;
      if (analyser && analyser.getByteFrequencyData && isPlaying) {
        analyser.getByteFrequencyData(sampleBuffer);
        const binCount = analyser.frequencyBinCount || 128;
        const sampleRate = (window.ichigoAudioContext?.sampleRate) || 44100;
        const nyquist = sampleRate / 2;

        EQ_BAND_FREQUENCIES.forEach((freq, idx) => {
          const binIndex = Math.min(binCount - 1, Math.max(0, Math.round((freq / nyquist) * binCount)));
          let sum = 0;
          let count = 0;
          for (let b = Math.max(0, binIndex - 2); b <= Math.min(binCount - 1, binIndex + 2); b += 1) {
            sum += sampleBuffer[b] || 0;
            count += 1;
          }
          const rawAmp = count > 0 ? (sum / count) / 255 : 0;
          smoothSpectrum[idx] = smoothSpectrum[idx] * 0.72 + rawAmp * 0.28;
        });
      } else {
        for (let i = 0; i < 10; i += 1) {
          smoothSpectrum[i] *= 0.85;
        }
      }

      // 3. Render 10 Spectrum Columns
      const colStep = width / 10;
      for (let i = 0; i < 10; i += 1) {
        const x = i * colStep + colStep * 0.5;
        const amp = smoothSpectrum[i];
        if (amp > 0.01) {
          const barHeight = amp * (height * 0.75);
          const barY = height - barHeight;
          const barGrad = ctx.createLinearGradient(0, height, 0, barY);
          if (isLight) {
            barGrad.addColorStop(0, 'rgba(255, 64, 129, 0.08)');
            barGrad.addColorStop(0.6, 'rgba(255, 64, 129, 0.35)');
            barGrad.addColorStop(1, 'rgba(0, 160, 220, 0.65)');
          } else {
            barGrad.addColorStop(0, 'rgba(255, 64, 129, 0.05)');
            barGrad.addColorStop(0.6, 'rgba(255, 64, 129, 0.25)');
            barGrad.addColorStop(1, 'rgba(0, 212, 255, 0.55)');
          }

          ctx.fillStyle = barGrad;
          ctx.beginPath();
          const barW = Math.min(28, colStep * 0.52);
          ctx.roundRect(x - barW / 2, barY, barW, barHeight, [4, 4, 0, 0]);
          ctx.fill();
        }
      }

      // 4. Render EQ Frequency Response Curve (Spline)
      const points = currentBands.map((db, i) => {
        const x = i * colStep + colStep * 0.5;
        const effectiveDb = isEnabled ? db : 0;
        const y = height * 0.5 - (effectiveDb / 12) * (height * 0.42);
        return { x, y };
      });

      // Shaded gradient under curve
      const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isLight) {
        areaGrad.addColorStop(0, isEnabled ? 'rgba(255, 64, 129, 0.25)' : 'rgba(0, 0, 0, 0.05)');
        areaGrad.addColorStop(0.5, isEnabled ? 'rgba(0, 180, 230, 0.12)' : 'rgba(0, 0, 0, 0.02)');
        areaGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        areaGrad.addColorStop(0, isEnabled ? 'rgba(255, 64, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)');
        areaGrad.addColorStop(0.5, isEnabled ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)');
        areaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      const last = points[points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.lineTo(width, height * 0.5);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Glowing stroke line
      ctx.beginPath();
      ctx.moveTo(0, height * 0.5);
      ctx.lineTo(points[0].x, points[0].y);
      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.quadraticCurveTo(p0.x, p0.y, midX, midY);
      }
      ctx.lineTo(last.x, last.y);
      ctx.lineTo(width, height * 0.5);

      ctx.lineWidth = 3;
      ctx.strokeStyle = isEnabled ? (immersiveColor || '#ff4081') : (isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)');
      ctx.shadowColor = isEnabled ? (immersiveColor || 'rgba(255, 64, 129, 0.8)') : 'transparent';
      ctx.shadowBlur = isEnabled ? 10 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw active node dots on the curve
      points.forEach((pt, i) => {
        const db = isEnabled ? currentBands[i] : 0;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.abs(db) > 0.5 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = isEnabled ? (db > 0 ? '#ff4081' : (db < 0 ? '#00d4ff' : (isLight ? '#1a192b' : '#ffffff'))) : (isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.5)');
        ctx.shadowColor = isEnabled ? '#ff4081' : 'transparent';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      rafRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [currentBands, isEnabled, isPlaying, isLight, immersiveColor]);

  const panelContent = (
    <div
      style={{
        width: '100%',
        background: isModal
          ? (isLight ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(246, 244, 252, 0.98) 100%)' : 'linear-gradient(145deg, rgba(24, 20, 36, 0.94) 0%, rgba(12, 10, 20, 0.96) 100%)')
          : (isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)'),
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        padding: '20px 24px',
        boxShadow: isModal
          ? (isLight ? '0 24px 64px rgba(0, 0, 0, 0.2), 0 0 32px rgba(255, 64, 129, 0.1)' : '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 32px rgba(255, 64, 129, 0.12)')
          : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: isLight ? '#1a192b' : '#fff',
        boxSizing: 'border-box'
      }}
      onClick={(e) => isModal && e.stopPropagation()}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: isEnabled ? 'linear-gradient(135deg, #ff4081, #7928ca)' : (isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isEnabled ? '0 0 16px rgba(255, 64, 129, 0.4)' : 'none',
            transition: 'all 0.3s'
          }}>
            <Sliders size={18} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: isLight ? '#1a192b' : '#fff' }}>
              10 段图形可视化均衡器 (EQ)
              {isEnabled && <span style={{ fontSize: '11px', background: 'rgba(255, 64, 129, 0.15)', color: '#ff4081', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(255, 64, 129, 0.3)' }}>运行中</span>}
            </h3>
            <small style={{ color: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
              Web Audio 31Hz~16kHz 高精滤波 · 12 款大师预设 · 60fps 实时频谱
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Master Switch */}
          <button
            type="button"
            onClick={toggleEq}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              border: isEnabled ? '1px solid #ff4081' : (isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.15)'),
              background: isEnabled ? 'rgba(255, 64, 129, 0.15)' : (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)'),
              color: isEnabled ? '#ff4081' : (isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.6)'),
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={13} />
            {isEnabled ? '均衡器已开启' : '均衡器已旁通'}
          </button>

          {/* Reset All */}
          <button
            type="button"
            onClick={handleResetAll}
            title="重置为原声平直"
            style={{
              background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.06)',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
              color: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
              padding: '5px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px'
            }}
          >
            <RotateCcw size={12} />
            平直
          </button>

          {/* Close button if in modal */}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Spectrum & Spline Response Curve */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '110px',
        background: isLight ? 'rgba(240, 238, 248, 0.8)' : 'rgba(0, 0, 0, 0.35)',
        borderRadius: '16px',
        overflow: 'hidden',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <canvas
          ref={canvasRef}
          width={720}
          height={110}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <div style={{ position: 'absolute', top: '8px', left: '12px', fontSize: '11px', color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.4)', pointerEvents: 'none', display: 'flex', gap: '12px' }}>
          <span>+12dB</span>
          <span>0dB</span>
          <span>-12dB</span>
        </div>
        <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: '11px', color: isEnabled ? '#ff4081' : (isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.4)'), pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Waves size={12} />
          <span>实时频响曲线 (Transfer Curve)</span>
        </div>
      </div>

      {/* 12 Presets Selection Pills */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} color="var(--primary, #ff4081)" /> 12 款大师音效预设
          </span>
          <button
            type="button"
            onClick={() => setShowSaveInput(!showSaveInput)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary, #ff4081)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={13} />
            保存当前微调为新预设
          </button>
        </div>

        {/* Save Preset Inline Input */}
        {showSaveInput && (
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '10px',
            background: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)',
            padding: '8px 12px',
            borderRadius: '10px'
          }}>
            <input
              type="text"
              placeholder="输入自定义预设名称 (如：我的重低音)"
              value={savingPresetName}
              onChange={(e) => setSavingPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCustomPreset()}
              style={{
                flex: 1,
                background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.4)',
                border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: isLight ? '#1a192b' : '#fff',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              type="button"
              onClick={handleSaveCustomPreset}
              style={{
                background: 'var(--primary, #ff4081)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setShowSaveInput(false)}
              style={{
                background: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)',
                color: isLight ? '#1a192b' : '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        )}

        {/* Preset Buttons Grid / Flex Wrap */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.keys(EQ_PRESETS).map((pKey) => {
            const active = currentPreset === pKey;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => handleSelectPreset(pKey)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  background: active
                    ? 'linear-gradient(135deg, rgba(255, 64, 129, 0.9), rgba(121, 40, 202, 0.9))'
                    : (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)'),
                  border: active
                    ? '1px solid rgba(255, 64, 129, 0.5)'
                    : (isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'),
                  color: active ? '#fff' : (isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)'),
                  transition: 'all 0.18s'
                }}
              >
                {EQ_PRESET_NAMES[pKey] || pKey}
              </button>
            );
          })}

          {/* Custom Presets */}
          {customPresets.map((cp) => {
            const active = currentPreset === `custom:${cp.id}`;
            return (
              <div
                key={cp.id}
                onClick={() => handleSelectCustomPreset(cp)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  background: active ? 'rgba(0, 212, 255, 0.22)' : (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)'),
                  border: active ? '1px solid #00d4ff' : (isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'),
                  color: active ? (isLight ? '#0284c7' : '#00d4ff') : (isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)')
                }}
              >
                <span>{cp.name}</span>
                <button
                  type="button"
                  onClick={(e) => handleDeleteCustomPreset(cp.id, e)}
                  style={{ background: 'none', border: 'none', padding: 0, color: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)', cursor: 'pointer', display: 'flex' }}
                  title="删除该自定义预设"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 10 Precision Vertical Fader Sliders */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: '8px',
        background: isLight ? 'rgba(245, 243, 252, 0.75)' : 'rgba(0, 0, 0, 0.25)',
        padding: '16px 10px',
        borderRadius: '16px',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        {EQ_BAND_LABELS.map((label, idx) => {
          const dbVal = currentBands[idx];
          const isBoost = dbVal > 0;
          const isCut = dbVal < 0;
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                position: 'relative'
              }}
            >
              {/* dB Badge (Double click to reset single band) */}
              <button
                type="button"
                onDoubleClick={() => handleResetBand(idx)}
                title="双击归零 (0dB)"
                style={{
                  background: isBoost
                    ? 'rgba(255, 64, 129, 0.15)'
                    : (isCut ? (isLight ? 'rgba(0, 180, 230, 0.15)' : 'rgba(0, 212, 255, 0.2)') : (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)')),
                  border: isBoost
                    ? '1px solid rgba(255, 64, 129, 0.4)'
                    : (isCut ? (isLight ? '1px solid rgba(0, 180, 230, 0.35)' : '1px solid rgba(0, 212, 255, 0.3)') : (isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)')),
                  color: isBoost
                    ? '#ff4081'
                    : (isCut ? (isLight ? '#0284c7' : '#00d4ff') : (isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.6)')),
                  borderRadius: '6px',
                  padding: '2px 4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: '38px',
                  textAlign: 'center'
                }}
              >
                {dbVal > 0 ? `+${dbVal.toFixed(0)}` : dbVal.toFixed(0)}dB
              </button>

              {/* Vertical Slider Track Container */}
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '28px' }}>
                {/* Center 0dB dash mark */}
                <div style={{ position: 'absolute', top: '50%', width: '18px', height: '1px', background: isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.18)', pointerEvents: 'none' }} />

                {/* Vertical HTML Input Range */}
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={dbVal}
                  onChange={(e) => handleBandChange(idx, e.target.value)}
                  style={{
                    writingMode: 'bt-lr',
                    WebkitAppearance: 'slider-vertical',
                    width: '24px',
                    height: '130px',
                    cursor: 'ns-resize',
                    accentColor: isBoost ? '#ff4081' : (isCut ? '#00d4ff' : (isLight ? '#6b7280' : 'rgba(255, 255, 255, 0.7)'))
                  }}
                />
              </div>

              {/* Frequency Band Label */}
              <span style={{ fontSize: '11px', fontWeight: 600, color: isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)' }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Crossfade / Seamless Transition Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
        padding: '12px 18px',
        borderRadius: '14px',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Volume2 size={16} color="var(--primary, #ff4081)" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: isLight ? '#1a192b' : '#fff' }}>
              切歌交叉淡入淡出 (Crossfade)：{crossfadeDuration > 0 ? `${crossfadeDuration.toFixed(1)} 秒` : '已关闭 (0s)'}
            </div>
            <small style={{ color: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>
              切歌与启停时 Web Audio 动态混音平滑渐变，消除爆音与突兀感 (0~10s)
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '220px' }}>
          <input
            type="range"
            min="0"
            max="10"
            step="0.2"
            value={crossfadeDuration}
            onChange={(e) => handleCrossfadeChange(e.target.value)}
            style={{ flex: 1, accentColor: 'var(--primary, #ff4081)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary, #ff4081)', minWidth: '36px', textAlign: 'right' }}>
            {crossfadeDuration.toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );

  if (!isModal) {
    return panelContent;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div style={{ width: '780px', maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }}>
        {panelContent}
      </div>
    </div>
  );
}
