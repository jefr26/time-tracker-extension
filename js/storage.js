import { logger } from './logger.js';

export const storage = {
  load: (cb) => {
    chrome.storage.local.get('tt_state', (res) => {
      let state = res.tt_state;
      if (!state || typeof state !== 'object') {
        state = { projects: ['General'], entries: [], timer: null };
      }
      
      state.entries = Array.isArray(state.entries) ? state.entries : [];
      
      if (state.entries.length > 1000) {
        logger.log('Truncating entries to 1000 for performance');
        state.entries = state.entries.slice(0, 1000);
      }
      
      cb(state);
    });
  },
  save: (state, cb) => {
    chrome.storage.local.set({ tt_state: state }, () => {
      if (chrome.runtime.lastError) {
        logger.error('Error saving state', chrome.runtime.lastError);
      } else {
        if (cb) cb();
      }
    });
  }
};
