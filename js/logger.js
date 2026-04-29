export const logger = {
  log: (message, data = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };
    console.log(`[TimeTracker] ${message}`, data || '');
    chrome.storage.local.get('tt_logs', (res) => {
      const logs = res.tt_logs || [];
      logs.push(logEntry);
      if (logs.length > 50) logs.shift();
      chrome.storage.local.set({ tt_logs: logs });
    });
  },
  error: (message, error = null) => {
    console.error(`[TimeTracker ERROR] ${message}`, error);
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      error: error?.message || error
    };
    chrome.storage.local.get('tt_logs', (res) => {
      const logs = res.tt_logs || [];
      logs.push(logEntry);
      if (logs.length > 50) logs.shift();
      chrome.storage.local.set({ tt_logs: logs });
    });
  }
};
