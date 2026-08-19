// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';
import { cinemaTealTemplate } from './cinemaTeal';
import { hakushiTemplate } from './hakushi';
import { yozakuraTemplate } from './yozakura';
import { suisaiTemplate } from './suisai';
import { cityPopTemplate } from './cityPop';
import { rainCityTemplate } from './rainCity';
import { neonNightTemplate } from './neonNight';
import { monoTemplate } from './mono';
import { tasogareTemplate } from './tasogare';
import { shinkuuTemplate } from './shinkuu';
import { zasshiTemplate } from './zasshi';
import { akaiitoTemplate } from './akaiito';
import { lemonSodaTemplate } from './lemonSoda';
import { kiriTemplate } from './kiri';
import { shinpakuTemplate } from './shinpaku';
import { kawaiPixelTemplate } from './kawaiPixel';
import { umiTemplate } from './umi';
import { filmTemplate } from './film';
import { p5Template } from './p5';
import { yorushikaTemplate } from './yorushika';
import { blueInkTemplate } from './blueInk';
import { battleTemplate } from './battle';
import { cyberTemplate } from './cyber';
import { digitalImpressionTemplate } from './digitalImpression';
import { glitchTemplate } from './glitch';
import { holoScopeTemplate } from './holoScope';
import { popArtTemplate } from './popArt';
import { rulerTemplate } from './ruler';
import { silhouetteCleanTemplate } from './silhouetteClean';
import { sweetPinkTemplate } from './sweetPink';

export const templates: TemplateConfig[] = [
  cinemaTealTemplate,        // 0  青蓝电影
  hakushiTemplate,           // 1  白紙
  yozakuraTemplate,          // 2  春日影 (秒速5厘米)
  sweetPinkTemplate,         // 3  少女云朵
  suisaiTemplate,            // 4  水彩
  cityPopTemplate,           // 5  都市蓝调
  rainCityTemplate,          // 6  黑客帝国
  neonNightTemplate,         // 7  ネオン夜
  monoTemplate,              // 8  白黒
  tasogareTemplate,          // 9  黄昏
  shinkuuTemplate,           // 10 深空 (Fly Me to the Moon)
  zasshiTemplate,            // 11 雑誌
  akaiitoTemplate,           // 12 赤い糸
  lemonSodaTemplate,         // 13 檸檬ソーダ
  kiriTemplate,              // 14 霧
  shinpakuTemplate,          // 15 心拍
  kawaiPixelTemplate,        // 16 Kawaii像素
  umiTemplate,               // 17 海 (深海波澜)
  filmTemplate,              // 18 フィルム
  p5Template,                // 19 P5 怪盗
  yorushikaTemplate,         // 20 夜色
  blueInkTemplate,           // 21 蓝色构成
  battleTemplate,            // 22 战场
  cyberTemplate,             // 23 电脑/赛博
  digitalImpressionTemplate, // 24 数字印象
  glitchTemplate,            // 25 故障風
  holoScopeTemplate,         // 26 全息
  popArtTemplate,            // 27 波普
  rulerTemplate,             // 28 几何
  silhouetteCleanTemplate,   // 29 剪影极简
];

export function getTemplate(name: string): TemplateConfig | undefined {
  if (!name) return undefined;
  if (name === 'auto') return cinemaTealTemplate;

  // 1. 精确匹配 name 或 nameKey
  const exact = templates.find(t => t.name === name || t.nameKey === name);
  if (exact) return exact;

  // 2. 忽略 tpl_ 前缀与大小写/符号匹配（防止空字符串误匹配）
  const clean = name.toLowerCase().replace(/^tpl_/, '').replace(/[^a-z0-9]/g, '');
  if (!clean) return undefined;
  return templates.find(t => {
    const tKey = (t.nameKey || '').toLowerCase().replace(/^tpl_/, '').replace(/[^a-z0-9]/g, '');
    const tName = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!tKey && !tName) return false; // 防止空字符串 includes() 误匹配
    return tKey === clean || tName === clean
      || (tKey && (tKey.includes(clean) || clean.includes(tKey)))
      || (tName && (tName.includes(clean) || clean.includes(tName)));
  });
}
