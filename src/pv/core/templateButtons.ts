// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

/**
 * templateButtons.ts
 *
 * Renders template choices as clickable <button> elements instead of a
 * <select> dropdown.  This is necessary for OBS browser-source users:
 * OBS's embedded Chromium does not forward pointer events to <select>
 * elements, so the dropdown is effectively unusable in the interaction
 * window.  Plain <button> elements work perfectly.
 *
 * Usage
 * -----
 * Call `initTemplateButtons(templateSelect, () => customTemplates)` once
 * after the DOM is ready.  The function inserts a button grid immediately
 * before the hidden <select> and keeps the two in sync automatically.
 *
 * When the custom-template list changes (add / delete / import) call
 * `rebuildTemplateButtons()` to regenerate the grid.
 */

import { templates } from '../templates';
import type { TemplateConfig } from './types';
import { t } from '../i18n';

function tplName(tpl: TemplateConfig): string {
  return tpl.nameKey ? t(tpl.nameKey as any) : tpl.name;
}

/**
 * Initialise the button grid.
 *
 * @param templateSelect      The hidden <select id="template-select"> element.
 * @param getCustomTemplates  Getter that returns the current custom-template array.
 */
export function initTemplateButtons(
  templateSelect: HTMLSelectElement,
  getCustomTemplates: () => TemplateConfig[],
): void {
  // Create the container and insert it before the <select>
  const container = document.createElement('div');
  container.id = 'template-buttons';
  templateSelect.parentElement!.insertBefore(container, templateSelect);

  function rebuild(): void {
    const custom = getCustomTemplates();
    container.innerHTML = [
      ...templates.map((tp, i) =>
        `<button class="tpl-btn" data-idx="${i}">${tplName(tp)}</button>`),
      ...custom.map((tp, i) =>
        `<button class="tpl-btn" data-idx="user-${i}">⭐ ${tp.name}</button>`),
      `<button class="tpl-btn" data-idx="custom">${t('custom')}</button>`,
    ].join('');
    syncActive();
  }

  function syncActive(): void {
    container.querySelectorAll<HTMLButtonElement>('.tpl-btn').forEach(btn => {
      btn.classList.toggle('tpl-btn-active', btn.dataset.idx === templateSelect.value);
    });
  }

  // Button click → drive the hidden <select> → fire its 'change' event
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tpl-btn');
    if (!btn) return;
    templateSelect.value = btn.dataset.idx!;
    templateSelect.dispatchEvent(new Event('change'));
  });

  // Keep highlight in sync whenever the select changes by any means
  templateSelect.addEventListener('change', syncActive);

  rebuild();

  // Expose rebuild so callers can refresh after custom-template mutations
  (container as any).__rebuild = rebuild;
}

/**
 * Rebuild the button grid (call after adding / deleting / importing a
 * custom template so the new entry appears immediately).
 */
export function rebuildTemplateButtons(): void {
  const container = document.getElementById('template-buttons');
  if (container && typeof (container as any).__rebuild === 'function') {
    (container as any).__rebuild();
  }
}
