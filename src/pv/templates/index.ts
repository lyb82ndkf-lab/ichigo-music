// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';
import { cinemaTealTemplate } from './cinemaTeal';
import { yozakuraTemplate } from './yozakura';
import { suisaiTemplate } from './suisai';
import { cityPopTemplate } from './cityPop';
import { rainCityTemplate } from './rainCity';
import { neonNightTemplate } from './neonNight';
import { monoTemplate } from './mono';
import { tasogareTemplate } from './tasogare';
import { shinkuuTemplate } from './shinkuu';
import { zasshiTemplate } from './zasshi';
import { lemonSodaTemplate } from './lemonSoda';
import { kiriTemplate } from './kiri';
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
import { evaAlertTemplate } from './evaAlert';
import { cyberpunk2077Template } from './cyberpunk2077';

export const templates: TemplateConfig[] = [
  cinemaTealTemplate,        // 0  青蓝电影
  yozakuraTemplate,          // 1  春日影 (秒速5厘米)
  sweetPinkTemplate,         // 2  少女云朵
  suisaiTemplate,            // 3  水彩
  cityPopTemplate,           // 4  都市蓝调
  rainCityTemplate,          // 5  黑客帝国
  neonNightTemplate,         // 6  ネオン夜
  monoTemplate,              // 7  白黒
  tasogareTemplate,          // 8  黄昏
  shinkuuTemplate,           // 9  深空 (Fly Me to the Moon)
  zasshiTemplate,            // 10 雑誌
  lemonSodaTemplate,         // 11 檸檬ソーダ
  kiriTemplate,              // 12 霧
  kawaiPixelTemplate,        // 13 Kawaii像素
  umiTemplate,               // 14 海 (深海波澜)
  filmTemplate,              // 15 フィルム
  p5Template,                // 16 P5 怪盗
  yorushikaTemplate,         // 17 夜色
  blueInkTemplate,           // 18 蓝色构成
  battleTemplate,            // 19 战场
  cyberTemplate,             // 20 电脑/赛博
  digitalImpressionTemplate, // 21 数字印象
  glitchTemplate,            // 22 故障風
  holoScopeTemplate,         // 23 全息
  popArtTemplate,            // 24 波普
  rulerTemplate,             // 25 几何
  silhouetteCleanTemplate,   // 26 剪影极简
  evaAlertTemplate,          // 27 EVA 警报
  cyberpunk2077Template,     // 28 赛博朋克 2077
];

export function getTemplate(name: string): TemplateConfig | undefined {
  if (!name) return undefined;
  if (name === 'auto') return cinemaTealTemplate;

  // 1. 精确匹配 name 或 nameKey
  const exact = templates.find(t => t.name === name || t.nameKey === name);
  if (exact) return exact;

  // 2. 清理前缀与特殊符号后的严格相等匹配
  const clean = name.toLowerCase().replace(/^tpl_/, '').replace(/[^a-z0-9]/g, '');
  if (!clean) return undefined;

  const exactClean = templates.find(t => {
    const tKey = (t.nameKey || '').toLowerCase().replace(/^tpl_/, '').replace(/[^a-z0-9]/g, '');
    const tName = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return tKey === clean || tName === clean;
  });
  if (exactClean) return exactClean;

  // 3. 别名与模糊匹配（按关键词长度降序，杜绝 'cyber' 劫持 'cyberpunk2077'）
  const sorted = [...templates].sort((a, b) => (b.nameKey?.length || 0) - (a.nameKey?.length || 0));
  return sorted.find(t => {
    const tKey = (t.nameKey || '').toLowerCase().replace(/^tpl_/, '').replace(/[^a-z0-9]/g, '');
    const tName = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!tKey && !tName) return false;
    return (tKey && tKey === clean) || (tName && tName === clean);
  });
}
