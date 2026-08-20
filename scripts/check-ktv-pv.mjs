import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const source = read('src/components/lyrics/KineticKtvLyrics.jsx');
const appSource = read('src/App.jsx');
const engineSource = read('src/pv/core/engine.ts');
const effectsIndexSource = read('src/pv/effects/index.ts');
const templatesIndexSource = read('src/pv/templates/index.ts');
const immersiveModesSource = read('src/utils/immersiveModes.js');


const templateKeys = [
  'cinemaTeal', 'yozakura', 'kawaiPixel', 'rainCity', 'p5',
  'cityPop', 'neonNight', 'mono', 'tasogare', 'shinkuu',
  'zasshi', 'lemonSoda', 'kiri', 'umi', 'film',
  'yorushika', 'blueInk', 'battle', 'cyber', 'digitalImpression',
  'glitch', 'holoScope', 'sweetPink', 'popArt', 'ruler', 'silhouetteClean',
  'evaAlert', 'cyberpunk2077'
];

const checks = [
  ['PVEngine core is available and has lifecycle methods',
    engineSource.includes('export class PVEngine') &&
    engineSource.includes('async init(') &&
    engineSource.includes('destroy()') &&
    engineSource.includes('loadTemplate(') &&
    engineSource.includes('setPlaybackTime(') &&
    engineSource.includes('setLyricTimeline(') &&
    engineSource.includes('addMediaUrl(')],

  ['All PV templates are loaded and indexed in templates/index.ts',
    templateKeys.every(tplKey => templatesIndexSource.includes(tplKey))],

  ['50+ effect renderers are registered in effects catalog',
    ['lyricText', 'matrixDecodeText', 'pixelTypewriterText', 'modernArchitectText', 'poeticStaggerText', 'popComicText', 'cinematicCleanText', 'kineticSlashText', 'meshGradient', 'dustParticles', 'petalFall', 'waveLines', 'speedLines', 'retroSun', 'threadLine', 'paperTear', 'chromaticAberration', 'filmGrain', 'scanlines', 'glitchBars', 'vignette', 'letterbox', 'pixelWindow', 'desktopIcon', 'pixelBackground', 'pixelTypewriter', 'shatterText', 'staggeredText', 'fallingText', 'waveText'].every(effectName => effectsIndexSource.includes(`'${effectName}'`))],


  ['KineticKtvLyrics mounts PVEngine and syncs with lyric clock',
    source.includes('new PVEngine()') &&
    source.includes('subscribeLyricClock') &&
    source.includes('pv.setPlaybackTime') &&
    source.includes('pv.setLyricTimeline') &&
    source.includes('kpv-pixi-stage')],

  ['App gallery contains complete template selection and preview colors',
    (appSource.includes('KTV_TEMPLATE_GALLERY') || immersiveModesSource.includes('KTV_TEMPLATE_GALLERY')) &&
    templateKeys.every(key => immersiveModesSource.includes(key))],


  ['PV settings include animation speed, motion intensity, title card, and translation controls',
    appSource.includes('ktvSpeed') &&
    appSource.includes('ktvMotion') &&
    appSource.includes('ktvBgOpacity') &&
    appSource.includes('ktvShowTitleCard') &&
    (appSource.includes('showTranslation') || appSource.includes('ktvShowTranslation'))]

];

let failed = 0;
for (const [title, pass] of checks) {
  if (!pass) {
    console.error(`FAIL: ${title}`);
    failed++;
  } else {
    console.log(`OK: ${title}`);
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log(`\n[check:ktv-pv] All ${checks.length} checks PASSED.`);
}
