// src/utils/audioMatchEngine.js - Audio Match & Screen/Mic Fingerprint Recognition Engine
import { api } from './api.js';

let afpRuntimeLoaded = false;
let afpLoadPromise = null;

// Ensure WASM Fingerprint Runtime is Loaded
export function ensureAfpRuntime() {
  if (afpRuntimeLoaded && typeof window.GenerateFP === 'function') {
    return Promise.resolve();
  }
  if (afpLoadPromise) {
    return afpLoadPromise;
  }

  afpLoadPromise = new Promise(async (resolve, reject) => {
    try {
      if (typeof window.GenerateFP === 'function') {
        afpRuntimeLoaded = true;
        return resolve();
      }

      // Load afp.wasm.js first
      await loadScriptTag('/afp/afp.wasm.js');
      // Load afp.js
      await loadScriptTag('/afp/afp.js');

      if (typeof window.GenerateFP === 'function') {
        afpRuntimeLoaded = true;
        resolve();
      } else {
        throw new Error('GenerateFP function not available after loading scripts');
      }
    } catch (err) {
      console.error('Failed to load Audio Fingerprint WASM runtime:', err);
      reject(err);
    }
  });

  return afpLoadPromise;
}

function loadScriptTag(src) {
  return new Promise((resolve, reject) => {
    // Check if already injected
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Resample any audio buffer (e.g. 44100Hz / 48000Hz) to 8000Hz mono Float32Array
export function resampleTo8000Hz(audioBuffer, targetLength = 24000) {
  const sourceRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Left channel
  const targetRate = 8000;
  
  const targetSamplesCount = Math.floor(channelData.length * (targetRate / sourceRate));
  const resampled = new Float32Array(targetLength);
  
  const step = sourceRate / targetRate;
  for (let i = 0; i < targetLength; i++) {
    const srcIndex = i * step;
    const indexLow = Math.floor(srcIndex);
    const indexHigh = Math.min(indexLow + 1, channelData.length - 1);
    const weight = srcIndex - indexLow;
    
    if (indexLow < channelData.length) {
      // Linear interpolation
      resampled[i] = channelData[indexLow] * (1 - weight) + channelData[indexHigh] * weight;
    } else {
      resampled[i] = 0;
    }
  }
  
  return resampled;
}

// Capture System/Screen Audio Stream using Electron DesktopCapturer & WebRTC
export async function captureScreenAudioStream() {
  if (!window.electronAPI?.getDesktopSources) {
    throw new Error('桌面音频捕获仅在 Electron 桌面端可用');
  }

  const sources = await window.electronAPI.getDesktopSources({ types: ['screen'] });
  if (!sources || sources.length === 0) {
    throw new Error('未检测到可捕获的屏幕音频源');
  }

  const primarySource = sources[0];

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primarySource.id
      }
    },
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primarySource.id,
        maxWidth: 1,
        maxHeight: 1,
        maxFrameRate: 1
      }
    }
  });

  return { stream, sourceName: primarySource.name || '系统屏幕声音' };
}

// Capture Microphone Audio Stream
export async function captureMicAudioStream() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    }
  });
  return { stream, sourceName: '麦克风拾音' };
}

// Record, Analyze Live Waveform, and Generate Fingerprint
export async function recordAndRecognize({
  mode = 'screen', // 'screen' | 'mic'
  durationSec = 3,
  onProgress = null, // ({ secondsLeft, progress, liveVolume }) => {}
  onWaveform = null  // (waveformUint8Array) => {}
}) {
  await ensureAfpRuntime();

  let captureResult;
  if (mode === 'screen') {
    try {
      captureResult = await captureScreenAudioStream();
    } catch (err) {
      console.warn('Screen audio capture failed, falling back to mic:', err);
      captureResult = await captureMicAudioStream();
    }
  } else {
    captureResult = await captureMicAudioStream();
  }

  const { stream } = captureResult;
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;
  analyserNode.smoothingTimeConstant = 0.8;
  sourceNode.connect(analyserNode);

  // Buffer collection setup
  const bufferSize = 4096;
  const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  const recordedChunks = [];
  let totalRecordedSamples = 0;
  const targetSamplesAtCtxRate = audioContext.sampleRate * durationSec;

  let isRecording = true;
  const startTime = Date.now();
  let animationFrameId = null;

  // Real-time Waveform & Volume loop
  const timeData = new Uint8Array(analyserNode.frequencyBinCount);
  const freqData = new Uint8Array(analyserNode.frequencyBinCount);

  function updateWaveformLoop() {
    if (!isRecording) return;
    analyserNode.getByteTimeDomainData(timeData);
    analyserNode.getByteFrequencyData(freqData);

    let sum = 0;
    for (let i = 0; i < freqData.length; i++) {
      sum += freqData[i];
    }
    const avgVolume = sum / freqData.length / 255;

    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(1, elapsed / durationSec);
    const secondsLeft = Math.max(0, durationSec - elapsed);

    onProgress?.({
      secondsLeft,
      progress,
      liveVolume: avgVolume
    });

    onWaveform?.(timeData, freqData);

    animationFrameId = requestAnimationFrame(updateWaveformLoop);
  }

  updateWaveformLoop();

  // Audio Recording Promise
  const recordingPromise = new Promise((resolve) => {
    scriptNode.onaudioprocess = (e) => {
      if (!isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      recordedChunks.push(new Float32Array(inputData));
      totalRecordedSamples += inputData.length;

      if (totalRecordedSamples >= targetSamplesAtCtxRate) {
        isRecording = false;
        resolve();
      }
    };
    sourceNode.connect(scriptNode);
    scriptNode.connect(audioContext.destination);
  });

  // Wait for recording duration
  await Promise.race([
    recordingPromise,
    new Promise(res => setTimeout(res, (durationSec + 0.3) * 1000))
  ]);

  isRecording = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  // Clean up Web Audio and Stream
  try {
    scriptNode.disconnect();
    sourceNode.disconnect();
    analyserNode.disconnect();
    stream.getTracks().forEach(t => t.stop());
    await audioContext.close();
  } catch (err) {
    console.debug('Error closing capture context:', err);
  }

  // Merge Chunks into a single AudioBuffer or Float32Array
  const mergedSamples = new Float32Array(totalRecordedSamples);
  let offset = 0;
  for (const chunk of recordedChunks) {
    mergedSamples.set(chunk, offset);
    offset += chunk.length;
  }

  // Resample to 8000Hz mono (24,000 samples)
  const target8kLength = durationSec * 8000;
  const resampled8k = new Float32Array(target8kLength);
  const step = audioContext.sampleRate / 8000;

  for (let i = 0; i < target8kLength; i++) {
    const srcIdx = i * step;
    const idxLow = Math.floor(srcIdx);
    const idxHigh = Math.min(idxLow + 1, mergedSamples.length - 1);
    const frac = srcIdx - idxLow;
    if (idxLow < mergedSamples.length) {
      resampled8k[i] = mergedSamples[idxLow] * (1 - frac) + mergedSamples[idxHigh] * frac;
    } else {
      resampled8k[i] = 0;
    }
  }

  // Extract Query Fingerprint with WASM
  const audioFP = await window.GenerateFP(resampled8k);
  if (!audioFP) {
    throw new Error('未能从音频采样中提取出有效特征指纹');
  }

  // Query NetEase Audio Match API
  const matchResponse = await api.audioMatch({ duration: durationSec, audioFP });
  const rawResultList = matchResponse?.data?.result || matchResponse?.result || [];

  if (!Array.isArray(rawResultList) || rawResultList.length === 0) {
    return {
      success: false,
      message: '未能识别出正在播放的歌曲，请确保声音清晰或切换模式重试',
      results: []
    };
  }

  // Enrich with full song details (HD cover, high quality audio url, etc.)
  const songIds = rawResultList.map(item => item.song?.id).filter(Boolean);
  let enrichedSongsMap = new Map();

  if (songIds.length > 0) {
    try {
      const detailsRes = await api.getSongDetails(songIds.join(','));
      const songs = detailsRes?.songs || [];
      songs.forEach(s => enrichedSongsMap.set(s.id, s));
    } catch (err) {
      console.debug('Failed to enrich song details for match:', err);
    }
  }

  const formattedResults = rawResultList.map((item, index) => {
    const rawSong = item.song || {};
    const enriched = enrichedSongsMap.get(rawSong.id) || rawSong;
    const artists = enriched.ar?.map(a => a.name).join(' / ') || enriched.artists?.map(a => a.name).join(' / ') || rawSong.artists?.map(a => a.name).join(' / ') || '未知歌手';
    const albumName = enriched.al?.name || enriched.album?.name || rawSong.album?.name || '未知专辑';
    const coverUrl = enriched.al?.picUrl || enriched.album?.picUrl || rawSong.album?.picUrl || '';
    const duration = Math.round((enriched.dt || enriched.duration || 0) / 1000) || 180;
    const startTimeSec = Math.round((item.startTime || 0) / 1000);

    return {
      id: rawSong.id,
      name: enriched.name || rawSong.name || '未知歌曲',
      artist: artists,
      artistsList: enriched.ar || rawSong.artists || [],
      album: albumName,
      albumId: enriched.al?.id || rawSong.album?.id,
      coverUrl: coverUrl || 'static/ichigo.png',
      duration,
      startTimeSec,
      matchScore: index === 0 ? 98 : (92 - index * 5),
      raw: enriched
    };
  });

  return {
    success: true,
    message: `成功识别到 ${formattedResults.length} 首匹配歌曲`,
    results: formattedResults
  };
}
