// background.js — keeps the timer active even if the popup is closed

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'timerTick') {
    // The timer continues running in chrome.storage, we just need the alarm to exist
    // so the service worker doesn't go to sleep during the count.
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startAlarm') {
    chrome.alarms.create('timerTick', { periodInMinutes: 1 / 60 }); // every ~1 sec
  }
  if (msg.action === 'stopAlarm') {
    chrome.alarms.clear('timerTick');
  }
});
