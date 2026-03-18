/* ─────────────────────────────────────────────────────────
   ARIA – Agentic AI Schedule Assistant  |  script.js
   ───────────────────────────────────────────────────────── */

'use strict';

/* ═══════════════════════════════════════
   STATE  (persisted in localStorage)
═══════════════════════════════════════ */
const STATE_KEY = 'aria_v1';

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
  } catch { return {}; }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

const defaults = {
  events:    [],
  reminders: [],
  goals:     [],
  streak:    0,
  lastActive: null,
};

const state = Object.assign({}, defaults, loadState());

/* ═══════════════════════════════════════
   UTILITIES
═══════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function pad2(n) { return String(n).padStart(2, '0'); }

function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), duration);
}

function fmtDateTime(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    + ' at ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(val) {
  if (!val) return false;
  const d = new Date(val);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isUpcoming(val) {
  if (!val) return false;
  const d = new Date(val);
  return d > new Date();
}

/* ═══════════════════════════════════════
   STREAK TRACKER
═══════════════════════════════════════ */
(function updateStreak() {
  const today = new Date().toDateString();
  if (state.lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    state.streak = (state.lastActive === yesterday) ? (state.streak + 1) : 1;
    state.lastActive = today;
    saveState();
  }
})();

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
    if (btn.dataset.tab === 'insights') renderInsights();
    if (btn.dataset.tab === 'schedule') renderSchedule();
  });
});

/* ═══════════════════════════════════════
   SPEECH SYNTHESIS
═══════════════════════════════════════ */
let preferredVoice = null;
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;
  preferredVoice =
    voices.find(v => /en[-_]US/i.test(v.lang) && /female/i.test(v.name)) ||
    voices.find(v => /en[-_]US/i.test(v.lang)) ||
    voices.find(v => /en/i.test(v.lang)) ||
    voices[0];
}
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utt.voice = preferredVoice;
  utt.rate = 1.05;
  utt.pitch = 1.1;
  utt.volume = 1;
  window.speechSynthesis.speak(utt);
}

/* ═══════════════════════════════════════
   SPEECH RECOGNITION
═══════════════════════════════════════ */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    document.getElementById('chat-input').value = transcript;
    stopListening();
    handleUserMessage(transcript);
  };
  recognition.onerror = () => stopListening();
  recognition.onend   = () => stopListening();
}

document.getElementById('voice-btn').addEventListener('click', () => {
  if (!recognition) { showToast('Voice recognition not supported in this browser.'); return; }
  if (isListening) { stopListening(); return; }
  startListening();
});

function startListening() {
  isListening = true;
  const btn = document.getElementById('voice-btn');
  const icon = document.getElementById('mic-icon');
  btn.classList.add('listening');
  icon.className = 'fas fa-circle';
  recognition.start();
}

function stopListening() {
  isListening = false;
  const btn = document.getElementById('voice-btn');
  const icon = document.getElementById('mic-icon');
  btn.classList.remove('listening');
  icon.className = 'fas fa-microphone';
  try { recognition.stop(); } catch { /* ignore */ }
}

/* ═══════════════════════════════════════
   CHAT ENGINE
═══════════════════════════════════════ */
const chatEl = document.getElementById('chat-messages');
const typingEl = document.getElementById('typing-indicator');

function appendMessage(role, html, speak_text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role === 'aria') {
    div.innerHTML = `<div class="msg-header"><i class="fas fa-robot"></i> ARIA</div>${html}`;
  } else {
    div.textContent = html;
  }
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  if (role === 'aria' && speak_text) speak(speak_text);
}

function showTyping() {
  typingEl.classList.remove('hidden');
  chatEl.scrollTop = chatEl.scrollHeight;
}

function hideTyping() {
  typingEl.classList.add('hidden');
}

function ariaReply(html, speak_text, delay = 600) {
  showTyping();
  setTimeout(() => {
    hideTyping();
    appendMessage('aria', html, speak_text);
  }, delay);
}

/* ── Chat form ── */
document.getElementById('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  handleUserMessage(text);
});

/* ── Quick action buttons ── */
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => handleUserMessage(btn.dataset.msg));
});

/* ── Session stats ── */
function updateSessionStats() {
  document.getElementById('stat-tasks').textContent     = state.events.length;
  document.getElementById('stat-reminders').textContent = state.reminders.length;
  document.getElementById('stat-goals').textContent     = state.goals.length;
}

/* ═══════════════════════════════════════
   AGENTIC AI BRAIN
═══════════════════════════════════════ */

/* Productivity tips pool */
const TIPS = [
  "🧠 Use time-blocking: assign every task a specific time slot to reduce decision fatigue.",
  "⏳ Try the Pomodoro technique — 25 min work, 5 min break. It boosts deep focus.",
  "📌 Do your most important task (MIT) first thing in the morning.",
  "🔕 Mute notifications during deep work sessions to stay in flow state.",
  "📝 Write tomorrow's task list the night before to hit the ground running.",
  "🌿 Take a 10-minute walk between tasks to reset your mental energy.",
  "🎯 Limit your daily priority tasks to three — it keeps you focused and accountable.",
  "⚡ Batch similar tasks together to reduce context-switching overhead.",
  "📊 Review your week every Sunday: what went well, what to improve.",
  "💤 Protect your sleep — it is the single biggest lever for productivity.",
  "🧘 Start meetings with a 1-minute mindfulness pause to increase quality.",
  "🗂️ Use the 2-minute rule: if a task takes less than 2 min, do it now.",
];

/* Jokes pool */
const JOKES = [
  "Why do programmers prefer dark mode? Because light attracts bugs! 😄",
  "I told my calendar I needed a break. Now it thinks every day is a holiday. 📅",
  "Why did the to-do list go to therapy? Too many unresolved issues. 📝",
  "My schedule is so packed, even my free time is scheduled. ⏰",
  "I set a reminder to be spontaneous. It didn't help. 😅",
];

/* Intent detection */
function detectIntent(msg) {
  const m = msg.toLowerCase();

  if (/\b(hi|hello|hey|greet|howdy|yo)\b/.test(m))          return 'greet';
  if (/\b(time|clock)\b/.test(m) && !/schedule|timer/.test(m)) return 'time';
  if (/\b(date|day|today)\b/.test(m) && !/schedule/.test(m))   return 'date';
  if (/\b(schedule|plan|event|task|add|create|set up)\b/.test(m) && /\b(today|tomorrow|meeting|work|gym|lunch|call|study|exercise)\b/.test(m)) return 'add_event_quick';
  if (/\b(show|list|what.*schedule|my schedule|today|upcoming)\b/.test(m)) return 'show_schedule';
  if (/\b(add|create|new|schedule|plan)\b/.test(m) && /\b(task|event|meeting|session|appointment)\b/.test(m)) return 'add_event';
  if (/\b(reminder|remind|alert|notify)\b/.test(m)) return 'set_reminder';
  if (/\b(goal|project|objective|target|aim)\b/.test(m)) return 'create_goal';
  if (/\b(break.?down|split|subtask|steps?)\b/.test(m)) return 'breakdown';
  if (/\b(priority|important|urgent|high)\b/.test(m))   return 'show_priority';
  if (/\b(tip|advice|suggest|productiv|improve|hack)\b/.test(m)) return 'tip';
  if (/\b(joke|funny|laugh|humor)\b/.test(m)) return 'joke';
  if (/\b(focus|now|next|should i|what to do)\b/.test(m)) return 'focus';
  if (/\b(week|plan.*week|weekly|this week)\b/.test(m))   return 'plan_week';
  if (/\b(insight|stat|analytic|progress|how.*doing)\b/.test(m)) return 'insights';
  if (/\b(thank|thanks|great|awesome|nice)\b/.test(m))    return 'thanks';
  if (/\b(help|what can you|commands?|features?)\b/.test(m)) return 'help';
  if (/\b(delete|remove|clear|cancel)\b/.test(m))         return 'delete_hint';
  if (/\b(complete|done|finish|mark)\b/.test(m))          return 'complete_hint';
  return 'unknown';
}

/* Extract a possible event title from natural language */
function extractEventTitle(msg) {
  const patterns = [
    /(?:add|schedule|create|set up|plan)\s+(?:a\s+)?(?:task|event|meeting|session|appointment)?\s*(?:for\s+)?(.+?)(?:\s+(?:at|on|tomorrow|today|this|next|\d).*)?$/i,
    /(?:meeting|gym|lunch|call|study|exercise|workout|class|appointment)\s*(?:with\s+\w+)?/i,
  ];
  for (const p of patterns) {
    const m = msg.match(p);
    if (m && m[1]) return m[1].trim();
    if (m && m[0]) return m[0].trim();
  }
  return null;
}

/* Generate AI schedule suggestions */
function generateScheduleSuggestions() {
  const now = new Date();
  const hour = now.getHours();
  const upcoming = state.events.filter(e => isUpcoming(e.time) && !e.done)
    .sort((a, b) => new Date(a.time) - new Date(b.time));
  const highPri = upcoming.filter(e => e.priority === 'high');

  const suggestions = [];

  if (hour < 10) suggestions.push("🌅 It's morning — great time to tackle your most important task first.");
  else if (hour < 13) suggestions.push("☀️ Mid-morning energy peak — ideal for deep focus work.");
  else if (hour < 15) suggestions.push("🍽️ Post-lunch dip: schedule lighter tasks or a short walk.");
  else if (hour < 18) suggestions.push("⚡ Afternoon second wind — good for meetings and collaboration.");
  else suggestions.push("🌙 Evening: wind down, plan tomorrow, and protect your sleep.");

  if (highPri.length > 0)
    suggestions.push(`🔴 You have ${highPri.length} high-priority task${highPri.length > 1 ? 's' : ''}: "${highPri[0].title}" — address it soon.`);

  if (upcoming.length === 0)
    suggestions.push("✅ Your schedule is clear! Great time to plan ahead or work on a goal.");
  else
    suggestions.push(`📋 Next up: "${upcoming[0].title}" on ${fmtDateTime(upcoming[0].time)}.`);

  return suggestions;
}

/* Main intent handler */
function handleUserMessage(msg) {
  if (!msg.trim()) return;
  appendMessage('user', msg);
  updateSessionStats();

  const intent = detectIntent(msg);

  switch (intent) {

    case 'greet': {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      ariaReply(
        `${greeting}! I'm <strong>ARIA</strong> — your Agentic AI Schedule Assistant. I can help you manage your schedule, set reminders, break down goals, and keep you productive. What shall we work on?
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="handleUserMessage('What\\'s on my schedule today?')">Today's schedule</button>
          <button class="msg-action-btn" onclick="handleUserMessage('Give me a productivity tip')">Productivity tip</button>
          <button class="msg-action-btn" onclick="handleUserMessage('Help me plan my week')">Plan my week</button>
        </div>`,
        `${greeting}! I'm ARIA, your Agentic AI Schedule Assistant. How can I help you today?`
      );
      break;
    }

    case 'time': {
      const t = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      ariaReply(`🕐 The current time is <strong>${t}</strong>.`, `The current time is ${t}.`);
      break;
    }

    case 'date': {
      const d = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      ariaReply(`📅 Today is <strong>${d}</strong>.`, `Today is ${d}.`);
      break;
    }

    case 'show_schedule': {
      const todayEvents = state.events.filter(e => isToday(e.time)).sort((a, b) => new Date(a.time) - new Date(b.time));
      const upcomingEvents = state.events.filter(e => isUpcoming(e.time) && !isToday(e.time)).sort((a, b) => new Date(a.time) - new Date(b.time)).slice(0, 5);

      let html = '';
      if (todayEvents.length === 0 && upcomingEvents.length === 0) {
        html = `<p>Your schedule is <strong>clear</strong> — no upcoming events. Want me to help you plan something?</p>
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="handleUserMessage('Add a task for me')">Add a task</button>
            <button class="msg-action-btn" onclick="handleUserMessage('Help me plan my week')">Plan my week</button>
          </div>`;
      } else {
        if (todayEvents.length > 0) {
          html += `<p><strong>Today (${todayEvents.length} event${todayEvents.length > 1 ? 's' : ''}):</strong></p><ul style="margin:.3rem 0 .6rem 1rem;line-height:1.8">`;
          todayEvents.forEach(e => {
            const time = new Date(e.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const pri  = e.priority === 'high' ? '🔴' : e.priority === 'low' ? '🟢' : '🔵';
            html += `<li>${pri} <strong>${e.title}</strong> — ${time} (${e.duration} min)</li>`;
          });
          html += '</ul>';
        }
        if (upcomingEvents.length > 0) {
          html += `<p><strong>Upcoming:</strong></p><ul style="margin:.3rem 0 .6rem 1rem;line-height:1.8">`;
          upcomingEvents.forEach(e => {
            const pri = e.priority === 'high' ? '🔴' : e.priority === 'low' ? '🟢' : '🔵';
            html += `<li>${pri} <strong>${e.title}</strong> — ${fmtDateTime(e.time)}</li>`;
          });
          html += '</ul>';
        }
        html += `<div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('schedule')">Open Schedule</button>
          <button class="msg-action-btn" onclick="handleUserMessage('What tasks are high priority?')">Show high priority</button>
        </div>`;
      }
      ariaReply(html, `Here's your schedule.`);
      break;
    }

    case 'add_event_quick': {
      const title = extractEventTitle(msg);
      const hasTime = /\bat\s+\d/.test(msg) || /\d+\s*(?:am|pm)/i.test(msg);
      const extracted = title || 'New Task';

      if (hasTime) {
        const timeMatch = msg.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
                          msg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
        const timeStr   = timeMatch ? timeMatch[1] : '';
        const now       = new Date();
        const parsed    = timeStr ? new Date(`${now.toDateString()} ${timeStr}`) : now;
        const isTomorrow = /tomorrow/i.test(msg);
        if (isTomorrow) parsed.setDate(parsed.getDate() + 1);

        if (!isNaN(parsed.getTime()) && parsed > new Date()) {
          const event = { id: uid(), title: extracted, time: parsed.toISOString(), duration: 30, priority: 'normal', category: 'work', done: false };
          state.events.push(event);
          saveState();
          updateSessionStats();
          renderSchedule();
          ariaReply(
            `✅ Done! I've added <strong>"${extracted}"</strong> to your schedule for <strong>${fmtDateTime(parsed.toISOString())}</strong>.
            <div class="msg-actions">
              <button class="msg-action-btn" onclick="switchTab('schedule')">View Schedule</button>
              <button class="msg-action-btn" onclick="handleUserMessage('What\\'s on my schedule today?')">Today's events</button>
            </div>`,
            `Added ${extracted} to your schedule.`
          );
          break;
        }
      }

      ariaReply(
        `I'd like to add <strong>"${extracted}"</strong> to your schedule. When should it happen? You can use the Schedule tab to set the exact date & time, or tell me something like <em>"add gym at 7am tomorrow"</em>.
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('schedule')">Open Schedule Tab</button>
        </div>`,
        `When should I schedule ${extracted}?`
      );
      break;
    }

    case 'add_event': {
      ariaReply(
        `I'll help you add an event! Please use the <strong>Schedule tab</strong> to set the title, date, time, duration, priority, and category — or tell me the details like: <em>"Add meeting at 3pm tomorrow"</em> and I'll handle it.
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('schedule')">Open Schedule</button>
        </div>`,
        `Please use the Schedule tab to add your event, or tell me the details.`
      );
      break;
    }

    case 'set_reminder': {
      ariaReply(
        `I can set a reminder for you! Head to the <strong>Reminders tab</strong> to configure it, or tell me: <em>"Remind me to take medicine at 8pm"</em>.
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('reminders')">Open Reminders</button>
        </div>`,
        `Please open the Reminders tab to set your reminder.`
      );
      break;
    }

    case 'create_goal': {
      ariaReply(
        `Great — let's create a goal! Head to the <strong>Goals tab</strong> where you can define it, set a deadline, and I'll <strong>break it into actionable tasks</strong> for you automatically.
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('goals')">Open Goals</button>
        </div>`,
        `Open the Goals tab to create a goal and I'll break it into tasks for you.`
      );
      break;
    }

    case 'breakdown': {
      const goalCount = state.goals.length;
      if (goalCount === 0) {
        ariaReply(
          `You don't have any goals yet. Let me help you create one first!
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="switchTab('goals')">Create a Goal</button>
          </div>`,
          `You don't have any goals yet. Create one in the Goals tab.`
        );
      } else {
        const goal = state.goals[state.goals.length - 1];
        ariaReply(
          `I can break down <strong>"${goal.title}"</strong> into tasks. Click below to trigger the AI breakdown:
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="switchTab('goals');setTimeout(()=>document.getElementById('ai-breakdown-btn').click(),300)">AI Break Down</button>
          </div>`,
          `I'll break down your latest goal into tasks.`
        );
      }
      break;
    }

    case 'show_priority': {
      const highPri = state.events.filter(e => e.priority === 'high' && !e.done && isUpcoming(e.time))
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      if (highPri.length === 0) {
        ariaReply(`✅ You have <strong>no high-priority tasks</strong> pending — you're on top of things!`, `No high priority tasks pending.`);
      } else {
        let html = `<p>🔴 You have <strong>${highPri.length}</strong> high-priority task${highPri.length > 1 ? 's' : ''}:</p><ul style="margin:.3rem 0 .6rem 1rem;line-height:1.8">`;
        highPri.forEach(e => { html += `<li><strong>${e.title}</strong> — ${fmtDateTime(e.time)}</li>`; });
        html += `</ul><div class="msg-actions"><button class="msg-action-btn" onclick="switchTab('schedule')">View Schedule</button></div>`;
        ariaReply(html, `You have ${highPri.length} high priority tasks.`);
      }
      break;
    }

    case 'tip': {
      const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
      ariaReply(
        `<p><strong>💡 Productivity Tip:</strong></p><p style="margin-top:.4rem">${tip}</p>
        <div class="msg-actions"><button class="msg-action-btn" onclick="handleUserMessage('Give me a productivity tip')">Another tip</button></div>`,
        tip.replace(/[^\w\s.,!?'-]/g, '')
      );
      break;
    }

    case 'joke': {
      const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
      ariaReply(`<p>${joke}</p>`, joke.replace(/[^\w\s.,!?'-]/g, ''));
      break;
    }

    case 'focus': {
      const now2 = new Date();
      const upcoming2 = state.events
        .filter(e => !e.done && new Date(e.time) > now2)
        .sort((a, b) => new Date(a.time) - new Date(b.time));
      const highNow = upcoming2.filter(e => e.priority === 'high');
      const focusTask = highNow[0] || upcoming2[0];

      if (!focusTask) {
        const tips2 = generateScheduleSuggestions();
        ariaReply(
          `<p>Your schedule is clear! Here's what I suggest:</p>
          <ul style="margin:.3rem 0 .6rem 1rem;line-height:1.8">${tips2.map(t => `<li>${t}</li>`).join('')}</ul>
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="handleUserMessage('Add a task for me')">Add a task</button>
            <button class="msg-action-btn" onclick="handleUserMessage('Help me plan my week')">Plan my week</button>
          </div>`,
          `Your schedule is clear. Here are some suggestions.`
        );
      } else {
        const suggestions = generateScheduleSuggestions();
        ariaReply(
          `<p>🎯 <strong>Focus on:</strong> <em>"${focusTask.title}"</em><br>
          Scheduled for ${fmtDateTime(focusTask.time)} · ${focusTask.duration} min · ${focusTask.priority} priority</p>
          <p style="margin-top:.5rem">${suggestions[0]}</p>
          <div class="msg-actions">
            <button class="msg-action-btn" onclick="switchTab('schedule')">View all tasks</button>
          </div>`,
          `Focus on ${focusTask.title}, scheduled for ${fmtDateTime(focusTask.time)}.`
        );
      }
      break;
    }

    case 'plan_week': {
      const weekEvents = state.events.filter(e => {
        const d = new Date(e.time);
        const now3 = new Date();
        const in7  = new Date(now3.getTime() + 7 * 86400000);
        return d >= now3 && d <= in7 && !e.done;
      }).sort((a, b) => new Date(a.time) - new Date(b.time));

      const totalMin = weekEvents.reduce((s, e) => s + (e.duration || 0), 0);
      const totalHrs = (totalMin / 60).toFixed(1);

      let html = `<p>📅 <strong>Your week at a glance:</strong></p>`;
      if (weekEvents.length === 0) {
        html += `<p>No events this week. Let's plan something!</p>`;
      } else {
        html += `<p>${weekEvents.length} event${weekEvents.length > 1 ? 's' : ''} · ${totalHrs} hours scheduled</p>
          <ul style="margin:.4rem 0 .6rem 1rem;line-height:1.9">`;
        weekEvents.slice(0, 8).forEach(e => {
          const pri = e.priority === 'high' ? '🔴' : e.priority === 'low' ? '🟢' : '🔵';
          html += `<li>${pri} <strong>${e.title}</strong> — ${fmtDate(e.time)}</li>`;
        });
        if (weekEvents.length > 8) html += `<li>… and ${weekEvents.length - 8} more</li>`;
        html += '</ul>';
      }
      html += `<p style="margin-top:.4rem">💡 <em>Tip: Aim for ≤6 hours of scheduled tasks per day to prevent burnout.</em></p>
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('schedule')">Open Schedule</button>
          <button class="msg-action-btn" onclick="handleUserMessage('Add a task for me')">Add event</button>
        </div>`;
      ariaReply(html, `You have ${weekEvents.length} events this week, totalling ${totalHrs} hours.`);
      break;
    }

    case 'insights': {
      switchTab('insights');
      renderInsights();
      ariaReply(
        `📊 I've opened the <strong>Insights</strong> tab with your productivity stats and AI-powered suggestions!`,
        `Here are your productivity insights.`
      );
      break;
    }

    case 'thanks': {
      ariaReply(`You're welcome! 😊 I'm always here to help you stay organized and productive. Is there anything else you need?`, `You're welcome!`);
      break;
    }

    case 'help': {
      ariaReply(
        `<p>Here's what I can do for you:</p>
        <ul style="margin:.4rem 0 .6rem 1rem;line-height:1.9">
          <li>📅 <strong>Show your schedule</strong> — "What's on my schedule today?"</li>
          <li>➕ <strong>Add events</strong> — "Add gym at 7am tomorrow"</li>
          <li>🔔 <strong>Set reminders</strong> — via the Reminders tab</li>
          <li>🎯 <strong>Create goals</strong> — with AI task breakdown</li>
          <li>🔴 <strong>Priority check</strong> — "What tasks are high priority?"</li>
          <li>🎯 <strong>Focus mode</strong> — "What should I focus on now?"</li>
          <li>📅 <strong>Week overview</strong> — "Help me plan my week"</li>
          <li>💡 <strong>Productivity tips</strong> — "Give me a tip"</li>
          <li>📊 <strong>Insights</strong> — "Show my insights"</li>
        </ul>
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="handleUserMessage('What\\'s on my schedule today?')">My schedule</button>
          <button class="msg-action-btn" onclick="handleUserMessage('Give me a productivity tip')">Get a tip</button>
        </div>`,
        `Here are the things I can help you with.`
      );
      break;
    }

    case 'delete_hint': {
      ariaReply(
        `To delete an event, reminder, or goal — find it in the respective tab and click the <strong>🗑 trash icon</strong>. Want me to show you?
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="switchTab('schedule')">Schedule</button>
          <button class="msg-action-btn" onclick="switchTab('goals')">Goals</button>
        </div>`,
        `Find the item in its tab and click the trash icon to delete it.`
      );
      break;
    }

    case 'complete_hint': {
      ariaReply(
        `To mark a task as done — find it in the <strong>Schedule tab</strong> and click the <strong>checkbox</strong> on the left.
        <div class="msg-actions"><button class="msg-action-btn" onclick="switchTab('schedule')">Open Schedule</button></div>`,
        `Find the task in the Schedule tab and click the checkbox to complete it.`
      );
      break;
    }

    default: {
      const suggestions = generateScheduleSuggestions();
      ariaReply(
        `<p>I'm not sure I understood that — but here's a helpful overview:</p>
        <ul style="margin:.4rem 0 .5rem 1rem;line-height:1.8">
          ${suggestions.map(s => `<li>${s}</li>`).join('')}
        </ul>
        <p style="margin-top:.3rem">Try asking me: <em>"What's on my schedule today?"</em>, <em>"Add a task"</em>, or <em>"Give me a productivity tip"</em>.</p>
        <div class="msg-actions">
          <button class="msg-action-btn" onclick="handleUserMessage('help')">See all commands</button>
        </div>`,
        `I'm not sure I understood. Try asking about your schedule or tasks.`
      );
      break;
    }
  }
}

/* Switch tab programmatically */
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');
  const sec = document.getElementById(`tab-${name}`);
  if (sec) sec.classList.add('active');
  if (name === 'insights') renderInsights();
  if (name === 'schedule') renderSchedule();
}

/* ═══════════════════════════════════════
   SCHEDULE MODULE
═══════════════════════════════════════ */
let currentFilter = 'all';
let currentView   = 'list';

/* View toggle */
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`schedule-${currentView}-view`).classList.add('active');
    if (currentView === 'week') renderWeekGrid();
  });
});

/* Filter buttons */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderSchedule();
  });
});

/* Add event form */
document.getElementById('schedule-form').addEventListener('submit', e => {
  e.preventDefault();
  const title    = document.getElementById('event-title').value.trim();
  const time     = document.getElementById('event-time').value;
  const duration = parseInt(document.getElementById('event-duration').value) || 30;
  const priority = document.getElementById('event-priority').value;
  const category = document.getElementById('event-category').value;

  if (!title || !time) return;

  const event = { id: uid(), title, time, duration, priority, category, done: false };
  state.events.push(event);
  saveState();
  e.target.reset();
  document.getElementById('event-duration').value = 30;
  renderSchedule();
  updateSessionStats();
  showToast(`✅ "${title}" added to schedule`);
});

function renderSchedule() {
  let events = [...state.events];

  switch (currentFilter) {
    case 'today':    events = events.filter(e => isToday(e.time)); break;
    case 'upcoming': events = events.filter(e => isUpcoming(e.time)); break;
    case 'high':     events = events.filter(e => e.priority === 'high'); break;
  }

  events.sort((a, b) => new Date(a.time) - new Date(b.time));

  const list = document.getElementById('schedule-list');
  list.innerHTML = '';

  if (events.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:2rem">No events. Add one above or ask ARIA!</p>`;
    return;
  }

  events.forEach(ev => {
    const card = document.createElement('div');
    card.className = `item-card ${ev.priority}${ev.done ? ' done' : ''}`;
    card.dataset.id = ev.id;

    card.innerHTML = `
      <div class="item-check ${ev.done ? 'checked' : ''}" data-id="${ev.id}"></div>
      <div class="item-body">
        <div class="item-title">${esc(ev.title)}</div>
        <div class="item-meta">
          <span>📅 ${fmtDateTime(ev.time)}</span>
          <span>⏱ ${ev.duration} min</span>
          <span class="item-badge badge-${ev.priority}">${ev.priority}</span>
          <span class="item-badge badge-${ev.category}">${ev.category}</span>
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-action del" title="Delete" data-del="${ev.id}"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(card);
  });

  /* Checkbox toggle */
  list.querySelectorAll('.item-check').forEach(chk => {
    chk.addEventListener('click', () => {
      const id = chk.dataset.id;
      const ev = state.events.find(e => e.id === id);
      if (ev) { ev.done = !ev.done; saveState(); renderSchedule(); updateInsightsBadge(); }
    });
  });

  /* Delete */
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.del;
      state.events = state.events.filter(e => e.id !== id);
      saveState();
      renderSchedule();
      updateSessionStats();
      showToast('🗑 Event removed');
    });
  });
}

function renderWeekGrid() {
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const day = new Date(today.getTime() + i * 86400000);
    const col  = document.createElement('div');
    col.className = 'week-day' + (i === 0 ? ' today' : '');

    const dayLabel = day.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
    col.innerHTML = `<div class="week-day-header">${dayLabel}</div>`;

    const dayEvents = state.events
      .filter(e => new Date(e.time).toDateString() === day.toDateString())
      .sort((a, b) => new Date(a.time) - new Date(b.time));

    dayEvents.forEach(ev => {
      const t = new Date(ev.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const el = document.createElement('div');
      el.className = `week-event ${ev.priority}`;
      el.textContent = `${t} ${ev.title}`;
      el.title = `${ev.title} · ${ev.duration} min`;
      col.appendChild(el);
    });

    grid.appendChild(col);
  }
}

/* ═══════════════════════════════════════
   GOALS MODULE
═══════════════════════════════════════ */

/* AI breakdown templates */
const BREAKDOWNS = {
  learn: ['Research resources & books', 'Set up learning environment', 'Complete beginner module', 'Practice exercises daily', 'Build a mini-project', 'Review & consolidate knowledge', 'Share or apply learnings'],
  fitness: ['Consult doctor / set baseline', 'Create workout schedule', 'Week 1–2: Light training', 'Week 3–4: Increase intensity', 'Track progress weekly', 'Adjust diet & recovery', 'Hit milestone & celebrate'],
  work: ['Define scope & deliverables', 'Break into milestones', 'Schedule daily work blocks', 'Complete first milestone', 'Review & iterate', 'Final polish & delivery'],
  financial: ['Assess current finances', 'Set specific saving target', 'Track daily expenses', 'Cut unnecessary subscriptions', 'Automate savings', 'Invest surplus wisely', 'Review monthly'],
  personal: ['Clarify what success looks like', 'Identify first small step', 'Build daily habit', 'Check in weekly', 'Adjust approach if needed', 'Celebrate small wins'],
  default: ['Define success criteria', 'Research & gather resources', 'Break into weekly milestones', 'Schedule focused work blocks', 'Track weekly progress', 'Review and adjust', 'Celebrate completion'],
};

function getBreakdownTasks(goal) {
  const cat = goal.category || 'default';
  const key = cat === 'learning' ? 'learn' : cat === 'health' ? 'fitness' : cat === 'financial' ? 'financial' : cat === 'work' ? 'work' : cat === 'personal' ? 'personal' : 'default';
  const pool = BREAKDOWNS[key] || BREAKDOWNS.default;
  return pool.map(t => ({ id: uid(), text: t, done: false }));
}

document.getElementById('goal-form').addEventListener('submit', e => {
  e.preventDefault();
  const title       = document.getElementById('goal-title').value.trim();
  const description = document.getElementById('goal-description').value.trim();
  const deadline    = document.getElementById('goal-deadline').value;
  const category    = document.getElementById('goal-category').value;

  if (!title) return;

  const goal = { id: uid(), title, description, deadline, category, tasks: [], createdAt: Date.now() };
  state.goals.push(goal);
  saveState();
  e.target.reset();
  renderGoals();
  updateSessionStats();
  showToast(`🎯 Goal "${title}" created`);
});

document.getElementById('ai-breakdown-btn').addEventListener('click', () => {
  const title    = document.getElementById('goal-title').value.trim();
  const category = document.getElementById('goal-category').value;

  let targetGoal;
  if (title) {
    const tmp = { id: uid(), title, category, tasks: [] };
    targetGoal = tmp;
    /* Add it if not already submitted */
    if (!state.goals.find(g => g.title === title)) {
      const description = document.getElementById('goal-description').value.trim();
      const deadline    = document.getElementById('goal-deadline').value;
      Object.assign(tmp, { description, deadline, createdAt: Date.now() });
      state.goals.push(tmp);
      saveState();
      updateSessionStats();
      document.getElementById('goal-form').reset();
      showToast(`🎯 Goal "${title}" created`);
    }
  } else if (state.goals.length > 0) {
    targetGoal = state.goals[state.goals.length - 1];
  } else {
    showToast('Please enter a goal title first.');
    return;
  }

  targetGoal.tasks = getBreakdownTasks(targetGoal);
  saveState();
  renderGoals();
  showToast(`✨ AI broke down "${targetGoal.title}" into ${targetGoal.tasks.length} tasks`);

  /* Chat feedback */
  ariaReply(
    `✨ I've broken down <strong>"${targetGoal.title}"</strong> into <strong>${targetGoal.tasks.length} actionable tasks</strong>! Head to the Goals tab to see them.
    <div class="msg-actions"><button class="msg-action-btn" onclick="switchTab('goals')">View Goal</button></div>`,
    `I've broken down ${targetGoal.title} into ${targetGoal.tasks.length} actionable tasks.`
  );
  switchTab('goals');
});

function renderGoals() {
  const list = document.getElementById('goals-list');
  list.innerHTML = '';

  if (state.goals.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:2rem">No goals yet. Create one above!</p>`;
    return;
  }

  state.goals.forEach(goal => {
    const total    = goal.tasks.length;
    const done     = goal.tasks.filter(t => t.done).length;
    const progress = total ? Math.round((done / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'goal-card';
    card.dataset.id = goal.id;

    const catColors = { work: '#06b6d4', personal: '#f59e0b', health: '#10b981', learning: '#a78bfa', financial: '#ec4899' };
    const color = catColors[goal.category] || '#a78bfa';

    card.innerHTML = `
      <div class="goal-header">
        <div class="goal-title">${esc(goal.title)}</div>
        <span class="item-badge badge-${goal.category}">${goal.category}</span>
        <div class="item-actions">
          <button class="icon-action" title="AI breakdown" data-expand="${goal.id}"><i class="fas fa-magic"></i></button>
          <button class="icon-action del" title="Delete" data-del-goal="${goal.id}"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      ${goal.description ? `<p style="font-size:.82rem;color:var(--text-dim);margin-bottom:.4rem">${esc(goal.description)}</p>` : ''}
      <div class="goal-meta">
        ${goal.deadline ? `<span>🗓 Deadline: ${fmtDate(goal.deadline)}</span>` : ''}
        ${total ? `<span>${done}/${total} tasks completed</span>` : '<span>No tasks yet — click ✨ to generate</span>'}
      </div>
      ${total ? `<div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${progress}%;background:${color}"></div></div>` : ''}
      <div class="goal-tasks">
        ${goal.tasks.map(t => `
          <label class="goal-task-item ${t.done ? 'done' : ''}">
            <input type="checkbox" data-goal="${goal.id}" data-task="${t.id}" ${t.done ? 'checked' : ''} />
            ${esc(t.text)}
          </label>`).join('')}
      </div>`;
    list.appendChild(card);
  });

  /* Task checkboxes */
  list.querySelectorAll('[data-task]').forEach(chk => {
    chk.addEventListener('change', () => {
      const goal = state.goals.find(g => g.id === chk.dataset.goal);
      if (!goal) return;
      const task = goal.tasks.find(t => t.id === chk.dataset.task);
      if (task) { task.done = chk.checked; saveState(); renderGoals(); }
    });
  });

  /* AI expand */
  list.querySelectorAll('[data-expand]').forEach(btn => {
    btn.addEventListener('click', () => {
      const goal = state.goals.find(g => g.id === btn.dataset.expand);
      if (!goal) return;
      goal.tasks = getBreakdownTasks(goal);
      saveState();
      renderGoals();
      showToast(`✨ AI tasks generated for "${goal.title}"`);
    });
  });

  /* Delete goal */
  list.querySelectorAll('[data-del-goal]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.goals = state.goals.filter(g => g.id !== btn.dataset.delGoal);
      saveState();
      renderGoals();
      updateSessionStats();
      showToast('🗑 Goal removed');
    });
  });
}

/* ═══════════════════════════════════════
   REMINDERS MODULE
═══════════════════════════════════════ */
const notifBanner = document.getElementById('notif-banner');

function checkNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') notifBanner.style.display = 'flex';
  else notifBanner.style.display = 'none';
}
checkNotifPermission();

document.getElementById('enable-notif').addEventListener('click', () => {
  Notification.requestPermission().then(() => checkNotifPermission());
});

document.getElementById('reminder-form').addEventListener('submit', e => {
  e.preventDefault();
  const title  = document.getElementById('reminder-title').value.trim();
  const time   = document.getElementById('reminder-time').value;
  const repeat = document.getElementById('reminder-repeat').value;
  if (!title || !time) return;

  const reminder = { id: uid(), title, time, repeat, triggered: false };
  state.reminders.push(reminder);
  saveState();
  e.target.reset();
  renderReminders();
  updateSessionStats();
  showToast(`🔔 Reminder set for ${fmtDateTime(time)}`);
});

function renderReminders() {
  const list = document.getElementById('reminder-list');
  list.innerHTML = '';
  const sorted = [...state.reminders].sort((a, b) => new Date(a.time) - new Date(b.time));

  if (sorted.length === 0) {
    list.innerHTML = `<p style="color:var(--text-dim);text-align:center;padding:2rem">No reminders set.</p>`;
    return;
  }

  sorted.forEach(rem => {
    const past = new Date(rem.time) < new Date();
    const card = document.createElement('div');
    card.className = `item-card${past ? ' done' : ''}`;
    card.innerHTML = `
      <div class="item-body">
        <div class="item-title">${esc(rem.title)}</div>
        <div class="item-meta">
          <span>🔔 ${fmtDateTime(rem.time)}</span>
          ${rem.repeat !== 'none' ? `<span class="item-badge badge-work">${rem.repeat}</span>` : ''}
          ${past ? `<span style="color:var(--text-dim)">Passed</span>` : ''}
        </div>
      </div>
      <div class="item-actions">
        <button class="icon-action del" title="Delete" data-del-rem="${rem.id}"><i class="fas fa-trash"></i></button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-del-rem]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.reminders = state.reminders.filter(r => r.id !== btn.dataset.delRem);
      saveState();
      renderReminders();
      updateSessionStats();
      showToast('🗑 Reminder removed');
    });
  });
}

/* Reminder checker (every 30s) */
function checkReminders() {
  const now = new Date();
  state.reminders.forEach(rem => {
    if (rem.triggered) return;
    const t = new Date(rem.time);
    if (t <= now) {
      rem.triggered = true;
      showToast(`🔔 Reminder: ${rem.title}`);
      speak(`Reminder: ${rem.title}`);
      if (Notification.permission === 'granted') {
        new Notification('ARIA Reminder', { body: rem.title, icon: '' });
      }
      if (rem.repeat === 'daily') {
        rem.time = new Date(t.getTime() + 86400000).toISOString().slice(0, 16);
        rem.triggered = false;
      } else if (rem.repeat === 'weekly') {
        rem.time = new Date(t.getTime() + 7 * 86400000).toISOString().slice(0, 16);
        rem.triggered = false;
      }
      saveState();
    }
  });
}
setInterval(checkReminders, 30000);
checkReminders();

/* ═══════════════════════════════════════
   INSIGHTS MODULE
═══════════════════════════════════════ */
function updateInsightsBadge() {
  const total     = state.events.length;
  const completed = state.events.filter(e => e.done).length;
  const hours     = (state.events.reduce((s, e) => s + (e.duration || 0), 0) / 60).toFixed(1);

  document.getElementById('ins-total-tasks').textContent = total;
  document.getElementById('ins-completed').textContent   = completed;
  document.getElementById('ins-streak').textContent      = state.streak;
  document.getElementById('ins-hours').textContent       = hours + 'h';
}

function renderInsights() {
  updateInsightsBadge();

  /* Category chart */
  const cats = { work: 0, personal: 0, health: 0, learning: 0, social: 0 };
  state.events.forEach(e => { if (cats[e.category] !== undefined) cats[e.category]++; });
  const maxVal = Math.max(...Object.values(cats), 1);

  const catColors = { work: '#06b6d4', personal: '#f59e0b', health: '#10b981', learning: '#a78bfa', social: '#ec4899' };
  const catIcons  = { work: '💼', personal: '🏠', health: '💪', learning: '📚', social: '👥' };

  const chart = document.getElementById('category-chart');
  chart.innerHTML = Object.entries(cats).map(([cat, count]) => `
    <div class="cat-bar">
      <span class="cat-bar-label">${catIcons[cat]} ${cat}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(count / maxVal) * 100}%;background:${catColors[cat]}"></div></div>
      <span class="cat-bar-count">${count}</span>
    </div>`).join('');

  /* AI suggestions */
  const suggs = generateScheduleSuggestions();
  const goalPct = state.goals.length ? state.goals.map(g => {
    const total = g.tasks.length;
    const done  = g.tasks.filter(t => t.done).length;
    return total ? Math.round((done / total) * 100) : 0;
  }) : [];

  const extraSuggs = [];
  if (goalPct.length > 0 && goalPct.some(p => p < 50))
    extraSuggs.push('📌 Some goals are less than 50% complete — schedule dedicated work blocks this week.');
  if (state.events.filter(e => !e.done && isUpcoming(e.time)).length > 10)
    extraSuggs.push('⚠️ You have many pending tasks — consider reprioritising or delegating some.');
  if (state.reminders.filter(r => !r.triggered).length === 0)
    extraSuggs.push('🔔 No active reminders — set one to stay on track.');

  const allSuggs = [...suggs, ...extraSuggs];
  document.getElementById('ai-suggestions').innerHTML = allSuggs.map(s => `
    <div class="suggestion-item"><i class="fas fa-robot"></i><span>${s}</span></div>`).join('');
}

/* ═══════════════════════════════════════
   HTML ESCAPE
═══════════════════════════════════════ */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ═══════════════════════════════════════
   INITIAL RENDER
═══════════════════════════════════════ */
renderSchedule();
renderGoals();
renderReminders();
updateSessionStats();

/* Welcome message */
(function welcome() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const upcoming = state.events.filter(e => isToday(e.time) && !e.done);
  const upcomingText = upcoming.length
    ? ` You have <strong>${upcoming.length} task${upcoming.length > 1 ? 's' : ''}</strong> scheduled today.`
    : ' Your schedule is clear today.';

  ariaReply(
    `${greeting}! I'm <strong>ARIA</strong> — your Agentic AI Schedule Assistant. I can help you <em>plan your day, break down goals, set reminders,</em> and give <em>smart productivity suggestions</em>.${upcomingText}
    <div class="msg-actions">
      <button class="msg-action-btn" onclick="handleUserMessage('What\\'s on my schedule today?')">Today's schedule</button>
      <button class="msg-action-btn" onclick="handleUserMessage('help')">What can you do?</button>
      <button class="msg-action-btn" onclick="handleUserMessage('Give me a productivity tip')">Productivity tip</button>
    </div>`,
    `${greeting}! I'm ARIA, your AI schedule assistant. ${upcoming.length ? `You have ${upcoming.length} tasks today.` : 'Your schedule is clear today.'} How can I help?`,
    300
  );
})();
