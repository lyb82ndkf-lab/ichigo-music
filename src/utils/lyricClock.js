// One animation clock per renderer window for all lyric word effects.
// Individual lyric rows subscribe to this clock instead of creating their
// own requestAnimationFrame loop.
const subscribers = new Set();
let frameId = 0;
let enabled = true;

const isDocumentHidden = () => typeof document !== 'undefined' && document.hidden;

const scheduleFrame = () => {
  if (enabled && subscribers.size > 0 && !frameId && !isDocumentHidden()) {
    frameId = window.requestAnimationFrame(frame);
  }
};

const frame = (now) => {
  if (!enabled || subscribers.size === 0 || isDocumentHidden()) {
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
  scheduleFrame();
  return () => subscribers.delete(callback);
}

export function setLyricClockEnabled(value) {
  enabled = value !== false;
  if (!enabled && frameId) {
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  } else if (enabled) scheduleFrame();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (!document.hidden) {
      scheduleFrame();
    }
  });
}
