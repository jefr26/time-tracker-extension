import { storage } from './js/storage.js';
import { utils } from './js/utils.js';
import { ui } from './js/ui.js';
import { logger } from './js/logger.js';

let state = { projects: ['General'], entries: [], timer: null };
let timerInterval = null;
let currentWeekOffset = 0;

// ---- Core Actions ----
function saveState(cb) {
  storage.save(state, cb);
}

function toggleTimer() {
  if (state.timer) {
    stopTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  const taskInput = document.getElementById('taskInput');
  const projectSelect = document.getElementById('projectSelect');
  const task = taskInput.value.trim();
  const project = projectSelect.value;

  if (!task) {
    taskInput.focus();
    return;
  }

  state.timer = { task, project, start: Date.now() };
  logger.log('Timer started', { task, project });
  
  saveState(() => {
    chrome.runtime.sendMessage({ action: 'startAlarm' });
    updateTimerUI();
    taskInput.value = '';
    startTimerTick();
  });
}

function stopTimer() {
  if (!state.timer) return;
  clearInterval(timerInterval);
  timerInterval = null;

  const now = Date.now();
  const duration = now - state.timer.start;
  
  logger.log('Timer stopped', { task: state.timer.task, duration });

  if (duration >= 5000) { // Min 5 seconds
    addEntryToState(state.timer.task, state.timer.project, state.timer.start, now, duration);
  } else {
    logger.log('Entry discarded (too short)');
  }

  state.timer = null;
  saveState(() => {
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
  const taskInput = document.getElementById('taskInput');
  const projectSelect = document.getElementById('projectSelect');
  const manualTimeInput = document.getElementById('manualTime');
  
  const task = taskInput.value.trim();
  const project = projectSelect.value;
  const timeStr = manualTimeInput.value.trim();

  if (!task) { taskInput.focus(); return; }
  if (!timeStr) { manualTimeInput.focus(); return; }

  let ms = 0;
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || m < 0 || m > 59) return;
    ms = (h * 3600 + m * 60) * 1000;
  } else {
    const m = Number(timeStr);
    if (isNaN(m)) return;
    ms = m * 60 * 1000;
  }

  if (ms <= 0) return;

  const now = Date.now();
  addEntryToState(task, project, now - ms, now, ms);
  logger.log('Manual entry added', { task, duration: ms });

  taskInput.value = '';
  manualTimeInput.value = '';

  saveState(() => render());
}

// ---- UI Updates ----
function startTimerTick() {
  clearInterval(timerInterval);
  timerInterval = setInterval(updateElapsed, 1000);
  updateElapsed();
}

function updateElapsed() {
  if (!state.timer) return;
  const elapsed = Date.now() - state.timer.start;
  const el = document.getElementById('timerElapsed');
  if (el) el.textContent = utils.fmtDuration(elapsed);
}

function updateTimerUI() {
  const running = !!state.timer;
  const btn = document.getElementById('btnStart');
  const timerEl = document.getElementById('activeTimer');

  if (btn) {
    btn.textContent = running ? '■' : '▶';
    btn.classList.toggle('running', running);
  }
  if (timerEl) timerEl.classList.toggle('visible', running);

  if (running) {
    const taskEl = document.getElementById('timerTask');
    const projectEl = document.getElementById('timerProject');
    if (taskEl) taskEl.textContent = state.timer.task;
    if (projectEl) projectEl.textContent = state.timer.project;
  }
}

function render() {
  renderProjects();
  renderWeeklySummary();
  const weekEntries = state.entries.filter(e => utils.isInWeek(e.start, currentWeekOffset));
  renderEntries(weekEntries, 'tab-week');
  
  const allTab = document.querySelector('.tab[data-tab="all"]');
  if (allTab && allTab.classList.contains('active')) {
    renderEntries(state.entries, 'tab-all');
  }
}

function renderProjects() {
  const sel = document.getElementById('projectSelect');
  const list = document.getElementById('projectsList');
  if (!sel || !list) return;

  sel.innerHTML = '';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });

  list.innerHTML = '';
  state.projects.forEach(p => {
    const tag = document.createElement('div');
    tag.className = 'project-tag';
    tag.textContent = p + ' ';
    
    if (state.projects.length > 1) {
      const btn = document.createElement('button');
      btn.className = 'btn-remove-project';
      btn.dataset.project = p;
      btn.textContent = '×';
      btn.addEventListener('click', () => removeProject(p));
      tag.appendChild(btn);
    }
    list.appendChild(tag);
  });
}

function addProject() {
  const input = document.getElementById('projectInput');
  const name = input.value.trim();
  if (!name || state.projects.includes(name)) return;
  state.projects.push(name);
  input.value = '';
  logger.log('Project added', name);
  saveState(() => renderProjects());
}

function removeProject(name) {
  if (state.projects.length <= 1) return;
  state.projects = state.projects.filter(p => p !== name);
  logger.log('Project removed', name);
  saveState(() => renderProjects());
}

function renderWeeklySummary() {
  const container = document.getElementById('weeklySummary');
  const totalEl = document.getElementById('weekTotal');
  if (!container || !totalEl) return;

  const weekEntries = state.entries.filter(e => utils.isInWeek(e.start, currentWeekOffset));
  const groups = {};
  weekEntries.forEach(e => {
    const key = `${e.project}||${e.task}`;
    if (!groups[key]) groups[key] = { project: e.project, task: e.task, total: 0 };
    groups[key].total += e.duration;
  });

  const rows = Object.values(groups).sort((a, b) => b.total - a.total);
  const totalMs = weekEntries.reduce((s, e) => s + e.duration, 0);

  if (!rows.length) {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:12px 10px;color:var(--muted);font-size:0.72rem;text-align:center';
    empty.textContent = chrome.i18n.getMessage('noRecords');
    container.appendChild(empty);
  } else {
    container.innerHTML = '';
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      
      const info = document.createElement('div');
      const proj = document.createElement('div');
      proj.className = 'summary-project';
      proj.textContent = r.project;
      const task = document.createElement('div');
      task.style.cssText = 'font-size:0.75rem;margin-top:1px';
      task.textContent = r.task;
      info.appendChild(proj);
      info.appendChild(task);
      
      const hours = document.createElement('div');
      hours.className = 'summary-hours';
      hours.textContent = utils.fmtHM(r.total);
      
      row.appendChild(info);
      row.appendChild(hours);
      container.appendChild(row);
    });
  }
  totalEl.textContent = utils.fmtHM(totalMs);
}

function renderEntries(entries, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = chrome.i18n.getMessage('noRecords');
    container.appendChild(empty);
    return;
  }

  const displayEntries = entries.slice(0, 100);
  displayEntries.forEach(e => {
    const entry = document.createElement('div');
    entry.className = 'entry';
    
    const badge = document.createElement('div');
    badge.className = 'entry-badge';
    badge.textContent = e.project;
    
    const info = document.createElement('div');
    info.className = 'entry-info';
    const task = document.createElement('div');
    task.className = 'entry-task';
    task.textContent = e.task;
    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    meta.textContent = `${utils.fmtDate(e.start)} · ${utils.fmtTime(e.start)}–${utils.fmtTime(e.end)}`;
    info.appendChild(task);
    info.appendChild(meta);
    
    const dur = document.createElement('div');
    dur.className = 'entry-duration';
    dur.textContent = utils.fmtDuration(e.duration);
    
    const del = document.createElement('button');
    del.className = 'btn-delete';
    del.textContent = '✕';
    del.addEventListener('click', () => {
      state.entries = state.entries.filter(ent => ent.id !== e.id);
      saveState(() => render());
    });
    
    entry.appendChild(badge);
    entry.appendChild(info);
    entry.appendChild(dur);
    entry.appendChild(del);
    container.appendChild(entry);
  });

  if (entries.length > 100) {
    const moreMsg = chrome.i18n.getMessage('moreEntriesHidden', [(entries.length - 100).toString()]);
    const moreDiv = document.createElement('div');
    moreDiv.style.textAlign = 'center';
    moreDiv.style.padding = '10px';
    moreDiv.style.fontSize = '0.7rem';
    moreDiv.style.color = 'var(--muted)';
    moreDiv.textContent = moreMsg;
    container.appendChild(moreDiv);
  }
}

function switchTab(tab, event) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  if (event) event.target.classList.add('active');
  const targetTab = document.getElementById(`tab-${tab}`);
  if (targetTab) targetTab.classList.add('active');
  
  const weekEntries = state.entries.filter(e => utils.isInWeek(e.start, currentWeekOffset));
  if (tab === 'week') renderEntries(weekEntries, 'tab-week');
  if (tab === 'all') renderEntries(state.entries, 'tab-all');
}

function changeWeek(dir) {
  currentWeekOffset += dir;
  if (currentWeekOffset > 0) currentWeekOffset = 0;
  const label = document.getElementById('weekRange');
  if (label) label.textContent = ui.weekLabel(currentWeekOffset);
  render();
}

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
  ui.applyTranslations();
  document.documentElement.lang = chrome.i18n.getUILanguage();

  storage.load((loadedState) => {
    state = loadedState;
    
    // Bind Events
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

    const btnToggleProjects = document.getElementById('btnToggleProjects');
    if (btnToggleProjects) {
        btnToggleProjects.addEventListener('click', () => {
            document.getElementById('projectsPanel').classList.toggle('open');
        });
    }

    const btnOpenTab = document.getElementById('btnOpenTab');
    if (btnOpenTab) {
        btnOpenTab.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('tab.html') });
        });
    }

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

    const weekRangeLabel = document.getElementById('weekRange');
    if (weekRangeLabel) weekRangeLabel.textContent = ui.weekLabel(currentWeekOffset);

    render();
    updateTimerUI();
    if (state.timer) {
      logger.log('Resuming timer UI', { task: state.timer.task });
      startTimerTick();
    }
  });

  // Sync state between popup and tabs
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.tt_state) {
      const newState = changes.tt_state.newValue;
      if (!newState) return;

      // Only update if something relevant changed (to avoid unnecessary re-renders)
      // Check if timer state changed
      const timerChanged = JSON.stringify(state.timer) !== JSON.stringify(newState.timer);
      const entriesChanged = state.entries.length !== newState.entries.length;
      const projectsChanged = state.projects.length !== newState.projects.length;

      state = newState;

      if (timerChanged) {
        updateTimerUI();
        if (state.timer) {
          startTimerTick();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
        }
      }

      if (entriesChanged || projectsChanged || timerChanged) {
        render();
      }
    }
  });
});
