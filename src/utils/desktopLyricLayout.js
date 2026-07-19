export function calculateDesktopLyricLayout({ fontSize = 36, translationSize = 22, hasTranslation = false }) {
  const mainLineHeight = Math.ceil(fontSize * 1.12);
  const translationLineHeight = Math.ceil(translationSize * 1.06);
  const activeBlockHeight = mainLineHeight + (hasTranslation ? translationLineHeight + 2 : 0);
  const nonActiveVisualHeight = Math.ceil(mainLineHeight * 0.62);
  const outerLineGap = Math.max(11, Math.ceil(fontSize * 0.30));
  const neighborDistance = activeBlockHeight / 2 + outerLineGap + nonActiveVisualHeight / 2;

  return {
    mainLineHeight,
    translationLineHeight,
    activeBlockHeight,
    nonActiveVisualHeight,
    outerLineGap,
    lyricSlotHeight: Math.ceil(activeBlockHeight + outerLineGap * 2 + nonActiveVisualHeight),
    activeOffset: 0,
    previousOffset: -neighborDistance,
    nextOffset: neighborDistance,
    getLineOffset(relativeIndex) {
      if (relativeIndex === 0) return 0;
      return relativeIndex < 0 ? -neighborDistance : neighborDistance;
    }
  };
}
