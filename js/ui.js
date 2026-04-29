import { utils } from './utils.js';

export const ui = {
  applyTranslations: () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = chrome.i18n.getMessage(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = chrome.i18n.getMessage(key);
    });
  },

  weekLabel: (offset) => {
    if (offset === 0) return chrome.i18n.getMessage('thisWeek');
    if (offset === -1) return chrome.i18n.getMessage('lastWeek');
    const { start, end } = utils.getWeekBounds(offset);
    const opts = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
  }
};
