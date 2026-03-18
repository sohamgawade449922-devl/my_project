/* ─────────────────────────────────────────────────────────
   JARVIS – AI Personal Assistant  |  script.js
   ───────────────────────────────────────────────────────── */

'use strict';

/* ═══════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════ */
const MS_PER_HOUR   = 3_600_000;
const MS_PER_MINUTE =    60_000;
const MS_PER_SECOND =     1_000;

/* ═══════════════════════════════════════
   UTILITIES
═══════════════════════════════════════ */

/** Show a temporary toast message */
function showToast(msg, duration = 2600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

/** Pad a number to 2 digits */
function pad2(n) { return String(n).padStart(2, '0'); }

/** Format a datetime-local value for display */
function fmtDateTime(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    + ' at ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Format a timestamp number */
function fmtTs(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════
   LIVE CLOCK
═══════════════════════════════════════ */
const _fmtTime = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const _fmtDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function updateClock() {
  const now = new Date();
  document.getElementById('live-time').textContent = _fmtTime.format(now);
  document.getElementById('live-date').textContent = _fmtDate.format(now);
}
updateClock();
setInterval(updateClock, 1000);

/* ═══════════════════════════════════════
   TAB NAVIGATION
═══════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ═══════════════════════════════════════
   SPEECH SYNTHESIS
═══════════════════════════════════════ */
let voicesLoaded = false;
let preferredVoice = null;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  voicesLoaded = true;
  preferredVoice =
    voices.find(v => /en[-_]US/i.test(v.lang) && /male/i.test(v.name)) ||
    voices.find(v => /en[-_]US/i.test(v.lang)) ||
    voices.find(v => /en/i.test(v.lang)) ||
    voices[0];
}

window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utt.voice = preferredVoice;
  utt.rate   = 1;
  utt.pitch  = 0.9;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
  setResponse(text);
}

function setResponse(text) {
  document.getElementById('response-text').textContent = text;
}

/* ═══════════════════════════════════════
   SPEECH RECOGNITION
═══════════════════════════════════════ */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous  = false;
  recognition.lang        = 'en-US';
  recognition.interimResults = false;

  recognition.onstart = () => {
    document.getElementById('orb').classList.add('listening');
    document.getElementById('orb-hint').textContent = 'Listening…';
    document.getElementById('transcript-text').textContent = '…';
  };

  recognition.onend = () => {
    document.getElementById('orb').classList.remove('listening');
    document.getElementById('orb-hint').textContent = 'Click the orb or say "Hey Jarvis"';
  };

  recognition.onresult = (e) => {
    const transcript = e.results[e.resultIndex][0].transcript.trim();
    document.getElementById('transcript-text').textContent = transcript;
    processCommand(transcript.toLowerCase());
  };

  recognition.onerror = (e) => {
    document.getElementById('orb').classList.remove('listening');
    if (e.error === 'not-allowed') {
      showToast('Microphone access denied.', 4000);
    }
  };
}

/* Orb click to start listening */
document.getElementById('orb').addEventListener('click', () => {
  if (!recognition) {
    showToast('Voice recognition not supported in this browser.', 3500);
    return;
  }
  try { recognition.start(); } catch (_) { /* already running */ }
});

/* Quick command buttons */
document.querySelectorAll('.cmd-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    document.getElementById('transcript-text').textContent = cmd;
    processCommand(cmd);
  });
});

/* ═══════════════════════════════════════
   GREETING
═══════════════════════════════════════ */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning, Sir!';
  if (h < 17) return 'Good afternoon, Sir!';
  return 'Good evening, Sir!';
}

window.addEventListener('load', () => {
  const greeting = getGreeting() + ' I am JARVIS, your personal AI assistant. How may I help you today?';
  setTimeout(() => speak(greeting), 800);
});

/* ═══════════════════════════════════════
   JOKES
═══════════════════════════════════════ */
const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "I told my computer I needed a break… now it won't stop sending me Kit-Kat ads.",
  "Why do programmers prefer dark mode? Because light attracts bugs!",
  "I asked AI to write a joke. It said: undefined.",
  "How many programmers does it take to change a light bulb? None — that's a hardware problem.",
  "Why do Java developers wear glasses? Because they don't C#.",
  "I wanted to make a joke about infinity… but I didn't know where to start.",
];

function randomJoke() {
  return JOKES[Math.floor(Math.random() * JOKES.length)];
}

/* ═══════════════════════════════════════
   COMMAND PROCESSOR
═══════════════════════════════════════ */
function processCommand(msg) {
  /* Greetings */
  if (/\b(hello|hi|hey|howdy|greetings)\b/i.test(msg)) {
    speak(getGreeting() + ' How can I assist you?');

  /* Time */
  } else if (/\b(time)\b/i.test(msg)) {
    const t = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    speak('The current time is ' + t + '.');

  /* Date */
  } else if (/\b(date|today|day)\b/i.test(msg)) {
    const d = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    speak('Today is ' + d + '.');

  /* Open websites */
  } else if (/open google/i.test(msg)) {
    window.open('https://google.com', '_blank');
    speak('Opening Google.');

  } else if (/open youtube/i.test(msg)) {
    window.open('https://youtube.com', '_blank');
    speak('Opening YouTube.');

  } else if (/open github/i.test(msg)) {
    window.open('https://github.com', '_blank');
    speak('Opening GitHub.');

  } else if (/open (twitter|x\.com)/i.test(msg)) {
    window.open('https://twitter.com', '_blank');
    speak('Opening Twitter.');

  } else if (/open gmail/i.test(msg)) {
    window.open('https://mail.google.com', '_blank');
    speak('Opening Gmail.');

  } else if (/open maps/i.test(msg)) {
    window.open('https://maps.google.com', '_blank');
    speak('Opening Google Maps.');

  } else if (/open (netflix|prime|hotstar|spotify)/i.test(msg)) {
    const site = msg.match(/open (\w+)/i)[1];
    window.open('https://' + site.toLowerCase() + '.com', '_blank');
    speak('Opening ' + site + '.');

  /* Search */
  } else if (/search (for |about |up )?(.*)/i.test(msg)) {
    const q = msg.replace(/search (for |about |up )?/i, '').trim();
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
    speak('Searching for ' + q + ' on Google.');

  } else if (/wikipedia\s+(.*)/i.test(msg)) {
    const q = msg.replace(/wikipedia\s+/i, '').trim();
    window.open('https://en.wikipedia.org/wiki/' + encodeURIComponent(q), '_blank');
    speak('Opening Wikipedia article for ' + q + '.');

  /* Schedule */
  } else if (/show.*(schedule|events|calendar)/i.test(msg)) {
    switchTab('schedule');
    speak('Here is your schedule, Sir.');

  } else if (/add.*(event|task|meeting|appointment)/i.test(msg)) {
    switchTab('schedule');
    speak('Please fill in the event details in the schedule tab.');

  /* Notes */
  } else if (/show.*(notes?)/i.test(msg)) {
    switchTab('notes');
    speak('Here are your notes, Sir.');

  } else if (/add.*(note|memo|write)/i.test(msg)) {
    switchTab('notes');
    speak('Ready to add a new note, Sir.');

  /* Timer */
  } else if (/start.*(timer|countdown)/i.test(msg)) {
    switchTab('timer');
    startCountdown();
    speak('Starting the timer, Sir.');

  } else if (/stop.*(timer|countdown)/i.test(msg)) {
    pauseCountdown();
    speak('Timer paused.');

  } else if (/reset.*(timer|countdown)/i.test(msg)) {
    resetCountdown();
    speak('Timer reset.');

  /* Reminders */
  } else if (/show.*(reminder)/i.test(msg)) {
    switchTab('reminders');
    speak('Here are your reminders, Sir.');

  /* Joke */
  } else if (/\b(joke|funny|laugh)\b/i.test(msg)) {
    speak(randomJoke());

  /* Calculator */
  } else if (/calculator/i.test(msg)) {
    speak('Opening calculator.');
    window.open('https://www.google.com/search?q=calculator', '_blank');

  /* Weather */
  } else if (/weather/i.test(msg)) {
    speak('Please allow location access for weather. Opening weather service.');
    window.open('https://wttr.in', '_blank');

  /* News */
  } else if (/news/i.test(msg)) {
    window.open('https://news.google.com', '_blank');
    speak('Opening Google News.');

  /* Maths / Calculations – safe parser (no eval / Function constructor) */
  } else if (/^[\d\s()+\-*/^.×÷xX]+$/.test(msg)) {
    const expr = msg.replace(/[xX×]/g, '*').replace(/[÷]/g, '/');
    try {
      const result = safeCalc(expr);
      speak('The result is ' + result + '.');
    } catch (_) {
      speak("I couldn't calculate that. Please try again.");
    }

  /* Thank you */
  } else if (/thank(s| you)/i.test(msg)) {
    speak('Always at your service, Sir!');

  /* Bye */
  } else if (/\b(bye|goodbye|exit|quit|see you)\b/i.test(msg)) {
    speak('Goodbye, Sir! Have a wonderful day.');

  /* Fallback – Google search */
  } else {
    window.open('https://www.google.com/search?q=' + encodeURIComponent(msg), '_blank');
    speak("I found some information about " + msg + " on Google.");
  }
}

/** Switch to a tab programmatically */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const btn = document.querySelector('.tab-btn[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');
  const sec = document.getElementById('tab-' + name);
  if (sec) sec.classList.add('active');
}

/* ═══════════════════════════════════════
   SCHEDULE MANAGER
═══════════════════════════════════════ */
const SCHED_KEY = 'jarvis_schedule';

function loadSchedule() {
  try { return JSON.parse(localStorage.getItem(SCHED_KEY)) || []; }
  catch (_) { return []; }
}

function saveSchedule(items) {
  localStorage.setItem(SCHED_KEY, JSON.stringify(items));
}

function renderSchedule() {
  const items = loadSchedule().sort((a, b) => new Date(a.time) - new Date(b.time));
  const el = document.getElementById('schedule-list');

  if (!items.length) {
    el.innerHTML = '<div class="empty-state">No events yet. Add one above!</div>';
    return;
  }

  el.innerHTML = items.map(item => `
    <div class="item-card ${item.priority} ${item.done ? 'done' : ''}" data-id="${item.id}">
      <div>
        <div class="item-title">${escHtml(item.title)}</div>
        <div class="item-meta">
          <i class="fas fa-clock"></i> ${fmtDateTime(item.time)}
          &nbsp;·&nbsp; <span class="priority-badge">${item.priority}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="hud-btn small secondary sched-done" data-id="${item.id}" title="${item.done ? 'Mark undone' : 'Mark done'}">
          <i class="fas ${item.done ? 'fa-times-circle' : 'fa-check-circle'}"></i>
        </button>
        <button class="hud-btn small danger sched-del" data-id="${item.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  /* Bind buttons */
  el.querySelectorAll('.sched-done').forEach(btn => {
    btn.addEventListener('click', () => toggleScheduleDone(btn.dataset.id));
  });
  el.querySelectorAll('.sched-del').forEach(btn => {
    btn.addEventListener('click', () => deleteScheduleItem(btn.dataset.id));
  });
}

function toggleScheduleDone(id) {
  const items = loadSchedule();
  const item = items.find(i => i.id === id);
  if (item) { item.done = !item.done; saveSchedule(items); renderSchedule(); }
}

function deleteScheduleItem(id) {
  const items = loadSchedule().filter(i => i.id !== id);
  saveSchedule(items);
  renderSchedule();
  showToast('Event deleted.');
}

document.getElementById('schedule-form').addEventListener('submit', e => {
  e.preventDefault();
  const title    = document.getElementById('event-title').value.trim();
  const time     = document.getElementById('event-time').value;
  const priority = document.getElementById('event-priority').value;
  if (!title || !time) return;

  const items = loadSchedule();
  items.push({ id: Date.now().toString(), title, time, priority, done: false });
  saveSchedule(items);
  renderSchedule();
  e.target.reset();
  showToast('Event added!');
  speak('Event "' + title + '" added to your schedule.');
});

renderSchedule();

/* ═══════════════════════════════════════
   NOTES MANAGER
═══════════════════════════════════════ */
const NOTES_KEY = 'jarvis_notes';

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; }
  catch (_) { return []; }
}

function saveNotes(items) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(items));
}

function renderNotes() {
  const items = loadNotes().sort((a, b) => b.ts - a.ts);
  const el = document.getElementById('notes-list');

  if (!items.length) {
    el.innerHTML = '<div class="empty-state">No notes yet. Create one above!</div>';
    return;
  }

  el.innerHTML = items.map(n => `
    <div class="note-card" data-id="${n.id}">
      <div class="item-title">${escHtml(n.title)}</div>
      <div class="note-body">${escHtml(n.body)}</div>
      <div class="note-footer">
        <span class="note-ts">${fmtTs(n.ts)}</span>
        <button class="hud-btn small danger note-del" data-id="${n.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.note-del').forEach(btn => {
    btn.addEventListener('click', () => deleteNote(btn.dataset.id));
  });
}

function deleteNote(id) {
  saveNotes(loadNotes().filter(n => n.id !== id));
  renderNotes();
  showToast('Note deleted.');
}

document.getElementById('notes-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('note-title').value.trim();
  const body  = document.getElementById('note-body').value.trim();
  if (!title || !body) return;

  const notes = loadNotes();
  notes.push({ id: Date.now().toString(), title, body, ts: Date.now() });
  saveNotes(notes);
  renderNotes();
  e.target.reset();
  showToast('Note saved!');
});

renderNotes();

/* ═══════════════════════════════════════
   COUNTDOWN TIMER
═══════════════════════════════════════ */
let cdTotal = 0;    // remaining seconds
let cdInit  = 0;    // initial seconds (for reset)
let cdTimer = null;

function cdSecsToDisplay(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return pad2(h) + ':' + pad2(m) + ':' + pad2(sec);
}

function updateCountdownDisplay() {
  const el = document.getElementById('countdown-display');
  el.textContent = cdSecsToDisplay(cdTotal);
  el.classList.toggle('warn',  cdTotal > 0 && cdTotal <= 30);
  el.classList.toggle('alert', cdTotal === 0 && cdTimer !== null);
}

function startCountdown() {
  if (cdTimer) return; // already running

  const h = parseInt(document.getElementById('t-hours').value)   || 0;
  const m = parseInt(document.getElementById('t-minutes').value) || 0;
  const s = parseInt(document.getElementById('t-seconds').value) || 0;

  if (cdTotal === 0) {
    cdTotal = h * 3600 + m * 60 + s;
    cdInit  = cdTotal;
  }
  if (cdTotal <= 0) { showToast('Set a time first!'); return; }

  cdTimer = setInterval(() => {
    cdTotal--;
    updateCountdownDisplay();
    if (cdTotal <= 0) {
      clearInterval(cdTimer);
      cdTimer = null;
      speak('Time is up, Sir!');
      showToast('⏰ Timer finished!', 4000);
      updateCountdownDisplay();
    }
  }, 1000);
}

function pauseCountdown() {
  clearInterval(cdTimer);
  cdTimer = null;
}

function resetCountdown() {
  clearInterval(cdTimer);
  cdTimer = null;
  cdTotal = 0;
  cdInit  = 0;
  document.getElementById('countdown-display').classList.remove('warn', 'alert');
  document.getElementById('countdown-display').textContent = '00:00:00';
}

document.getElementById('cd-start').addEventListener('click', startCountdown);
document.getElementById('cd-pause').addEventListener('click', pauseCountdown);
document.getElementById('cd-reset').addEventListener('click', resetCountdown);

/* ═══════════════════════════════════════
   STOPWATCH
═══════════════════════════════════════ */
let swElapsed = 0;   // ms
let swStart   = null;
let swTimer   = null;
let lapCount  = 0;

function formatStopwatch(ms) {
  const h   = Math.floor(ms / MS_PER_HOUR);
  const m   = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const s   = Math.floor((ms % MS_PER_MINUTE) / MS_PER_SECOND);
  return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
}

function updateStopwatchDisplay() {
  const now = swStart ? swElapsed + (Date.now() - swStart) : swElapsed;
  document.getElementById('stopwatch-display').textContent = formatStopwatch(now);
}

document.getElementById('sw-start').addEventListener('click', () => {
  if (swTimer) {
    /* Pause */
    clearInterval(swTimer);
    swTimer  = null;
    swElapsed += Date.now() - swStart;
    swStart  = null;
    document.getElementById('sw-start').innerHTML = '<i class="fas fa-play"></i> Start';
  } else {
    /* Start / Resume */
    swStart = Date.now();
    swTimer = setInterval(updateStopwatchDisplay, 200);
    document.getElementById('sw-start').innerHTML = '<i class="fas fa-pause"></i> Pause';
  }
});

document.getElementById('sw-lap').addEventListener('click', () => {
  if (!swTimer) return;
  lapCount++;
  const elapsed = swElapsed + (Date.now() - swStart);
  const li = document.createElement('div');
  li.className = 'lap-item';
  li.innerHTML = '<span>Lap ' + lapCount + '</span><span>' + formatStopwatch(elapsed) + '</span>';
  document.getElementById('lap-list').prepend(li);
});

document.getElementById('sw-reset').addEventListener('click', () => {
  clearInterval(swTimer);
  swTimer = null; swStart = null; swElapsed = 0; lapCount = 0;
  document.getElementById('stopwatch-display').textContent = '00:00:00';
  document.getElementById('lap-list').innerHTML = '';
  document.getElementById('sw-start').innerHTML = '<i class="fas fa-play"></i> Start';
});

/* ═══════════════════════════════════════
   REMINDERS
═══════════════════════════════════════ */
const REM_KEY = 'jarvis_reminders';

function loadReminders() {
  try { return JSON.parse(localStorage.getItem(REM_KEY)) || []; }
  catch (_) { return []; }
}

function saveReminders(items) {
  localStorage.setItem(REM_KEY, JSON.stringify(items));
}

/* Request notification permission on load */
function checkNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    document.getElementById('notif-banner').style.display = 'flex';
  }
}
checkNotifPermission();

document.getElementById('enable-notif').addEventListener('click', () => {
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      document.getElementById('notif-banner').style.display = 'none';
      showToast('Notifications enabled!');
    }
  });
});

function renderReminders() {
  const items = loadReminders().sort((a, b) => new Date(a.time) - new Date(b.time));
  const el = document.getElementById('reminder-list');

  if (!items.length) {
    el.innerHTML = '<div class="empty-state">No reminders set.</div>';
    return;
  }

  el.innerHTML = items.map(r => `
    <div class="item-card ${r.fired ? 'fired' : 'normal'}" data-id="${r.id}">
      <div>
        <div class="item-title">${escHtml(r.title)}</div>
        <div class="item-meta">
          <i class="fas fa-bell"></i> ${fmtDateTime(r.time)}
          ${r.fired ? ' · <span style="color:var(--success)">Fired</span>' : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="hud-btn small danger rem-del" data-id="${r.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.rem-del').forEach(btn => {
    btn.addEventListener('click', () => deleteReminder(btn.dataset.id));
  });
}

function deleteReminder(id) {
  saveReminders(loadReminders().filter(r => r.id !== id));
  renderReminders();
  showToast('Reminder deleted.');
}

document.getElementById('reminder-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('reminder-title').value.trim();
  const time  = document.getElementById('reminder-time').value;
  if (!title || !time) return;

  if (new Date(time) <= new Date()) {
    showToast('Please choose a future date/time.', 3000);
    return;
  }

  const reminders = loadReminders();
  reminders.push({ id: Date.now().toString(), title, time, fired: false });
  saveReminders(reminders);
  renderReminders();
  e.target.reset();
  showToast('Reminder set for ' + fmtDateTime(time) + '!');
  speak('Reminder set: ' + title + ' at ' + fmtDateTime(time) + '.');
});

renderReminders();

/* Poll reminders every 15 seconds */
function checkReminders() {
  const now   = new Date();
  const items = loadReminders();
  let changed = false;

  items.forEach(r => {
    if (!r.fired && new Date(r.time) <= now) {
      r.fired = true;
      changed = true;
      speak('Reminder: ' + r.title);
      showToast('🔔 ' + r.title, 6000);

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('JARVIS Reminder', {
          body: r.title,
          icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712139.png'
        });
      }
    }
  });

  if (changed) { saveReminders(items); renderReminders(); }
}

checkReminders();
setInterval(checkReminders, 15000);

/* ═══════════════════════════════════════
   SAFE ARITHMETIC EVALUATOR
   Supports: + - * / ( ) and decimals.
   No eval() or Function() constructor used.
═══════════════════════════════════════ */
function safeCalc(expr) {
  // Tokenise: numbers, operators, parentheses
  const tokens = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');
  while (i < s.length) {
    if (/\d/.test(s[i]) || (s[i] === '.' && /\d/.test(s[i + 1]))) {
      let num = '';
      while (i < s.length && /[\d.]/.test(s[i])) num += s[i++];
      tokens.push({ type: 'num', val: parseFloat(num) });
    } else if ('+-*/()'.includes(s[i])) {
      tokens.push({ type: 'op', val: s[i++] });
    } else {
      throw new Error('Invalid character: ' + s[i]);
    }
  }

  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  function parseExpr() { return parseAddSub(); }

  function parseAddSub() {
    let left = parseMulDiv();
    while (peek() && (peek().val === '+' || peek().val === '-')) {
      const op = consume().val;
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseMulDiv() {
    let left = parseUnary();
    while (peek() && (peek().val === '*' || peek().val === '/')) {
      const op = consume().val;
      const right = parseUnary();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseUnary() {
    if (peek() && peek().val === '-') { consume(); return -parsePrimary(); }
    if (peek() && peek().val === '+') { consume(); return parsePrimary(); }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('Unexpected end');
    if (t.type === 'num') { consume(); return t.val; }
    if (t.val === '(') {
      consume();
      const val = parseExpr();
      if (!peek() || peek().val !== ')') throw new Error('Missing )');
      consume();
      return val;
    }
    throw new Error('Unexpected token: ' + t.val);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Unexpected token');
  return parseFloat(result.toPrecision(12));
}

/* ═══════════════════════════════════════
   XSS HELPER
═══════════════════════════════════════ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
