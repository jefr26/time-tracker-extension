// popup.js — Time Tracker Extension

let state = { projects: ['General'], entries: [], timer: null };
let timerInterval = null;
let currentWeekOffset = 0;

// ---- Storage ----
function loadState(cb) {
  chrome.storage.local.get('tt_state', (res) => {
    if (res.tt_state) state = res.tt_state;
    cb();
  });
}

function save(cb) {
  chrome.storage.local.set({ tt_state: state }, cb);
}

// ---- Week helpers ----
function getWeekBounds(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function isInWeek(ts, offset = 0) {
  const { start, end } = getWeekBounds(offset);
  return ts >= start.getTime() && ts <= end.getTime();
}

function weekLabel(offset) {
  if (offset === 0) return chrome.i18n.getMessage('thisWeek');
  if (offset === -1) return chrome.i18n.getMessage('lastWeek');
  const { start, end } = getWeekBounds(offset);
  const opts = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

// ---- Format ----
function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
}

function fmtHM(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${String(m).padStart(2,'0')}m`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// ---- Timer ----
function toggleTimer() {
  if (state.timer) { stopTimer(); } else { startTimer(); }
}

function startTimer() {
  const task = document.getElementById('taskInput').value.trim();
  const project = document.getElementById('projectSelect').value;
  if (!task) { document.getElementById('taskInput').focus(); return; }

  state.timer = { task, project, start: Date.now() };
  save(() => {
    chrome.runtime.sendMessage({ action: 'startAlarm' });
    updateTimerUI();
    document.getElementById('taskInput').value = '';
    startTimerTick();
  });
}

function stopTimer() {
  if (!state.timer) return;
  clearInterval(timerInterval);
  timerInterval = null;

  const duration = Date.now() - state.timer.start;
  if (duration > 5000) {
    addEntryToState(state.timer.task, state.timer.project, state.timer.start, Date.now(), duration);
  }

  state.timer = null;
  save(() => {
    chrome.runtime.sendMessage({ action: 'stopAlarm' });
    updateTimerUI();
    render();
  });
}

function addEntryToState(task, project, start, end, duration) {
  state.entries.unshift({
    id: Date.now(),
    task,
    project,
    start,
    end,
    duration
  });
}

function addManualEntry() {
  const task = document.getElementById('taskInput').value.trim();
  const project = document.getElementById('projectSelect').value;
  const timeStr = document.getElementById('manualTime').value.trim();

  if (!task) {
    document.getElementById('taskInput').focus();
    return;
  }

  if (!timeStr) {
    document.getElementById('manualTime').focus();
    return;
  }

  // Parse time (H:MM or just MM)
  let ms = 0;
  if (timeStr.includes(':')) {
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return;
    ms = (h * 3600 + m * 60) * 1000;
  } else {
    const m = Number(timeStr);
    if (isNaN(m)) return;
    ms = m * 60 * 1000;
  }

  if (ms <= 0) return;

  const now = Date.now();
  addEntryToState(task, project, now - ms, now, ms);

  document.getElementById('taskInput').value = '';
  document.getElementById('manualTime').value = '';

  save(() => {
    render();
  });
}

function startTimerTick() {
  clearInterval(timerInterval);
  timerInterval = setInterval(updateElapsed, 1000);
  updateElapsed();
}

function updateElapsed() {
  if (!state.timer) return;
  const elapsed = Date.now() - state.timer.start;
  document.getElementById('timerElapsed').textContent = fmtDuration(elapsed);
}

function updateTimerUI() {
  const running = !!state.timer;
  const btn = document.getElementById('btnStart');
  const timerEl = document.getElementById('activeTimer');

  btn.textContent = running ? '■' : '▶';
  btn.classList.toggle('running', running);
  timerEl.classList.toggle('visible', running);

  if (running) {
    document.getElementById('timerTask').textContent = state.timer.task;
    document.getElementById('timerProject').textContent = state.timer.project;
  }
}

// ---- Week nav ----
function changeWeek(dir) {
  currentWeekOffset += dir;
  if (currentWeekOffset > 0) currentWeekOffset = 0;
  const label = document.getElementById('weekRange');
  if (label) label.textContent = weekLabel(currentWeekOffset);
  render();
}

// ---- Projects ----
function renderProjects() {
  const sel = document.getElementById('projectSelect');
  const list = document.getElementById('projectsList');

  sel.innerHTML = state.projects.map(p => `<option value="${p}">${p}</option>`).join('');

  list.innerHTML = state.projects.map(p => `
    <div class="project-tag">
      ${p}
      ${state.projects.length > 1
        ? `<button class="btn-remove-project" data-project="${p.replace(/"/g, '&quot;')}">×</button>`
        : ''}
    </div>
  `).join('');

  list.querySelectorAll('.btn-remove-project').forEach(btn => {
    btn.addEventListener('click', () => removeProject(btn.dataset.project));
  });
}

function addProject() {
  const input = document.getElementById('projectInput');
  const name = input.value.trim();
  if (!name || state.projects.includes(name)) return;
  state.projects.push(name);
  input.value = '';
  save(() => renderProjects());
}

function removeProject(name) {
  if (state.projects.length <= 1) return;
  state.projects = state.projects.filter(p => p !== name);
  save(() => renderProjects());
}

// ---- Weekly summary ----
function renderWeeklySummary() {
  const weekEntries = state.entries.filter(e => isInWeek(e.start, currentWeekOffset));

  const groups = {};
  weekEntries.forEach(e => {
    const key = `${e.project}||${e.task}`;
    if (!groups[key]) groups[key] = { project: e.project, task: e.task, total: 0 };
    groups[key].total += e.duration;
  });

  const rows = Object.values(groups).sort((a, b) => b.total - a.total);
  const totalMs = weekEntries.reduce((s, e) => s + e.duration, 0);

  const container = document.getElementById('weeklySummary');
  if (!rows.length) {
    container.innerHTML = `<div style="padding:12px 10px;color:var(--muted);font-size:0.72rem;text-align:center">${chrome.i18n.getMessage('noRecords')}</div>`;
  } else {
    container.innerHTML = rows.map(r => `
      <div class="summary-row">
        <div>
          <div class="summary-project">${r.project}</div>
          <div style="font-size:0.75rem;margin-top:1px">${r.task}</div>
        </div>
        <div class="summary-hours">${fmtHM(r.total)}</div>
      </div>
    `).join('');
  }

  document.getElementById('weekTotal').textContent = fmtHM(totalMs);
}

// ---- Entries ----
function deleteEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  save(() => render());
}

function renderEntries(entries, containerId) {
  const container = document.getElementById(containerId);
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">${chrome.i18n.getMessage('noRecords')}</div>`;
    return;
  }
  container.innerHTML = entries.map(e => `
    <div class="entry">
      <div class="entry-badge">${e.project}</div>
      <div class="entry-info">
        <div class="entry-task">${e.task}</div>
        <div class="entry-meta">${fmtDate(e.start)} · ${fmtTime(e.start)}–${fmtTime(e.end)}</div>
      </div>
      <div class="entry-duration">${fmtDuration(e.duration)}</div>
      <button class="btn-delete" data-id="${e.id}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(Number(btn.dataset.id)));
  });
}

// ---- Tabs ----
function switchTab(tab, event) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  if (event) event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  const weekEntries = state.entries.filter(e => isInWeek(e.start, currentWeekOffset));
  if (tab === 'week') renderEntries(weekEntries, 'tab-week');
  if (tab === 'all') renderEntries(state.entries, 'tab-all');
}

// ---- Projects panel ----
function toggleProjects() {
  document.getElementById('projectsPanel').classList.toggle('open');
}

// ---- Open in tab ----
function openTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL('tab.html') });
}

// ---- Render ----
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.placeholder = msg;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.title = msg;
  });
  // Update lang attribute to reflect current locale
  document.documentElement.lang = chrome.i18n.getUILanguage();
}

function render() {
  renderProjects();
  renderWeeklySummary();
  const weekEntries = state.entries.filter(e => isInWeek(e.start, currentWeekOffset));
  renderEntries(weekEntries, 'tab-week');
  renderEntries(state.entries, 'tab-all');
}

// ---- Keyboard & Events ----
document.addEventListener('DOMContentLoaded', () => {
  // Common listeners
  const btnStart = document.getElementById('btnStart');
  if (btnStart) btnStart.addEventListener('click', toggleTimer);

  const btnPrevWeek = document.getElementById('btnPrevWeek');
  if (btnPrevWeek) btnPrevWeek.addEventListener('click', () => changeWeek(-1));

  const btnNextWeek = document.getElementById('btnNextWeek');
  if (btnNextWeek) btnNextWeek.addEventListener('click', () => changeWeek(1));

  const btnAddProject = document.getElementById('btnAddProject');
  if (btnAddProject) btnAddProject.addEventListener('click', addProject);

  const btnAddManual = document.getElementById('btnAddManual');
  if (btnAddManual) btnAddManual.addEventListener('click', addManualEntry);

  document.querySelectorAll('.tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', (e) => switchTab(tabBtn.dataset.tab, e));
  });

  const label = document.getElementById('weekRange');
  if (label) label.textContent = weekLabel(currentWeekOffset);

  // Popup specific
  const btnToggleProjects = document.getElementById('btnToggleProjects');
  if (btnToggleProjects) btnToggleProjects.addEventListener('click', toggleProjects);

  const btnOpenTab = document.getElementById('btnOpenTab');
  if (btnOpenTab) btnOpenTab.addEventListener('click', openTab);

  const taskInput = document.getElementById('taskInput');
  if (taskInput) {
    taskInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') toggleTimer();
    });
  }

  const manualTime = document.getElementById('manualTime');
  if (manualTime) {
    manualTime.addEventListener('keydown', e => {
      if (e.key === 'Enter') addManualEntry();
    });
  }

  loadState(() => {
    applyTranslations();
    render();
    updateTimerUI();
    if (state.timer) startTimerTick();
  });
});
