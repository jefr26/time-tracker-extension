// background.js — keeps the timer active even if the popup is closed

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timerTick') {
    // The timer continues running in chrome.storage, we just need the alarm to exist
    // so the service worker doesn't go to sleep during the count.
  }
});

function updateBadgeFromState(timerActive) {
  if (timerActive) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#c8f564' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startAlarm') {
    chrome.alarms.create('timerTick', { periodInMinutes: 1 }); // minimum 1 minute in MV3
    updateBadgeFromState(true);
  }
  if (msg.action === 'stopAlarm') {
    chrome.alarms.clear('timerTick');
    updateBadgeFromState(false);
  }
});

// En el inicio, verificar si hay un timer activo para restaurar el badge
chrome.storage.local.get('tt_state', (res) => {
  updateBadgeFromState(!!res.tt_state?.timer);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.tt_state) {
    updateBadgeFromState(!!changes.tt_state.newValue?.timer);
  }
});
