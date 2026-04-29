// background.js — keeps the timer active even if the popup is closed

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timerTick') {
    // The timer continues running in chrome.storage, we just need the alarm to exist
    // so the service worker doesn't go to sleep during the count.
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startAlarm') {
    chrome.alarms.create('timerTick', { periodInMinutes: 1 }); // minimum 1 minute in MV3
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#c8f564' });
  }
  if (msg.action === 'stopAlarm') {
    chrome.alarms.clear('timerTick');
    chrome.action.setBadgeText({ text: '' });
  }
});

// En el inicio, verificar si hay un timer activo para restaurar el badge
chrome.storage.local.get('tt_state', (res) => {
  if (res.tt_state?.timer) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#c8f564' });
  }
});
