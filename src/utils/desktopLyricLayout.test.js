import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDesktopLyricLayout } from './desktopLyricLayout.js';

function outerGaps(layout) {
  const previousBottom = layout.previousOffset + layout.nonActiveVisualHeight / 2;
  const activeTop = layout.activeOffset - layout.activeBlockHeight / 2;
  const activeBottom = layout.activeOffset + layout.activeBlockHeight / 2;
  const nextTop = layout.nextOffset - layout.nonActiveVisualHeight / 2;
  return {
    top: activeTop - previousBottom,
    bottom: nextTop - activeBottom
  };
}

test('keeps three-line spacing balanced when the active line has a translation', () => {
  const layout = calculateDesktopLyricLayout({
    fontSize: 36,
    translationSize: 22,
    hasTranslation: true
  });
  const gaps = outerGaps(layout);

  assert.equal(gaps.top, gaps.bottom);
  assert.equal(gaps.top, layout.outerLineGap);
});

test('keeps three-line spacing balanced without a translation', () => {
  const layout = calculateDesktopLyricLayout({
    fontSize: 36,
    translationSize: 22,
    hasTranslation: false
  });
  const gaps = outerGaps(layout);

  assert.equal(gaps.top, gaps.bottom);
  assert.equal(gaps.top, layout.outerLineGap);
});
