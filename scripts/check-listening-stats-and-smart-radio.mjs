// scripts/check-listening-stats-and-smart-radio.mjs
import fs from 'node:fs';
import path from 'node:path';
import {
  classifySongGenre,
  getMusicPersona,
  GENRE_CATEGORIES
} from '../src/utils/listeningStats.js';

const root = process.cwd();

// 1. Verify Genre Categories & Lexicon
if (!Array.isArray(GENRE_CATEGORIES) || GENRE_CATEGORIES.length !== 8) {
  throw new Error(`Expected 8 genre categories, got ${GENRE_CATEGORIES?.length}`);
}

const expectedGenreKeys = ['pop', 'rock', 'electronic', 'acg', 'folk', 'hiphop', 'jazz', 'classical'];
for (const key of expectedGenreKeys) {
  if (!GENRE_CATEGORIES.some(g => g.key === key)) {
    throw new Error(`Missing expected genre key: ${key}`);
  }
}

// 2. Test Genre Classifier
const testAcgSong = { name: '群青 (YOASOBI)', ar: [{ name: 'YOASOBI' }], album: { name: 'THE BOOK' } };
const acgScores = classifySongGenre(testAcgSong);
if (!acgScores.acg && !acgScores.pop) {
  throw new Error('ACG song classification failed for YOASOBI');
}

const testRockSong = { name: 'Smells Like Teen Spirit', ar: [{ name: 'Nirvana' }], album: { name: 'Nevermind (Rock)' } };
const rockScores = classifySongGenre(testRockSong);
if (!rockScores.rock) {
  throw new Error('Rock song classification failed');
}

// 3. Test Music Persona Generator
const persona1 = getMusicPersona([{ key: 'acg', percentage: 45, name: 'ACG / 动漫' }, { key: 'electronic', percentage: 30, name: '电子' }]);
if (!persona1 || typeof persona1 !== 'string') {
  throw new Error('Persona generation failed');
}

// 4. Verify ListeningStatsReport and Settings Integration
const statsReportSrc = fs.readFileSync(path.join(root, 'src/components/ListeningStatsReport.jsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(root, 'src/views/Settings.jsx'), 'utf8');

if (!statsReportSrc.includes('radarData') || !statsReportSrc.includes('webPolygons') || !statsReportSrc.includes('handleLaunchSmartRadio')) {
  throw new Error('ListeningStatsReport must contain SVG radar chart and smart radio launcher');
}

if (!settingsSrc.includes('<ListeningStatsReport') || !settingsSrc.includes('renderAccountTab')) {
  throw new Error('Settings.jsx must embed ListeningStatsReport in renderAccountTab');
}

// 5. Verify AppContext Smart Radio Dynamic Queue Builder
const appContextSrc = fs.readFileSync(path.join(root, 'src/context/AppContext.jsx'), 'utf8');
if (!appContextSrc.includes('buildDynamicSmartRadioQueue') || !appContextSrc.includes('cycle === 0')) {
  throw new Error('AppContext must implement buildDynamicSmartRadioQueue with progressive discovery pacing');
}

if (!appContextSrc.includes('isHeartRecommend: true')) {
  throw new Error('AppContext must tag recommended tracks with isHeartRecommend: true');
}

console.log('✅ [check:listening-stats-and-smart-radio] All Listening Stats, Genre Radar, and Smart Radio checks passed successfully!');
