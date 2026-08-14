import React from 'react';
import StreamerLyrics from './StreamerLyrics';
import CloudStepLyrics from './CloudStepLyrics';
import SpatialCanvasLyrics from './SpatialCanvasLyrics';
import VinylRecordLyrics from './VinylRecordLyrics';
import SpotlightLyrics from './SpotlightLyrics';
import StarfieldLyrics from './StarfieldLyrics';
import FilmStripLyrics from './FilmStripLyrics';
import InkFlowLyrics from './InkFlowLyrics';
import { normalizeImmersiveMode, getVisualizerStyleForMode } from '../../utils/immersiveModes';

// The PV stylesheet and choreography tables are intentionally substantial.
// Keep them out of every normal player/immersive route, then load the module
// only when the user actually chooses the Text PV renderer.
const KineticKtvLyrics = React.lazy(() => import('./KineticKtvLyrics'));

// 每个模式只声明自己的参数映射，布局容器不需要知道各组件的细节
const IMMERSIVE_RENDERERS = {
  streamer: { component: StreamerLyrics, props: ({ config }) => ({ themeColor: 'var(--primary)', showGlow: config?.showGlow === true, globalOffset: config?.globalOffset || 0, alignMode: config?.bubbleAlign || 'alternate' }) },
  talk: { component: KineticKtvLyrics, props: ({ config, themeColor, translationPx, songKey, songTitle, songArtist, isPlaying, coverUrl }) => ({ themeColor: themeColor || 'var(--primary)', translationPx, songKey, songTitle, songArtist, isPlaying, coverUrl, config }) },
  cloudstep: { component: CloudStepLyrics, props: ({ config }) => ({ themeColor: 'var(--primary)', showGlow: config?.showGlow === true, globalOffset: config?.globalOffset || 0, cloudStepSpacing: config?.cloudStepSpacing || 1 }) },
  spatial: { component: SpatialCanvasLyrics, props: ({ config, themeColor, isPlaying }) => ({ config, themeColor, isPlaying, globalOffset: config?.globalOffset || 0 }) },
  vinyl: { component: VinylRecordLyrics, props: ({ config, themeColor, coverUrl, isPlaying }) => ({ config, themeColor, coverUrl, isPlaying, globalOffset: config?.globalOffset || 0, lineSpacing: config?.vinylLineSpacing ?? 0.7, tiltAngle: config?.vinylTiltAngle ?? 0 }) },
  spotlight: { component: SpotlightLyrics, props: ({ config, themeColor, fontPx, translationPx }) => ({ fontPx: fontPx * (config?.spotlightScale ?? 1.04), translationPx, showTranslation: config?.spotlightShowTranslation !== false && config?.showTranslation !== false, showGlow: config?.showGlow === true, glowIntensity: config?.lyricGlowIntensity ?? 1, accentColor: themeColor || 'var(--primary)', effect: 'auto', motion: 1 }) },
  starfield: { component: StarfieldLyrics, props: ({ config, themeColor, fontPx, translationPx, isPlaying }) => ({ fontPx, translationPx, isPlaying, showTranslation: config?.starShowTranslation !== false && config?.showTranslation !== false, showGlow: config?.showGlow !== false, glowIntensity: config?.lyricGlowIntensity ?? 1, density: config?.starDensity ?? 42, speed: config?.starSpeed ?? 1, depth: config?.starDepth ?? 1, accentColor: themeColor || 'var(--primary)', visualizerStyle: getVisualizerStyleForMode(config, 'starfield'), visualizerOpacity: config?.visualizerOpacity ?? 0.82, visualizerSmoothing: config?.visualizerSmoothing ?? 0.16, visualizerOffsetY: config?.visualizerOffsetY ?? 0, visualizerScale: config?.visualizerScale ?? 1, visualizerIntensity: config?.visualizerIntensity ?? 1 }) },
  filmstrip: { component: FilmStripLyrics, props: ({ config, themeColor, fontPx, translationPx, isPlaying }) => ({ fontPx, translationPx, isPlaying, showTranslation: config?.filmShowTranslation !== false && config?.showTranslation !== false, showGlow: config?.showGlow !== false, glowIntensity: config?.lyricGlowIntensity ?? 1, frameGap: config?.filmFrameGap ?? 18, filmOpacity: config?.filmOpacity ?? 0.22, activeScale: config?.filmActiveScale ?? 1.08, accentColor: themeColor || 'var(--primary)', visualizerStyle: getVisualizerStyleForMode(config, 'filmstrip'), visualizerOpacity: config?.visualizerOpacity ?? 0.82, visualizerSmoothing: config?.visualizerSmoothing ?? 0.16, visualizerOffsetY: config?.visualizerOffsetY ?? 0, visualizerScale: config?.visualizerScale ?? 1, visualizerIntensity: config?.visualizerIntensity ?? 1 }) },
  inkflow: { component: InkFlowLyrics, props: ({ config, themeColor, fontPx, translationPx, isPlaying }) => ({ fontPx, translationPx, isPlaying, showTranslation: config?.inkShowTranslation !== false && config?.showTranslation !== false, showGlow: config?.showGlow !== false, glowIntensity: config?.lyricGlowIntensity ?? 1, spread: config?.inkSpread ?? 1, opacity: config?.inkOpacity ?? 0.45, speed: config?.inkSpeed ?? 1, accentColor: themeColor || 'var(--primary)', visualizerStyle: getVisualizerStyleForMode(config, 'inkflow'), visualizerOpacity: config?.visualizerOpacity ?? 0.82, visualizerSmoothing: config?.visualizerSmoothing ?? 0.16, visualizerOffsetY: config?.visualizerOffsetY ?? 0, visualizerScale: config?.visualizerScale ?? 1, visualizerIntensity: config?.visualizerIntensity ?? 1 }) }
};

export const IMMERSIVE_RENDERER_IDS = Object.keys(IMMERSIVE_RENDERERS);

export function preloadKineticKtvLyrics() {
  return import('./KineticKtvLyrics');
}

export default function ImmersiveLyricsStage({ mode, lyrics = [], activeLineIndex = -1, engineRef, dimensions, fontStack, themeColor, coverUrl, isPlaying, songKey, songTitle, songArtist, config }) {
  const normalizedMode = normalizeImmersiveMode(mode);
  const renderer = IMMERSIVE_RENDERERS[normalizedMode] || IMMERSIVE_RENDERERS.talk;
  const Component = renderer.component;
  const modeProps = renderer.props({ config, themeColor, coverUrl, isPlaying, songKey, songTitle, songArtist, fontPx: dimensions.fontPx, translationPx: dimensions.transPx });
  return <div style={{ width: '100%', height: '100%' }}>
    <React.Suspense fallback={<div aria-label="正在载入文字 PV" style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 45%, rgba(109,156,255,.16), transparent 34%), #090d18' }} />}>
      <Component lyrics={lyrics} activeLineIndex={activeLineIndex} engineRef={engineRef} fontPx={dimensions.fontPx} fontStack={fontStack} {...modeProps} />
    </React.Suspense>
  </div>;
}





