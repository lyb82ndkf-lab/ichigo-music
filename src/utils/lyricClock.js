// One animation clock per renderer window for all lyric word effects.
// Individual lyric rows subscribe to this clock instead of creating their
// own requestAnimationFrame loop.
const subscribers = new Set();
let frameId = 0;
let enabled = true;

const frame = (now) => {
  if (!enabled || subscribers.size === 0) {
    frameId = 0;
    return;
  }
  for (const callback of subscribers) {
    try { callback(now); } catch (error) { console.warn('Lyric clock subscriber failed:', error); }
  }
  frameId = window.requestAnimationFrame(frame);
};

export function subscribeLyricClock(callback) {
  subscribers.add(callback);
  if (enabled && !frameId) frameId = window.requestAnimationFrame(frame);
  return () => subscribers.delete(callback);
}

export function setLyricClockEnabled(value) {
  enabled = value !== false;
  if (!enabled && frameId) {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  } else if (enabled && subscribers.size > 0 && !frameId) {
    frameId = window.requestAnimationFrame(frame);
  }
}
