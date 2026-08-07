import React, { useMemo } from 'react';
import MonetWordSweep from './MonetWordSweep';
import { parseDisplayTokens } from './MonetLyricsEngine';

const SECTION_EFFECTS = ['brush', 'neon', 'split', 'underline', 'diagonal', 'starlight', 'crop', 'room', 'orbit', 'particles'];

function getSectionMap(lyrics) {
  if (!lyrics.length) return [];
  const sections = [0];
  let linesInSection = 1;
  for (let index = 1; index < lyrics.length; index += 1) {
    const previous = lyrics[index - 1];
    const current = lyrics[index];
    const previousEnd = Number(previous.time || 0) + Math.max(0, Number(previous.duration || 0));
    const gap = Number(current.time || 0) - previousEnd;
    const chorusChanged = Boolean(current.isChorus) !== Boolean(previous.isChorus);
    const marker = /\[(?:verse|chorus|bridge|intro|outro|主歌|副歌|间奏|前奏|尾奏)\]/i.test(String(current.text || ''));
    const shouldBreak = marker || chorusChanged || gap > 1.7 || linesInSection >= 6;
    if (shouldBreak) {
      sections.push(index);
      linesInSection = 1;
    } else {
      linesInSection += 1;
    }
  }
  return sections;
}

function getSectionIndex(starts, activeIndex) {
  let result = 0;
  for (let index = 0; index < starts.length; index += 1) {
    if (starts[index] > activeIndex) break;
    result = index;
  }
  return result;
}

function resolveEffect(effect, sectionIndex) {
  if (effect && effect !== 'auto' && SECTION_EFFECTS.includes(effect)) return effect;
  return SECTION_EFFECTS[sectionIndex % SECTION_EFFECTS.length];
}

function seeded(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function StageLine({ line, effect, fontPx, translationPx, fontStack, showTranslation, showGlow, glowIntensity }) {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const lineEnd = line.time + (line.duration || 5);
  return (
    <article className={`kashi-line kashi-line-${effect}`} key={`${line.time}-${effect}`}>
      <div className="kashi-ink-plate" aria-hidden="true" />
      <div className="kashi-divider" aria-hidden="true" />
      <div className="kashi-trace" aria-hidden="true" />
      <div className="kashi-orbit-lines" aria-hidden="true"><i /><i /></div>
      <div className="kashi-main" style={{ fontSize: `${fontPx}px`, fontFamily: fontStack }}>
        {tokens.map((token, index) => (
          <span className="kashi-token" key={token.key} style={{ '--token-delay': `${Math.min(index * 38, 620)}ms` }}>
            <MonetWordSweep token={token} fontPx={fontPx} fontStack={fontStack} isChorus={line.isChorus === true} lineRenderEndTime={lineEnd} status="active" showGlow={showGlow} glowIntensity={glowIntensity} animationStyle="spotlight" showBase />
          </span>
        ))}
      </div>
      {showTranslation && line.translation && <div className="kashi-translation" style={{ fontSize: `${translationPx}px`, fontFamily: fontStack }}>{line.translation}</div>}
    </article>
  );
}

export default function SpotlightLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 40, translationPx = 18, fontStack, showTranslation = true, showGlow = true, glowIntensity = 1, accentColor = 'var(--primary)', effect = 'auto', motion = 1 }) {
  const active = Math.max(0, Math.min(Math.max(0, lyrics.length - 1), activeLineIndex));
  const line = lyrics[active];
  const sectionStarts = useMemo(() => getSectionMap(lyrics), [lyrics]);
  const sectionIndex = getSectionIndex(sectionStarts, active);
  const activeEffect = resolveEffect(effect, sectionIndex);
  const stars = useMemo(() => Array.from({ length: 42 }, (_, index) => ({
    id: index,
    x: seeded(index + 11) * 100,
    y: seeded(index + 111) * 100,
    size: 1 + seeded(index + 211) * 2,
    delay: -(seeded(index + 311) * 4)
  })), []);

  if (!line) return <div className="kashi-stage" />;

  return (
    <div className={`kashi-stage kashi-section-${activeEffect}`} style={{ '--kashi-accent': accentColor, '--kashi-motion': Math.max(0.4, Math.min(1.6, Number(motion) || 1)) }}>
      <div className="kashi-stars" aria-hidden="true">{stars.map(star => <i key={star.id} style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.size}px`, height: `${star.size}px`, animationDelay: `${star.delay}s` }} />)}</div>
      <div className="kashi-room-grid" aria-hidden="true"><i /><i /><i /></div>
      <div className="kashi-stage-content">
        <StageLine line={line} effect={activeEffect} fontPx={Math.min(76, fontPx * 1.18)} translationPx={Math.min(30, translationPx * 1.08)} fontStack={fontStack} showTranslation={showTranslation} showGlow={showGlow} glowIntensity={glowIntensity} />
      </div>
      <style>{`
        .kashi-stage{position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;color:#fff;background:transparent}
        .kashi-stage-content{position:absolute;inset:0;display:flex;align-items:center;padding:clamp(20px,5vw,92px);box-sizing:border-box;z-index:3}
        .kashi-line{position:relative;width:min(92%,1050px);min-height:clamp(112px,22vh,260px);display:flex;flex-direction:column;justify-content:center;align-items:flex-start;isolation:isolate}
        .kashi-main{position:relative;z-index:2;max-width:100%;font-weight:760;line-height:1.16;letter-spacing:.012em;overflow-wrap:anywhere;word-break:normal;text-wrap:balance}
        .kashi-token{display:inline-block;animation:kashi-enter-left .5s cubic-bezier(.18,.86,.24,1) both;animation-delay:var(--token-delay)}
        .kashi-translation{position:relative;z-index:2;max-width:86%;margin-top:.48em;line-height:1.4;font-weight:500;color:rgba(255,255,255,.8);letter-spacing:.035em}
        .kashi-ink-plate,.kashi-divider,.kashi-trace,.kashi-orbit-lines{display:none;pointer-events:none}
        .kashi-stars{display:none;position:absolute;inset:0;z-index:1;pointer-events:none}.kashi-stars i{position:absolute;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 6px rgba(255,255,255,.82);animation:kashi-star-breathe 4s ease-in-out infinite alternate}
        .kashi-room-grid{display:none;position:absolute;inset:0;z-index:1;pointer-events:none;perspective:1000px}.kashi-room-grid i{position:absolute;inset:14% 16%;border:1px solid color-mix(in srgb,var(--kashi-accent) 28%,transparent);transform:rotateX(58deg) rotateZ(-24deg);opacity:.26}.kashi-room-grid i:nth-child(2){inset:28% 30%;transform:rotateX(58deg) rotateZ(-24deg) translateZ(50px)}.kashi-room-grid i:nth-child(3){inset:42% 44%;transform:rotateX(58deg) rotateZ(-24deg) translateZ(100px)}
        .kashi-section-brush .kashi-ink-plate{display:block;position:absolute;z-index:1;left:-1%;width:min(78%,880px);top:31%;bottom:24%;border-radius:8px 28px 11px 22px;background:linear-gradient(98deg,color-mix(in srgb,var(--kashi-accent) 18%,rgba(7,7,14,.72)),rgba(13,12,23,.36));box-shadow:inset 0 1px rgba(255,255,255,.08);clip-path:polygon(0 18%,97% 0,100% 78%,4% 100%);opacity:.72}
        .kashi-section-neon .kashi-main,.kashi-section-orbit .kashi-main{font-weight:820;color:transparent;-webkit-text-stroke:1.4px color-mix(in srgb,var(--kashi-accent) 82%,white);text-shadow:0 0 3px color-mix(in srgb,var(--kashi-accent) 80%,white),0 0 18px color-mix(in srgb,var(--kashi-accent) 44%,transparent)}.kashi-section-neon .monet-word-fill,.kashi-section-orbit .monet-word-fill{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke:1.4px color-mix(in srgb,var(--kashi-accent) 82%,white)}.kashi-section-neon .kashi-token,.kashi-section-orbit .kashi-token{animation-name:kashi-neon-pop}
        .kashi-section-split .kashi-main{max-width:72%;font-weight:420;letter-spacing:.075em}.kashi-section-split .kashi-divider{display:block;position:absolute;inset:10% auto 9% 44%;z-index:1;width:16%;background:rgba(5,5,12,.46);clip-path:polygon(24% 0,100% 0,76% 100%,0 100%)}.kashi-section-split .kashi-token:nth-child(odd){animation-name:kashi-enter-left}.kashi-section-split .kashi-token:nth-child(even){animation-name:kashi-enter-right}
        .kashi-section-underline .kashi-main{font-weight:430}.kashi-section-underline .kashi-trace{display:block;position:absolute;left:0;bottom:18%;z-index:1;width:min(88%,860px);height:2px;background:linear-gradient(90deg,transparent,var(--kashi-accent),rgba(255,255,255,.9),var(--kashi-accent),transparent);box-shadow:0 0 8px color-mix(in srgb,var(--kashi-accent) 72%,transparent);transform-origin:left;animation:kashi-trace .9s ease both}
        .kashi-section-diagonal .kashi-main{font-weight:780}.kashi-section-diagonal .kashi-divider{display:block;position:absolute;inset:18% -12%;z-index:1;background:linear-gradient(112deg,transparent 0 28%,rgba(7,7,14,.42) 28% 68%,transparent 68%);transform:skewY(-7deg)}.kashi-section-diagonal .kashi-token{animation-name:kashi-diagonal-in}
        .kashi-section-starlight .kashi-stars{display:block}.kashi-section-starlight .kashi-main{font-weight:400;text-shadow:0 0 1px #fff,0 0 8px rgba(255,255,255,.24)}.kashi-section-starlight .kashi-token{animation-name:kashi-fade-center}
        .kashi-section-crop .kashi-main{font-weight:430;-webkit-text-stroke:.7px color-mix(in srgb,var(--kashi-accent) 65%,white)}.kashi-section-crop .kashi-token:nth-child(odd){animation-name:kashi-enter-left}.kashi-section-crop .kashi-token:nth-child(even){animation-name:kashi-enter-right}
        .kashi-section-room .kashi-room-grid{display:block}.kashi-section-room .kashi-main{font-weight:430;-webkit-text-stroke:1px rgba(255,255,255,.74)}.kashi-section-room .kashi-token{animation-name:kashi-rise}
        .kashi-section-orbit .kashi-orbit-lines{display:block;position:absolute;inset:-35% -14%;z-index:1}.kashi-section-orbit .kashi-orbit-lines i{position:absolute;width:76%;height:30%;border:1.5px solid color-mix(in srgb,var(--kashi-accent) 88%,white);border-radius:50%;opacity:.45;filter:drop-shadow(0 0 3px var(--kashi-accent));animation:kashi-orbit calc(16s / var(--kashi-motion)) linear infinite}.kashi-section-orbit .kashi-orbit-lines i:first-child{left:4%;top:24%}.kashi-section-orbit .kashi-orbit-lines i:last-child{right:0;bottom:18%;animation-direction:reverse}
        .kashi-section-particles .kashi-main{font-weight:780;-webkit-text-stroke:1px rgba(255,255,255,.65)}.kashi-section-particles .kashi-token{animation-name:kashi-particle-in}
        @keyframes kashi-enter-left{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}@keyframes kashi-enter-right{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}@keyframes kashi-neon-pop{0%{opacity:0;transform:scale(.76) rotate(-2deg)}70%{opacity:1;transform:scale(1.04) rotate(.5deg)}100%{opacity:1;transform:none}}@keyframes kashi-diagonal-in{from{opacity:0;transform:translate(22px,-22px)}to{opacity:1;transform:none}}@keyframes kashi-fade-center{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}@keyframes kashi-rise{from{opacity:0;transform:translateY(25px)}to{opacity:1;transform:none}}@keyframes kashi-particle-in{from{opacity:0;transform:scale(.7) translateY(14px)}to{opacity:1;transform:none}}@keyframes kashi-trace{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}@keyframes kashi-star-breathe{from{opacity:.16;transform:scale(.74)}to{opacity:.82;transform:scale(1.18)}}@keyframes kashi-orbit{to{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){.kashi-token,.kashi-stars i,.kashi-orbit-lines i,.kashi-trace{animation:none!important}}
      `}</style>
    </div>
  );
}
