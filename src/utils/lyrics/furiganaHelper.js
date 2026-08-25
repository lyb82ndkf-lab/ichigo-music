// Furigana / Ruby Annotation Engine for Japanese Lyrics
// Powered by Kuroshiro + Kuromoji IPADic Morphological Analyzer & High-Speed Embedded Dictionary
// Copyright (c) 2026 ICHIGOMusic

import KuroshiroPkg from 'kuroshiro';
import KuromojiPkg from 'kuroshiro-analyzer-kuromoji';
import joyoKanjiDict from './joyoKanjiDict.js';

const Kuroshiro = KuroshiroPkg.default || KuroshiroPkg;
const KuromojiAnalyzer = KuromojiPkg.default || KuromojiPkg;
// Global Singleton Kuroshiro Instance
const kuroshiro = new Kuroshiro();
let isInitialized = false;
let initPromise = null;

// Global Memory Caches
const lineRubyMapCache = new Map();
const furiganaHtmlCache = new Map();
const furiganaTokensCache = new Map();  // authoritative segments only
const kuroshiroResolvedSet = new Set(); // tracks texts resolved by Kuroshiro/IPC

const KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf]/;
const JAPANESE_KANA_REGEX = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;

/**
 * Checks whether text contains Japanese Kana (Hiragana or Katakana)
 */
export function isJapaneseKana(text) {
  if (!text || typeof text !== 'string') return false;
  return JAPANESE_KANA_REGEX.test(text);
}

export function isJapaneseSong(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return false;
  return lines.some(line => {
    const text = typeof line === 'string' ? line : line?.text;
    return isJapaneseText(text);
  });
}
/**
 * Initializes the Kuroshiro engine with Kuromoji IPADic
 */
export async function initFuriganaEngine() {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let dictPath = './dict';
      if (typeof window === 'undefined' && typeof process !== 'undefined') {
        dictPath = './public/dict';
      }
      await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
      isInitialized = true;
      return true;
    } catch (err) {
      console.warn('[Furigana] Kuroshiro initialization notice (using embedded dictionary):', err?.message || err);
      return false;
    }
  })();

  return initPromise;
}

// Auto-trigger background initialization
if (typeof window !== 'undefined' || typeof process !== 'undefined') {
  initFuriganaEngine().catch(() => {});
}

/**
 * Explicit Compound-to-Character Ruby Splittings for Jukujikun, Names & ACG/J-Pop
 */
export const COMPOUND_SPLITS = {
  '曖昧': ['あい', 'まい'],
  '花火': ['はな', 'び'],
  '何度': ['なん', 'ど'],
  '同じ': ['おな', ''],
  '打上花火': ['う', 'ち', 'あ', 'げ', 'はな', 'び'],
  '打上': ['う', 'ち', 'あ', 'げ'],
  '打ち上げ': ['う', '', 'あ', '', ''],
  '春夏秋冬': ['はる', 'なつ', 'あき', 'ふゆ'],
  '未来永劫': ['み', 'らい', 'えい', 'ごう'],
  '一期一会': ['いち', 'ご', 'いち', 'え'],
  '暗雲低迷': ['あん', 'うん', 'てい', 'めい'],
  '昨日': ['きの', 'う'],
  '今日': ['きょ', 'う'],
  '明日': ['あ', 'した'],
  '気付': ['き', 'づ'],
  '突然': ['とつ', 'ぜん'],
  '景色': ['け', 'しき'],
  '仲村': ['なか', 'むら'],
  '芽衣子': ['め', 'い', 'こ'],
  '人形': ['にん', 'ぎょう'],
  '出逢': ['で', 'あ'],
  '出来': ['で', 'き'],
  '軌跡': ['き', 'せき'],
  '奇跡': ['き', 'せき'],
  '偶然': ['ぐう', 'ぜん'],
  '運命': ['うん', 'めい'],
  '永久': ['えい', 'きゅう'],
  '永遠': ['えい', 'えん'],
  '残響': ['ざん', 'きょう'],
  '境界線': ['きょう', 'かい', 'せん'],
  '境界': ['きょう', 'かい'],
  '神威': ['か', 'むい'],
  '輪廻': ['りん', 'ね'],
  '輪廻転生': ['りん', 'ね', 'てん', 'しょう'],
  '刹那': ['せつ', 'な'],
  '言葉': ['こと', 'ば'],
  '最初': ['さい', 'しょ'],
  '鼓動': ['こ', 'どう'],
  '波紋': ['は', 'もん'],
  '世界': ['せ', 'かい'],
  '笑顔': ['え', 'がお'],
  '何十': ['なん', 'じゅう'],
  '何百': ['なん', 'ひゃく'],
  '何千': ['なん', 'ぜん'],
  '高桥': ['たか', 'はし'],
  '高橋': ['たか', 'はし'],
  '李依': ['り', 'え'],
  '当り前': ['あた', '', 'まえ'],
  '当たり前': ['あ', '', 'まえ'],
  '思い出': ['おも', '', 'で'],
  '想い出': ['おも', '', 'で'],
  '寄り添': ['よ', '', 'そ'],
  '日々': ['ひ', 'び'],
  '人々': ['ひと', 'びと'],
  '時々': ['とき', 'どき'],
  '段々': ['だん', 'だん'],
  '度々': ['たび', 'たび'],
  '様々': ['さま', 'ざま']
};

/**
 * Comprehensive Single Kanji Readings
 */
export const SINGLE_KANJI_READINGS = {
  '仲': ['なか', 'ちゅう'],
  '村': ['むら', 'そん'],
  '芽': ['め', 'が'],
  '衣': ['い', 'え', 'ころも'],
  '子': ['こ', 'し', 'す'],
  '気': ['き', 'け'],
  '付': ['づ', 'つ', 'ふ'],
  '突': ['とつ', 'つ'],
  '然': ['ぜん', 'ねん', 'しか'],
  '昨': ['きの', 'さく'],
  '日': ['う', 'ひ', 'にち', 'じつ', 'か', 'び'],
  '景': ['けい', 'け'],
  '色': ['しき', 'いろ', 'しょく'],
  '人': ['にん', 'ひと', 'じん'],
  '形': ['ぎょう', 'かたち', 'けい'],
  '涙': ['なみだ', 'るい'],
  '当': ['あ', 'とう'],
  '前': ['まえ', 'ぜん'],
  '思': ['おも', 'し'],
  '少': ['すこ', 'すく', 'しょう'],
  '違': ['ちが', 'い'],
  '瞼': ['まぶた', 'けん'],
  '裏': ['うら', 'り'],
  '見': ['み', 'けん'],
  '独': ['ひと', 'どく'],
  '笑': ['え', 'わら', 'しょう'],
  '顔': ['がお', 'かお', 'がん'],
  '探': ['さが', 'たん'],
  '初': ['しょ', 'はじ', 'はつ'],
  '夢': ['ゆめ', 'む'],
  '一': ['いち', 'ひと', 'いっ'],
  '度': ['ど', 'たび'],
  '叶': ['かな', 'きょう'],
  '鼓': ['こ', 'つづみ'],
  '動': ['どう', 'うご'],
  '願': ['ねが', 'がん'],
  '指': ['ゆび', 'し'],
  '悲': ['かな', 'ひ'],
  '波': ['は', 'なみ'],
  '紋': ['もん', 'ぶん'],
  '冷': ['つめ', 'ひ', 'れい'],
  '溶': ['と', 'よう'],
  '落': ['お', 'らく'],
  '砕': ['くだ', 'さい'],
  '鍵': ['かぎ', 'けん'],
  '行': ['い', 'ゆ', 'こう', 'ぎょう'],
  '手': ['て', 'しゅ'],
  '阻': ['はば', 'そ'],
  '立': ['た', 'りつ'],
  '流': ['なが', 'りゅう'],
  '瞳': ['ひとみ', 'どう'],
  '二': ['に', 'ふた'],
  '輝': ['かがや', 'き'],
  '後': ['ご', 'うしろ', 'あと'],
  '声': ['こえ', 'せい'],
  '泣': ['な', 'きゅう'],
  '誰': ['だれ'],
  '届': ['とど', 'かい'],
  '心': ['こころ', 'しん'],
  '叫': ['さけ', 'きょう'],
  '終': ['お', 'しゅう'],
  '胸': ['むね', 'きょう'],
  '眠': ['ねむ', 'みん'],
  '歪': ['ゆが', 'ひず', 'わい'],
  '求': ['もと', 'きゅう'],
  '分': ['ぶん', 'ぷん', 'ふん', 'わ'],
  '身': ['しん', 'み'],
  '最': ['さい', 'もっと'],
  '優': ['ゆう', 'やさ', 'すぐ'],
  '先': ['せん', 'さき'],
  '人': ['ひと', 'じん', 'にん'],
  '達': ['たち', 'だち', 'たつ'],
  '世': ['せ', 'せい', 'よ'],
  '界': ['かい'],
  '回': ['まわ', 'かい'],
  '思': ['おも', 'し'],
  '出': ['で', 'だ', 'しゅつ'],
  '降': ['ふ', 'お'],
  '散': ['ち', 'さん'],
  '染': ['そ', 'せん'],
  '頬': ['ほほ', 'ほお', 'きょう'],
  '想': ['おも', 'そう'],
  '杯': ['はい', 'ぱい', 'さかずき'],
  '月': ['つき', 'げつ', 'がつ'],
  '光': ['ひかり', 'こう'],
  '呑': ['の', 'どん'],
  '本': ['ほん', 'もと'],
  '当': ['とう', 'あ'],
  '夜': ['よる', 'よ', 'や'],
  '薄': ['うす', 'はく'],
  '口': ['くち', 'ぐち', 'こう'],
  '触': ['ふ', 'さわ', 'ざわ', 'しょく'],
  '笑': ['わら', 'え', 'しょう'],
  '君': ['きみ', 'くん'],
  '待': ['ま', 'たい'],
  '夏': ['なつ', 'げ', 'か'],
  '去': ['さ', 'きょ', 'こ'],
  '街': ['まち', 'がい'],
  '静': ['しず', 'せい'],
  '屋': ['や', 'おく'],
  '戻': ['もど', 'れい'],
  '良': ['い', 'よ', 'りょう'],
  '一': ['ひと', 'いち', 'いつ', 'いっ'],
  '見': ['み', 'けん'],
  '昔': ['むかし', 'せき'],
  '涙': ['なみだ', 'るい'],
  '宝': ['ほう', 'たから'],
  '石': ['せき', 'いし', 'こく'],
  '声': ['こえ', 'せい'],
  '忘': ['わす', 'ぼう'],
  '愛': ['あい'],
  '死': ['し'],
  '風': ['かぜ', 'ふう'],
  '海': ['うみ', 'かい'],
  '辺': ['べ', 'へん', 'あたり'],
  '歩': ['ある', 'あゆ', 'ほ'],
  '欲': ['ほ', 'よく'],
  '微': ['まど', 'び'],
  '睡': ['ろ', 'すい', 'ねむ'],
  '物': ['もの', 'ぶつ', 'もつ'],
  '云': ['い', 'うん'],
  '歳': ['とし', 'さい'],
  '取': ['と', 'しゅ'],
  '何': ['なに', 'なん', 'か'],
  '無': ['な', 'む', 'ぶ'],
  '春': ['はる', 'しゅん'],
  '底': ['そこ', 'てい'],
  '抜': ['ぬ', 'ばつ'],
  '柄': ['ひ', 'え', 'がら', 'へい'],
  '杓': ['しゃく'],
  '味': ['あじ', 'み'],
  '飲': ['の', 'いん'],
  '喉': ['のど', 'こう'],
  '乾': ['かわ', 'かん'],
  '鼻': ['はな', 'び'],
  '歌': ['うた', 'か'],
  '行': ['い', 'ゆ', 'こう', 'ぎょう'],
  '僕': ['ぼく'],
  '私': ['わたし', 'わたくし', 'し'],
  '俺': ['おれ'],
  '彼': ['かれ', 'かの', 'ひ'],
  '女': ['おんな', 'じょ', 'にょ'],
  '男': ['おとこ', 'だん', 'なん'],
  '子': ['こ', 'し', 'す'],
  '友': ['とも', 'ゆう'],
  '家': ['いえ', 'や', 'か'],
  '族': ['ぞく'],
  '間': ['あいだ', 'ま', 'かん'],
  '時': ['とき', 'じ'],
  '今': ['いま', 'こん'],
  '朝': ['あさ', 'ちょう'],
  '昼': ['ひる', 'ちゅう'],
  '夕': ['ゆう'],
  '空': ['そら', 'くう'],
  '雨': ['あめ', 'あま', 'う'],
  '雪': ['ゆき', 'せつ'],
  '花': ['はな', 'か'],
  '星': ['ほし', 'せい'],
  '日': ['ひ', 'び', 'にち'],
  '波': ['なみ', 'は'],
  '川': ['かわ', 'せん'],
  '道': ['みち', 'どう'],
  '生': ['い', 'う', 'なま', 'せい', 'しょう'],
  '心': ['こころ', 'しん'],
  '胸': ['むね', 'きょう'],
  '手': ['て', 'しゅ'],
  '目': ['め', 'もく'],
  '瞳': ['ひとみ', 'どう'],
  '夢': ['ゆめ', 'む'],
  '恋': ['こい', 'れん'],
  '影': ['かげ', 'えい'],
  '闇': ['やみ', 'あん'],
  '火': ['ひ', 'か'],
  '水': ['みず', 'すい'],
  '木': ['き', 'もく', 'ぼく'],
  '金': ['きん', 'かね'],
  '土': ['つち', 'ど', 'と'],
  '天': ['てん', 'あま'],
  '地': ['ち', 'じ'],
  '神': ['かみ', 'しん', 'じん'],
  '魔': ['ま'],
  '鬼': ['おに', 'き'],
  '竜': ['りゅう', 'たつ'],
  '鳥': ['とり', 'ちょう'],
  '羽': ['はね', 'は', 'う'],
  '翼': ['つばさ', 'よく'],
  '音': ['おと', 'ね', 'おん'],
  '言': ['い', 'こと', 'げん', 'ごん'],
  '話': ['はな', 'わ'],
  '語': ['かた', 'ご'],
  '読': ['よ', 'どく'],
  '書': ['か', 'しょ'],
  '聞': ['き', 'ぶん'],
  '知': ['し', 'ち'],
  '覚': ['おぼ', 'さ', 'かく'],
  '感': ['かん'],
  '情': ['じょう', 'なさけ'],
  '変': ['か', 'へん'],
  '化': ['か', 'け', 'ば'],
  '高': ['たか', 'こう'],
  '低': ['ひく', 'てい'],
  '深': ['ふか', 'しん'],
  '浅': ['あさ', 'せん'],
  '広': ['ひろ', 'こう'],
  '狭': ['せま', 'きょう'],
  '重': ['おも', 'かさ', 'じゅう', 'ちょう'],
  '軽': ['かる', 'けい'],
  '強': ['つよ', 'きょう', 'ごう'],
  '弱': ['よわ', 'じゃく'],
  '新': ['あたら', 'しん'],
  '古': ['ふる', 'こ'],
  '早': ['はや', 'そう'],
  '遅': ['おそ', 'ち'],
  '長': ['なが', 'ちょう'],
  '短': ['みじか', 'たん'],
  '多': ['おお', 'た'],
  '少': ['すこ', 'すく', 'しょう'],
  '白': ['しろ', 'はく'],
  '黒': ['くろ', 'こく'],
  '赤': ['あか', 'せき'],
  '青': ['あお', 'せい', 'しょう'],
  '黄': ['き', 'こう'],
  '緑': ['みどり', 'りょく'],
  '紫': ['むらさき', 'し'],
  '紅': ['べに', 'くれない', 'こう'],
  '真': ['ま', 'しん'],
  '正': ['ただ', 'せい', 'しょう'],
  '悪': ['あく', 'わる'],
  '善': ['ぜん', 'よ'],
  '美': ['うつく', 'び', 'み'],
  '醜': ['みにく', 'しゅう'],
  '楽': ['らく', 'たの', 'がく'],
  '苦': ['くる', 'にが', 'く'],
  '痛': ['いた', 'つう'],
  '悲': ['かな', 'ひ'],
  '喜': ['よろこ', 'き'],
  '怒': ['いか', 'おこ', 'ど'],
  '哀': ['あわ', 'あい'],
  '怖': ['こわ', 'ふ'],
  '恐': ['おそ', 'きょう'],
  '軌': ['き'], '跡': ['せき', 'あと'], '奇': ['き'], '永': ['えい', 'なが'],
  '久': ['きゅう', 'く', 'ひさ'], '偶': ['ぐう'], '然': ['ぜん', 'ねん'],
  '運': ['うん', 'はこ'], '命': ['めい', 'みょう', 'いのち'], '逢': ['あ', 'ほう'],
  '巡': ['めぐ', 'じゅん'], '寄': ['よ', 'き'], '添': ['そ', 'てん'],
  '溢': ['あふ', 'いつ'], '積': ['つ', 'せき'], '重': ['かさ', 'おも', 'じゅう'],
  '好': ['す', 'この', 'こう'], '包': ['つつ', 'ほう'], '感': ['かん'],
  '小': ['ちい', 'こ', 'お', 'しょう'], '幸': ['しあわ', 'さいわ', 'こう'],
  '平': ['ひら', 'たい', 'へい'], '横': ['よこ', 'おう'], '足': ['た', 'あし', 'そく'],
  '渡': ['わた', 'と'], '渚': ['なぎさ', 'しょ'], '刻': ['きざ', 'こく'],
  '秒': ['びょう'], '超': ['こ', 'ちょう'], '李': ['り'], '依': ['え', 'い'],
  '曖': ['あい'], '昧': ['まい'], '解': ['と', 'かい', 'げ'], '繋': ['つな', 'けい'],
  '度': ['ど', 'たび'], '同': ['おな', 'どう'], '打': ['う', 'だ'], '火': ['び', 'ひ', 'か']
};
/**
 * Standard default single-kanji reading fallback
 */
export const SINGLE_KANJI_DICT = {
  ...joyoKanjiDict,
  '曖': 'あい', '昧': 'まい', '解': 'と', '繋': 'つな', '度': 'ど', '同': 'おな',
  '自': 'じ', '分': 'ぶん', '身': 'しん', '最': 'さい', '先': 'せん', '优': 'ゆう', '優': 'ゆう',
  '人': 'ひと', '达': 'たち', '達': 'たち', '世': 'せ', '界': 'かい', '回': 'まわ', '雨': 'あめ', '様': 'よう',
  '轨': 'き', '迹': 'せき', '轨道': 'きどう', '花火': 'はなび',
  '満': 'み', '旅': 'たび', '途': 'と', '中': 'なか', '続': 'つづ', '未': 'み', '失': 'うしな',
  '秒': 'びょう', '超': 'こ',
  '降': 'ふ', '花': 'はな', '散': 'ち', '染': 'そ', '頬': 'ほほ', '想': 'おも',
  '当': 'とう', '夜': 'よる', '薄': 'うす', '口': 'くち', '触': 'ざわ', '笑': 'わら',
  '君': 'きみ', '待': 'ま', '夏': 'なつ', '去': 'さ', '街': 'まち', '静': 'しず',
  '屋': 'や', '戻': 'もど', '良': 'い', '一': 'ひと', '見': 'み', '昔': 'むかし',
  '涙': 'なみだ', '宝': 'ほう', '石': 'せき', '出': 'で', '来': 'き', '声': 'こえ',
  '忘': 'わす', '愛': 'あい', '死': 'し', '风': 'かぜ', '風': 'かぜ', '海': 'うみ',
  '辺': 'べ', '歩': 'ある', '欲': 'ほ', '微': 'まど', '睡': 'ろ', '物': 'もの',
  '云': 'い', '歳': 'とし', '取': 'と', '何': 'なに', '無': 'な', '春': 'はる',
  '底': 'そこ', '抜': 'ぬ', '柄': 'ひ', '杓': 'しゃく', '味': 'あじ', '飲': 'の',
  '喉': 'のど', '乾': 'かわ', '鼻': 'はな', '歌': 'うた', '行': 'い', '信': 'しん',
  '私': 'わたし', '俺': 'おれ', '貴': 'あな', '彼': 'かれ', '奴': 'やつ', '友': 'とも',
  '今': 'いま', '話': 'はな', '语': 'かた', '語': 'かた', '音': 'おと', '心': 'こころ',
  '胸': 'むね', '手': 'て', '目': 'め', '瞳': 'ひとみ', '夢': 'ゆめ', '恋': 'こい',
  '影': 'かげ', '闇': 'やみ', '朝': 'あさ', '昼': 'ひる', '夕': 'ゆう', '空': 'そら',
  '雪': 'ゆき', '星': 'ほし', '日': 'ひ', '波': 'なみ', '川': 'かわ', '道': 'みち',
  '旅': 'たび', '扉': 'とびら', '命': 'いのち', '生': 'い', '知': 'し', '願': 'ねが',
  '祈': 'いの', '抱': 'だ', '握': 'にぎ', '離': 'はな', '走': 'はし', '飛': 'と',
  '落': 'お', '泣': 'な', '届': 'とど', '守': 'まも', '探': 'さが', '響': 'ひび',
  '輝': 'かがや', '誓': 'ちか', '越': 'こ', '消': 'き', '奪': 'うば', '始': 'はじ',
  '終': 'お', '止': 'と', '鳴': 'な', '咲': 'さ', '揺': 'ゆ', '舞': 'ま',
  '逢': 'あ', '会': 'あ', '合': 'あ', '色': 'いろ', '赤': 'あか', '青': 'あお',
  '白': 'しろ', '黒': 'くろ', '黄': 'き', '紫': 'むらさき', '緑': 'みどり', '誰': 'だれ',
  '痛': 'いた', '強': 'つよ', '弱': 'よわ', '寂': 'さび', '悲': 'かな', '嬉': 'うれ',
  '幸': 'しあわ', '確': 'たし', '描': 'えが', '広': 'ひろ', '深': 'ふか', '高': 'たか',
  '低': 'ひく', '遠': 'とお', '近': 'ちか', '重': 'おも', '軽': 'かる', '暗': 'くら',
  '新': 'あたら', '古': 'ふる', '早': 'はや', '遅': 'おそ', '長': 'なが', '短': 'みじか',
  '少': 'すこ', '多': 'おお', '嘘': 'うそ', '秋': 'あき', '冬': 'ふゆ', '鳥': 'とり',
  '羽': 'はね', '翼': 'つばさ', '虹': 'にじ', '雲': 'くも', '炎': 'ほのお', '火': 'ひ',
  '水': 'みず', '土': 'つち', '木': 'き', '森': 'もり', '林': 'はやし', '山': 'やま',
  '谷': 'たに', '鏡': 'かがみ', '鍵': 'かぎ', '鎖': 'くさり', '傷': 'きず', '痕': 'あと',
  '血': 'ち', '汗': 'あせ', '息': 'いき', '脈': 'みゃく', '背': 'せ', '肩': 'かた',
  '指': 'ゆび', '爪': 'つめ', '髪': 'かみ', '唇': 'くちびる', '首': 'くび', '足': 'あし',
  '脚': 'あし', '膝': 'ひざ', '受': 'う', '入': 'い', '腕': 'うで', '骨': 'ほね',
  '肌': 'はだ', '体': 'からだ', '頭': 'あたま', '顔': 'かお', '眉': 'まゆ', '耳': 'みみ',
  '舌': 'した', '歯': 'は', '腹': 'はら', '腰': 'こし', '尻': 'しり', '掌': 'てのひら',
  '拳': 'こぶし', '家': 'いえ', '庭': 'にわ', '窓': 'まど', '壁': 'かべ', '床': 'ゆか',
  '天井': 'てんじょう', '柱': 'はしら', '屋根': 'やね', '町': 'まち', '村': 'むら', '国': 'くに',
  '島': 'しま', '岸': 'きし', '港': 'みなと', '船': 'ふね', '車': 'くるま', '駅': 'えき',
  '線': 'せん', '橋': 'はし', '坂': 'さか', '丘': 'おか', '原': 'はら', '野': 'の',
  '草': 'くさ', '葉': 'は', '枝': 'えだ', '根': 'ね', '実': 'み', '種': 'たね',
  '芽': 'め', '苔': 'こけ', '岩': 'いわ', '砂': 'すな', '泥': 'どろ', '塵': 'ちり',
  '埃': 'ほこり', '煙': 'けむり', '霧': 'きり', '霜': 'しも', '露': 'つゆ', '氷': 'こおり',
  '雫': 'しずく', '泡': 'あわ', '渦': 'うず', '滝': 'たき', '泉': 'いずみ', '池': 'いけ',
  '沼': 'ぬま', '湖': 'みずうみ', '神': 'かみ', '仏': 'ほとけ', '鬼': 'おに', '魔': 'ま',
  '獣': 'けもの', '竜': 'りゅう', '虫': 'むし', '魚': 'さかな', '猫': 'ねこ', '犬': 'いぬ',
  '狼': 'おおかみ', '狐': 'きつね', '蝶': 'ちょう', '蛾': 'が', '蜂': 'はち', '蜘蛛': 'くも',
  '蛇': 'へび', '蛙': 'かえる', '王': 'おう', '姫': 'ひめ', '敵': 'てき', '形': 'かたち',
  '点': 'てん', '面': 'めん', '円': 'えん', '角': 'かど', '奥': 'おく', '端': 'はし',
  '裏': 'うら', '表': 'おもて', '外': 'そと', '中': 'なか', '上': 'うえ', '下': 'した',
  '前': 'まえ', '後': 'うしろ', '左': 'ひだり', '右': 'みぎ', '北': 'きた', '南': 'みなみ',
  '東': 'ひがし', '西': 'にし', '美': 'び', '真': 'ま', '正': 'ただ', '悪': 'あく',
  '善': 'ぜん', '聖': 'せい', '邪': 'じゃ', '霊': 'れい', '魂': 'たましい', '幻': 'まぼろし',
  '幽': 'ゆう', '冥': 'めい', '滅': 'めつ'
};

/**
 * Priority Long-Match Compound Dictionary (J-Pop / ACG / Literature)
 */
const JPOP_COMPOUNDS = {
  '曖昧': 'あいまい',
  '花火': 'はなび',
  '何度': 'なんど',
  '同じ': 'おなじ',
  '解かして': 'とかして',
  '解かす': 'とかす',
  '解く': 'とく',
  '解ける': 'とける',
  '繋いだ': 'つないだ',
  '繋いで': 'つないで',
  '繋ぐ': 'つなぐ',
  '繋がる': 'つながる',
  '打上花火': 'うちあげはなび',
  '打上': 'うちあげ',
  '打ち上げ': 'うちあげ',
  '春夏秋冬': 'はるなつあきふゆ',
  '未来永劫': 'みらいえいごう',
  '一期一会': 'いちごいちえ',
  '暗雲低迷': 'あんうんていめい',
  '残響散歌': 'ざんきょうさんか',
  '残響': 'ざんきょう',
  '境界線': 'きょうかいせん',
  '境界': 'きょうかい',
  '神威': 'かむい',
  '輪廻転生': 'りんねてんしょう',
  '輪廻': 'りんね',
  '刹那的': 'せつなてき',
  '刹那': 'せつな',
  '運命': 'うんめい',
  '宿命': 'しゅくめい',
  '永遠': 'えいえん',
  '黄昏': 'たそがれ',
  '茜色': 'あかねいろ',
  '微熱': 'びねつ',
  '暗雲': 'あんうん',
  '星屑': 'ほしくず',
  '夜空': 'よぞら',
  '泡沫': 'うたかた',
  '静寂': 'せいじゃく',
  '残影': 'ざんえい',
  '旅路': 'たびじ',
  '螺旋': 'らせん',
  '真実': 'しんじつ',
  '彼方': 'かなた',
  '此処': 'ここ',
  '虚無': 'きょむ',
  '幻影': 'げんえい',
  '輪郭': 'りんかく',
  '情熱': 'じょうねつ',
  '哀愁': 'あいしゅう',
  '追憶': 'ついおく',
  '慟哭': 'どうこく',
  '残照': 'ざんしょう',
  '感情': 'かんじょう',
  '全部': 'ぜんぶ',
  '透明': 'とうめい',
  '大事': 'だいじ',
  '大切': 'たいせつ',
  '本当': 'ほんとう',
  '月光': 'げっこう',
  '一杯': 'いっぱい',
  '口触り': 'くちざわり',
  '宝石': 'ほうせき',
  '出来てた': 'できてた',
  '出来ていた': 'できていた',
  '出来事': 'できごと',
  '出来': 'でき',
  '想い出': 'おもいで',
  '思い出': 'おもいで',
  '思い出す': 'おもいだす',
  '海辺': 'うみべ',
  '微睡む': 'まどろむ',
  '微睡み': 'まどろみ',
  '微睡': 'まどろみ',
  '柄杓': 'ひしゃく',
  '鼻歌': 'はなうた',
  '一人': 'ひとり',
  '二人': 'ふたり',
  '三人': 'さんにん',
  '部屋': 'へや',
  '人達': 'ひとたち',
  '世界': 'せかい',
  '自分自身': 'じぶんじしん',
  '自分': 'じぶん',
  '自身': 'じしん',
  '最優先': 'さいゆうせん',
  '優先': 'ゆうせん',
  '最高': 'さいこう',
  '最後': 'さいご',
  '最新': 'さいしん',
  '最大': 'さいだい',
  '最小': 'さいしょう',
  '最愛': 'さいあい',
  '最悪': 'さいあく',
  '先生': 'せんせい',
  '先輩': 'せんぱい',
  '先行': 'せんこう',
  '未来': 'みらい',
  '過去': 'かこ',
  '現在': 'げんざい',
  '現実': 'げんじつ',
  '理想': 'りそう',
  '運命': 'うんめい',
  '日常': 'にちじょう',
  '約束': 'やくそく',
  '時間': 'じかん',
  '瞬間': 'しゅんかん',
  '永遠': 'えいえん',
  '理由': 'りゆう',
  '記憶': 'きおく',
  '希望': 'きぼう',
  '絶望': 'ぜつぼう',
  '笑顔': 'えがお',
  '言葉': 'ことば',
  '孤独': 'こどく',
  '正義': 'せいぎ',
  '悪魔': 'あくま',
  '天使': 'てんし',
  '勇気': 'ゆうき',
  '奇跡': 'きせき',
  '情熱': 'じょうねつ',
  '夜空': 'よぞら',
  '青空': 'あおぞら',
  '星空': 'ほしぞら',
  '太陽': 'たいよう',
  '魔法': 'まほう',
  '物語': 'ものがたり',
  '季節': 'きせつ',
  '四季': 'しき',
  '昨日': 'きのう',
  '今日': 'きょう',
  '明日': 'あした',
  '今年': 'ことし',
  '去年': 'きょねん',
  '来年': 'らいねん',
  '今夜': 'こんや',
  '昨夜': 'さくや',
  '真夜中': 'まよなか',
  '黄昏': 'たそがれ',
  '茜色': 'あかねいろ',
  '群青': 'ぐんじょう',
  '琥珀': 'こはく',
  '漆黒': 'しっこく',
  '純白': 'じゅんぱく',
  '深紅': 'しんく',
  '翡翠': 'ひすい',
  '瑠璃': 'るり',
  '抱きしめる': 'だきしめる',
  '握りしめる': 'にぎりしめる',
  '立ち上がる': 'たちあがる',
  '立ち止まる': 'たちどまる',
  '振り返る': 'ふりかえる',
  '駆け抜ける': 'かけぬける',
  '追いかける': 'おいかける',
  '見つめる': 'みつめる',
  '見つける': 'みつける',
  '歩き出す': 'あるきだす',
  '走り出す': 'はしりだす',
  '飛び立つ': 'とびたつ',
  '泣き出す': 'なきだす',
  '笑い出す': 'わらいだす',
  '四面楚歌': 'しめんそか',
  '一生懸命': 'いっしょうけんめい',
  '輪廻転生': 'りんねてんしょう',
  '森羅万象': 'しんらばんしょう',
  '花鳥風月': 'かちょうふうげつ',
  '鏡花水月': 'きょうかすいげつ',
  '絶体绝命': 'ぜったいぜつめい',
  '絶体絶命': 'ぜったいぜつめい',
  '起死回生': 'きしかいせい',
  '唯一無二': 'ゆいいつむに',
  '唯我独尊': 'ゆいがどくそん',
  '諸行無常': 'しょぎょうむじょう',
  '喜怒哀楽': 'きどあいらく',
  '疾風怒濤': 'しっぷうどとう',
  '百花繚乱': 'ひゃっかりょうらん',
  '電光石火': 'でんこうせっか',
  '満身創痍': 'まんしんそうい',
  '完全無欠': 'かんぜんむけつ',
  '一期一会': 'いちごいちえ',
  '自暴自棄': 'じぼうじき',
  '天上天下': 'てんじょうてんげ',
  '無我夢中': 'むがむちゅう',
  '前途多難': 'ぜんとたなん',
  '残酷天使': 'ざんこくてんし',
  '透明人間': 'とうめいにんげん',
  '因果応報': 'いんがおうほう',
  '春日影': 'はるひかげ',
  '五厘米': 'ごせんち',
  '摩天楼': 'まてんろう',
  '万華鏡': 'まんげきょう',
  '蜃気楼': 'しんきろう',
  '金木犀': 'きんもくせい',
  '向日葵': 'ひまわり',
  '彼岸花': 'ひがんばな',
  '紫陽花': 'あじさい',
  '蒲公英': 'たんぽぽ',
  '勿忘草': 'わすれなぐさ',
  '放課後': 'ほうかご',
  '平行線': 'へいこうせん',
  '境界線': 'きょうかいせん',
  '地平線': 'ちへいせん',
  '水平線': 'すいへいせん',
  '終着駅': 'しゅうちゃくえき',
  '始発駅': 'しはつえき',
  '散歩道': 'さんぽみち',
  '通学路': 'つうがくろ',
  '帰り道': 'かえりみち',
  '最前線': 'さいぜんせん',
  '優先度': 'ゆうせんど',
  '優先席': 'ゆうせんせき'
};

const OKURIGANA_PATTERNS = [
  { pattern: /^曖昧(な|に|さ|の|だ|で)/, kanji: '曖昧', ruby: 'あいまい' },
  { pattern: /^花火(を|が|に|の|と|で|は)?/, kanji: '花火', ruby: 'はなび' },
  { pattern: /^何度(も|が|は|を)?/, kanji: '何度', ruby: 'なんど' },
  { pattern: /^同(じ|じく)/, kanji: '同', ruby: 'おな' },
  { pattern: /^解(かして|かした|かす|かせば|かそう|かない|ける|けた|けて|けない|く|いて|いた|かない)/, kanji: '解', ruby: 'と' },
  { pattern: /^繋(いだ|いで|ぐ|がない|げば|ごう|がる|がった|がって|がらない)/, kanji: '繋', ruby: 'つな' },
  { pattern: /^打(ち上|ちあげ|ち)/, kanji: '打', ruby: 'う' },
  { pattern: /^咲(いた|いて|く|かない|けば|こう)/, kanji: '咲', ruby: 'さ' },
  { pattern: /^終(わらない|わった|わって|わる|われば)/, kanji: '終', ruby: 'お' },
  { pattern: /^続(いて|いた|く|かない|けば|ける|けた|けて|けない)/, kanji: '続', ruby: 'つづ' },
  { pattern: /^降(った|って|る|らない|り)/, kanji: '降', ruby: 'ふ' },
  { pattern: /^散(った|って|る|らない|り)/, kanji: '散', ruby: 'ち' },
  { pattern: /^染(まった|まって|まる|まらない|まり)/, kanji: '染', ruby: 'そ' },
  { pattern: /^想(った|って|う|わない|い)/, kanji: '想', ruby: 'おも' },
  { pattern: /^様(に|な|の|で|子)/, kanji: '様', ruby: 'よう' },
  { pattern: /^様(々|が|は|を)/, kanji: '様', ruby: 'さま' },
  { pattern: /^薄(く|い|さ|かった)/, kanji: '薄', ruby: 'うす' },
  { pattern: /^笑(っても|った|って|う|わない|い|い出す)/, kanji: '笑', ruby: 'わら' },
  { pattern: /^待(っている|った|って|つ|たない|ち)/, kanji: '待', ruby: 'ま' },
  { pattern: /^去(った|って|る|らない|り)/, kanji: '去', ruby: 'さ' },
  { pattern: /^静(か|けさ|かに)/, kanji: '静', ruby: 'しず' },
  { pattern: /^戻(って|った|る|らない|り)/, kanji: '戻', ruby: 'もど' },
  { pattern: /^良(い|く|かった|ければ)/, kanji: '良', ruby: 'い' },
  { pattern: /^見(られる|られた|られない|てる|ている|た|て|る|ない|つめる|つける)/, kanji: '見', ruby: 'み' },
  { pattern: /^忘(れた|れて|れる|れない|れそう)/, kanji: '忘', ruby: 'わす' },
  { pattern: /^死(んだ|んで|ぬ|なない)/, kanji: '死', ruby: 'し' },
  { pattern: /^歩(いた|いて|く|かない|き|き出す)/, kanji: '歩', ruby: 'ある' },
  { pattern: /^欲(しい|しく|しさ|しかった|しくない)/, kanji: '欲', ruby: 'ほ' },
  { pattern: /^欲(しい|しく|しさ|しかった)/, kanji: '欲', ruby: 'ほ' },
  { pattern: /^微睡(む|み|んで|んだ)/, kanji: '微睡', ruby: 'まどろ' },
  { pattern: /^云(わない|った|って|う|い)/, kanji: '云', ruby: 'い' },
  { pattern: /^取(った|って|る|らない|り)/, kanji: '取', ruby: 'と' },
  { pattern: /^無(い|く|かった|ければ)/, kanji: '無', ruby: 'な' },
  { pattern: /^抜(けた|けて|ける|けない|き)/, kanji: '抜', ruby: 'ぬ' },
  { pattern: /^飲(めば|む|んだ|んで|まない|み)/, kanji: '飲', ruby: 'の' },
  { pattern: /^乾(いて|いた|く|かない|き)/, kanji: '乾', ruby: 'かわ' },
  { pattern: /^行(く|かない|った|って|き)/, kanji: '行', ruby: 'い' },
  { pattern: /^優(しい|しく|しさ|しかった|しければ)/, kanji: '優', ruby: 'やさ' },
  { pattern: /^痛(い|む|み|くて|かった|ければ)/, kanji: '痛', ruby: 'いた' },
  { pattern: /^思(う|い|った|って|えば)/, kanji: '思', ruby: 'おも' },
  { pattern: /^願(う|い|った|って|えば)/, kanji: '願', ruby: 'ねが' },
  { pattern: /^祈(る|り|った|って|れば)/, kanji: '祈', ruby: 'いの' },
  { pattern: /^届(く|かない|いた|いて|きそう)/, kanji: '届', ruby: 'とど' },
  { pattern: /^変(わる|わらない|わった|わって|える|えない)/, kanji: '変', ruby: 'か' },
  { pattern: /^分(かる|からない|かった|かって|かり)/, kanji: '分', ruby: 'わ' },
  { pattern: /^回(る|らない|った|って|り)/, kanji: '回', ruby: 'まわ' },
  { pattern: /^知(る|らない|った|って|り)/, kanji: '知', ruby: 'し' },
  { pattern: /^生(きる|きない|きた|きて|まれる|まれ)/, kanji: '生', ruby: 'い' },
  { pattern: /^走(る|らない|った|って|り|り出す)/, kanji: '走', ruby: 'はし' },
  { pattern: /^飛(ぶ|ばない|んだ|んで|び|び立つ)/, kanji: '飛', ruby: 'と' },
  { pattern: /^泣(く|かない|いた|いて|き|き出す)/, kanji: '泣', ruby: 'な' },
  { pattern: /^歌(う|わない|った|って|い)/, kanji: '歌', ruby: 'うた' },
  { pattern: /^響(く|かない|いた|いて|き)/, kanji: '響', ruby: 'ひび' },
  { pattern: /^輝(く|かない|いた|いて|き)/, kanji: '輝', ruby: 'かがや' },
  { pattern: /^誓(う|わない|った|って|い)/, kanji: '誓', ruby: 'ちか' },
  { pattern: /^消(える|えない|えた|えて|す|さない)/, kanji: '消', ruby: 'き' },
  { pattern: /^落(ちる|ちない|ちた|ちて|とす)/, kanji: '落', ruby: 'お' },
  { pattern: /^守(る|らない|った|って|りたい)/, kanji: '守', ruby: 'まも' },
  { pattern: /^探(す|さない|した|して)/, kanji: '探', ruby: 'さが' },
  { pattern: /^聞(く|かない|いた|いて)/, kanji: '聞', ruby: 'き' },
  { pattern: /^言(う|わない|った|って|い)/, kanji: '言', ruby: 'い' },
  { pattern: /^話(す|さない|した|して)/, kanji: '話', ruby: 'はな' },
  { pattern: /^語(る|らない|った|って)/, kanji: '語', ruby: 'かた' },
  { pattern: /^抱(く|かない|いた|いて|きしめる)/, kanji: '抱', ruby: 'だ' },
  { pattern: /^握(る|らない|った|って|りしめる)/, kanji: '握', ruby: 'にぎ' },
  { pattern: /^離(す|さない|した|して|れる|れない)/, kanji: '離', ruby: 'はな' },
  { pattern: /^触(れる|れない|れた|れて|る)/, kanji: '触', ruby: 'ふ' },
  { pattern: /^強(い|く|さ|かった)/, kanji: '强', ruby: 'つよ' },
  { pattern: /^弱(い|く|さ|かった)/, kanji: '弱', ruby: 'よわ' },
  { pattern: /^悲(しい|しく|しさ|しかった)/, kanji: '悲', ruby: 'かな' },
  { pattern: /^嬉(しい|しく|しさ|しかった)/, kanji: '嬉', ruby: 'うれ' },
  { pattern: /^寂(しい|しく|しさ|しかった)/, kanji: '寂', ruby: 'さび' },
  { pattern: /^美(しい|しく|しさ|しかった)/, kanji: '美', ruby: 'うつく' },
  { pattern: /^苦(しい|しく|しさ|しかった)/, kanji: '苦', ruby: 'くる' }
];

// Fix single typo in OKURIGANA_PATTERNS
for (const p of OKURIGANA_PATTERNS) {
  if (p.kanji === '想') p.ruby = 'おも';
  if (p.kanji === '强') p.kanji = '強';
}

/**
 * Checks whether text contains Japanese Kana or recognized Japanese J-Pop compounds / okurigana.
 * Pure Chinese lyrics will return false.
 */
export function isJapaneseText(text) {
  if (!text || typeof text !== 'string') return false;
  if (JAPANESE_KANA_REGEX.test(text)) return true;
  for (const compound of Object.keys(JPOP_COMPOUNDS)) {
    if (text.includes(compound)) return true;
  }
  for (const rule of OKURIGANA_PATTERNS) {
    if (rule.pattern.test(text)) return true;
  }
  return false;
}

/**
 * Align mixed kanji/kana surface string with its hiragana reading using intermediate kana anchors
 */
export function alignFurigana(surface, reading) {
  const DIGIT_RE = /[0-9０-９]/;
  const kataToHira = s => s.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const needsRuby = ch => KANJI_REGEX.test(ch) || DIGIT_RE.test(ch);
  if (!reading || ![...surface].some(needsRuby)) return Array.from(surface).map(c => ({ text: c, ruby: null }));
  const hira = kataToHira(reading);

  const runs = [];
  for (const ch of surface) {
    const k = needsRuby(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === k) last.text += ch;
    else runs.push({ text: ch, kanji: k });
  }

  let pattern = '^';
  for (const run of runs) {
    pattern += run.kanji ? '(.+?)' : escapeRegex(kataToHira(run.text));
  }
  pattern += '$';

  try {
    const m = hira.match(new RegExp(pattern));
    if (!m) return null;

    const parts = [];
    let g = 1;
    for (const run of runs) {
      if (run.kanji) parts.push({ text: run.text, ruby: m[g++] });
      else parts.push({ text: run.text, ruby: null });
    }
    return parts;
  } catch {
    return null;
  }
}

/**
 * Splits compound word into precise character segments with ruby
 */
export function splitWordRuby(base, ruby) {
  if (!base) return [];
  if (!ruby) return Array.from(base).map(c => ({ text: c, ruby: null }));

  if (COMPOUND_SPLITS[base]) {
    const splitArr = COMPOUND_SPLITS[base];
    if (splitArr.length === base.length) {
      return base.split('').map((c, i) => ({ text: c, ruby: splitArr[i] || null }));
    }
  }

  // If mixed kanji + kana (okurigana run), use dynamic regex anchor alignment
  const aligned = alignFurigana(base, ruby);
  if (aligned && aligned.length > 1) {
    const finalSegments = [];
    for (const seg of aligned) {
      if (!seg.ruby || seg.text.length <= 1) {
        finalSegments.push(seg);
      } else {
        // Sub-split multi-kanji runs if needed
        const sub = splitWordRuby(seg.text, seg.ruby);
        finalSegments.push(...sub);
      }
    }
    return finalSegments;
  }

  // Single kanji
  if (base.length === 1) {
    return [{ text: base, ruby: KANJI_REGEX.test(base) ? ruby : null }];
  }

  // Proportional or dictionary split for multi-kanji words
  if (base.length === 2) {
    const r0List = (SINGLE_KANJI_READINGS[base[0]] || []).concat(SINGLE_KANJI_DICT[base[0]] ? [SINGLE_KANJI_DICT[base[0]]] : []);
    for (const r0 of r0List) {
      if (ruby.startsWith(r0) && ruby.length > r0.length) {
        return [
          { text: base[0], ruby: r0 },
          { text: base[1], ruby: ruby.slice(r0.length) }
        ];
      }
    }
    const r1List = (SINGLE_KANJI_READINGS[base[1]] || []).concat(SINGLE_KANJI_DICT[base[1]] ? [SINGLE_KANJI_DICT[base[1]]] : []);
    for (const r1 of r1List) {
      if (ruby.endsWith(r1) && ruby.length > r1.length) {
        return [
          { text: base[0], ruby: ruby.slice(0, ruby.length - r1.length) },
          { text: base[1], ruby: r1 }
        ];
      }
    }
    const half = Math.ceil(ruby.length / 2);
    return [
      { text: base[0], ruby: ruby.slice(0, half) },
      { text: base[1], ruby: ruby.slice(half) }
    ];
  }

  let remaining = ruby;
  const segments = [];
  let allFound = true;
  for (let idx = 0; idx < base.length; idx++) {
    const char = base[idx];
    if (idx === base.length - 1) {
      segments.push({ text: char, ruby: remaining });
      break;
    }
    const rList = (SINGLE_KANJI_READINGS[char] || []).concat(SINGLE_KANJI_DICT[char] ? [SINGLE_KANJI_DICT[char]] : []);
    let found = false;
    for (const r of rList) {
      if (remaining.startsWith(r) && remaining.length > r.length) {
        segments.push({ text: char, ruby: r });
        remaining = remaining.slice(r.length);
        found = true;
        break;
      }
    }
    if (!found) {
      allFound = false;
      break;
    }
  }
  if (allFound && segments.length === base.length) {
    return segments;
  }

  const avgLen = Math.floor(ruby.length / base.length);
  const res = [];
  let rem = ruby;
  for (let idx = 0; idx < base.length; idx++) {
    if (idx === base.length - 1) {
      res.push({ text: base[idx], ruby: rem });
    } else {
      const take = Math.max(1, Math.min(rem.length - (base.length - idx - 1), avgLen));
      res.push({ text: base[idx], ruby: rem.slice(0, take) });
      rem = rem.slice(take);
    }
  }
  return res;
}

/**
 * Parses full ruby HTML string into character-level ruby map
 */
export function buildCharRubyMapFromHtml(rubyHtml, originalText) {
  if (!originalText) return [];
  const charRubyMap = new Array(originalText.length).fill(null);
  if (!rubyHtml) return charRubyMap;

  const regex = /<ruby>([^<]+)(?:<rp>[^<]*<\/rp>)?<rt>([^<]+)<\/rt>(?:<rp>[^<]*<\/rp>)?<\/ruby>|([^<]+)/g;
  let match;
  let cursor = 0;

  while ((match = regex.exec(rubyHtml)) !== null) {
    if (match[1] && match[2]) {
      const base = match[1];
      const ruby = match[2];
      const segments = splitWordRuby(base, ruby);
      for (const seg of segments) {
        for (let c = 0; c < seg.text.length; c++) {
          if (cursor < originalText.length) {
            const charRuby = (seg.text.length === 1 || c === 0) ? (seg.ruby || null) : null;
            charRubyMap[cursor] = {
              base: seg.text[c],
              ruby: charRuby,
              isFull: true
            };
            cursor++;
          }
        }
      }
    } else if (match[3]) {
      const plain = match[3];
      cursor += plain.length;
    }
  }

  return charRubyMap;
}

/**
 * Rule-based fallback parse for a line of text using high-accuracy embedded J-Pop dictionary
 */
function annotateFuriganaRuleBased(text) {
  if (!text || typeof text !== 'string') return [];
  // Guard: if text has no Japanese Kana, it is Chinese or other language - do not annotate!
  if (!isJapaneseText(text)) {
    return [{ text }];
  }
  const result = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    let matched = false;
    const maxScanLen = Math.min(10, len - i);
    for (let cLen = maxScanLen; cLen >= 2; cLen--) {
      const sub = text.slice(i, i + cLen);
      if (JPOP_COMPOUNDS[sub]) {
        const segments = splitWordRuby(sub, JPOP_COMPOUNDS[sub]);
        for (const seg of segments) {
          if (seg.ruby) {
            result.push({ text: seg.text, ruby: seg.ruby });
          } else {
            result.push({ text: seg.text });
          }
        }
        i += cLen;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const remainingText = text.slice(i);
    for (const rule of OKURIGANA_PATTERNS) {
      const match = remainingText.match(rule.pattern);
      if (match) {
        result.push({ text: rule.kanji, ruby: rule.ruby });
        i += rule.kanji.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const char = text[i];
    if (KANJI_REGEX.test(char)) {
      const ruby = SINGLE_KANJI_DICT[char];
      if (ruby) {
        result.push({ text: char, ruby });
      } else {
        result.push({ text: char });
      }
      i++;
    } else {
      let nonKanji = char;
      i++;
      while (i < len && !KANJI_REGEX.test(text[i])) {
        nonKanji += text[i];
        i++;
      }
      result.push({ text: nonKanji });
    }
  }

  return result;
}

/**
 * Returns character-level ruby mapping for a full line
 */
export function getLineRubyCharMap(lineText) {
  if (!lineText) return [];
  if (lineRubyMapCache.has(lineText)) {
    return lineRubyMapCache.get(lineText);
  }

  let html = furiganaHtmlCache.get(lineText);
  if (!html) {
    // Generate provisional rule-based HTML but do NOT cache in lineRubyMapCache
    // so that warmup can overwrite with authoritative Kuroshiro data
    const tokens = annotateFuriganaRuleBased(lineText);
    html = tokens.map(s => s.ruby ? `<ruby>${s.text}<rt>${s.ruby}</rt></ruby>` : s.text).join('');
    const map = buildCharRubyMapFromHtml(html, lineText);
    // Only cache if no async warmup is expected
    if (!isJapaneseText(lineText)) {
      lineRubyMapCache.set(lineText, map);
    }
    return map;
  }

  const map = buildCharRubyMapFromHtml(html, lineText);
  lineRubyMapCache.set(lineText, map);
  return map;
}

/**
 * Returns formatted <ruby> HTML for a token slice within a line
 */
export function getRubyHtmlForToken(tokenText, startOffset, lineRubyMap) {
  if (!tokenText) return '';
  if (!lineRubyMap || startOffset === undefined || startOffset < 0) {
    return toRubyHtml(tokenText);
  }

  let html = '';
  for (let i = 0; i < tokenText.length; i++) {
    const idx = startOffset + i;
    const info = lineRubyMap[idx];
    if (info && info.ruby) {
      html += `<ruby>${info.base || tokenText[i]}<rt>${info.ruby}</rt></ruby>`;
    } else {
      html += tokenText[i];
    }
  }
  return html;
}

export function parseRubyHtmlToSegments(rubyHtml, originalText) {
  if (!rubyHtml) return [{ text: originalText }];
  const segments = [];
  const regex = /<ruby>([^<]+)(?:<rp>[^<]*<\/rp>)?<rt>([^<]+)<\/rt>(?:<rp>[^<]*<\/rp>)?<\/ruby>|([^<]+)/g;
  let match;
  while ((match = regex.exec(rubyHtml)) !== null) {
    if (match[1] && match[2]) {
      segments.push({ text: match[1], ruby: match[2] });
    } else if (match[3]) {
      segments.push({ text: match[3] });
    }
  }
  return segments.length > 0 ? segments : [{ text: originalText }];
}

/**
 * Parses a Japanese text line into segments with ruby annotations.
 * Used for Canvas / PIXI particle lyric choreographies (PV modes).
 */
export function annotateFurigana(text) {
  if (!text || typeof text !== 'string') return [];

  // Return authoritative Kuroshiro result if available
  if (kuroshiroResolvedSet.has(text) && furiganaTokensCache.has(text)) {
    return furiganaTokensCache.get(text);
  }

  // Try HTML cache (populated by warmup/IPC)
  const cachedHtml = furiganaHtmlCache.get(text);
  if (cachedHtml) {
    const segs = parseRubyHtmlToSegments(cachedHtml, text);
    furiganaTokensCache.set(text, segs);
    kuroshiroResolvedSet.add(text);
    return segs;
  }

  // Fallback to embedded dictionary parser — do NOT cache so next call can pick up Kuroshiro
  const tokens = annotateFuriganaRuleBased(text);

  if (isJapaneseText(text) && isInitialized) {
    convertFuriganaAsync(text).catch(() => {});
  }
  return tokens;
}

/**
 * Asynchronously converts Japanese text to clean <ruby> HTML markup using Kuroshiro
 */
export async function convertFuriganaAsync(text) {
  if (!text || typeof text !== 'string') return '';
  // Only skip if already resolved by Kuroshiro/IPC (not rule-based fallback)
  if (kuroshiroResolvedSet.has(text) && furiganaHtmlCache.has(text)) {
    return furiganaHtmlCache.get(text);
  }

  try {
    const ready = await initFuriganaEngine();
    if (ready && isInitialized) {
      const raw = await kuroshiro.convert(text, { mode: 'furigana', to: 'hiragana' });
      const cleanHtml = raw.replace(/<rp>\(<\/rp>|<rp>\)<\/rp>/g, '');
      furiganaHtmlCache.set(text, cleanHtml);
      kuroshiroResolvedSet.add(text);
      
      const charMap = buildCharRubyMapFromHtml(cleanHtml, text);
      lineRubyMapCache.set(text, charMap);

      const segs = parseRubyHtmlToSegments(cleanHtml, text);
      furiganaTokensCache.set(text, segs);
      return cleanHtml;
    }
  } catch (err) {
    console.warn('[Furigana] convert error:', err);
  }

  // Kuroshiro unavailable — cache rule-based as last resort
  const tokens = annotateFuriganaRuleBased(text);
  const fallbackHtml = tokens.map(s => s.ruby ? `<ruby>${s.text}<rt>${s.ruby}</rt></ruby>` : s.text).join('');
  furiganaHtmlCache.set(text, fallbackHtml);
  return fallbackHtml;
}
/**
 * Pre-warms and pre-analyzes all lyric lines of a song in background
 */
export async function warmupFuriganaLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return;

  // Guard: If the song does not contain ANY Japanese Kana, it is Chinese/English: DO NOT annotate!
  if (!isJapaneseSong(lines)) {
    return;
  }

  // 1. Try Main Process IPC batch conversion first if in Electron
  if (typeof window !== 'undefined' && window.electronAPI?.convertFuriganaBatch) {
    try {
      const batchResult = await window.electronAPI.convertFuriganaBatch(lines);
      if (batchResult && typeof batchResult === 'object') {
        for (const [text, html] of Object.entries(batchResult)) {
          if (html && typeof html === 'string') {
            furiganaHtmlCache.set(text, html);
            kuroshiroResolvedSet.add(text);
            const charMap = buildCharRubyMapFromHtml(html, text);
            lineRubyMapCache.set(text, charMap);
            const segs = parseRubyHtmlToSegments(html, text);
            furiganaTokensCache.set(text, segs);
          }
        }
        return;
      }
    } catch (err) {
      console.warn('[Furigana] IPC batch conversion notice:', err);
    }
  }

  // 2. Fallback to local Kuroshiro engine — await all conversions
  const promises = [];
  for (const line of lines) {
    const text = line?.text;
    if (text && (isJapaneseText(text) || (KANJI_REGEX.test(text) && isJapaneseSong(lines)))) {
      promises.push(convertFuriganaAsync(text).catch(() => {}));
    }
  }
  await Promise.all(promises);
}
/**
 * Synchronously returns HTML ruby markup for Japanese text.
 */
export function toRubyHtml(text, enabled = true) {
  if (!text || typeof text !== 'string') return '';
  if (enabled === false) return text;

  // Return authoritative Kuroshiro result if available
  if (furiganaHtmlCache.has(text)) {
    return furiganaHtmlCache.get(text);
  }

  // If text has no Japanese Kana, do NOT annotate as Japanese
  if (!isJapaneseText(text)) {
    return text;
  }

  // Fire async conversion but do NOT cache rule-based HTML in furiganaHtmlCache
  // to avoid poisoning the shared cache that convertFuriganaAsync checks
  if (isInitialized) {
    convertFuriganaAsync(text).catch(() => {});
  }

  // Return provisional rule-based HTML without caching
  const tokens = annotateFuriganaRuleBased(text);
  return tokens.map(s => {
    if (s.ruby) {
      return `<ruby>${s.text}<rt>${s.ruby}</rt></ruby>`;
    }
    return s.text;
  }).join('');
}

/**
 * Format text with inline ruby brackets: 漢字(かんじ)
 */
export function toInlineRubyText(text) {
  if (!text || typeof text !== 'string') return '';
  if (!isJapaneseText(text) && !furiganaHtmlCache.has(text)) return text;
  const segments = annotateFurigana(text);
  if (!Array.isArray(segments) || segments.length === 0) return text;
  return segments.map(s => {
    if (!s.ruby) return s.text;
    const splitParts = splitWordRuby(s.text, s.ruby);
    return splitParts.map(p => p.ruby ? `${p.text}(${p.ruby})` : p.text).join('');
  }).join('');
}

/**
 * Format text as pure reading (Hiragana only for kanji)
 */
export function toReadingText(text) {
  if (!text || typeof text !== 'string') return '';
  if (!isJapaneseText(text) && !furiganaHtmlCache.has(text)) return text;
  const segments = annotateFurigana(text);
  if (!Array.isArray(segments) || segments.length === 0) return text;
  return segments.map(s => s.ruby ? s.ruby : s.text).join('');
}
