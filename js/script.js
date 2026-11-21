/**
 * =====================================================
 *  To-Do List Life Dashboard — script.js
 *  CodingCamp Software Engineering
 * =====================================================
 *  1.  Constants & State
 *  2.  Utility Helpers
 *  3.  Local Storage Helpers
 *  4.  Theme  (Challenge 1 — Light/Dark Mode)
 *  5.  Clock & Greeting
 *  6.  Custom Name  (Challenge 2)
 *  7.  Focus Timer  (Challenge 3 — Change Duration)
 *  8.  To-Do List
 *  9.  Quick Links
 * 10.  Toast Notifications
 * 11.  Init / Bootstrap
 */

/* =====================================================
   1. CONSTANTS & STATE
   ===================================================== */
const STORAGE_KEYS = {
  THEME:    'ldash_theme',
  NAME:     'ldash_name',
  TODOS:    'ldash_todos',
  LINKS:    'ldash_links',
  DURATION: 'ldash_duration',
};

const DEFAULT_LINKS = [
  { id: 'g',  name: 'Google',  url: 'https://google.com' },
  { id: 'yt', name: 'YouTube', url: 'https://youtube.com' },
  { id: 'gm', name: 'Gmail',   url: 'https://mail.google.com' },
  { id: 'gh', name: 'GitHub',  url: 'https://github.com' },
];

const state = {
  theme:          'dark',
  userName:       '',
  timerDuration:  25,       // minutes
  timerRemaining: 25 * 60,  // seconds
  timerInterval:  null,
  timerRunning:   false,
  todos:          [],
  todoFilter:     'all',
  editingTodoId:  null,
  links:          [],
};

/* =====================================================
   2. UTILITY HELPERS
   ===================================================== */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function isValidUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(raw) {
  const s = raw.trim();
  return (s.startsWith('http://') || s.startsWith('https://')) ? s : 'https://' + s;
}

function getFaviconUrl(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

/* =====================================================
   3. LOCAL STORAGE HELPERS
   ===================================================== */

function saveToStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('Storage write failed:', e); }
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/* =====================================================
   4. THEME — LIGHT / DARK MODE  (Challenge 1)
   ===================================================== */

const themeToggleBtn = document.getElementById('themeToggle');
const themeIconEl    = document.getElementById('themeIcon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeIconEl.className    = theme === 'light' ? 'fas fa-sun'  : 'fas fa-moon';
  themeToggleBtn.title     = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
  themeToggleBtn.ariaLabel = themeToggleBtn.title;
  state.theme = theme;
}

function toggleTheme() {
  const next = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveToStorage(STORAGE_KEYS.THEME, next);
  showToast(next === 'light' ? '☀️ Light mode activated' : '🌙 Dark mode activated', 'info');
}

themeToggleBtn.addEventListener('click', toggleTheme);

/* =====================================================
   5. CLOCK & GREETING
   ===================================================== */

const clockEl    = document.getElementById('clock');
const dateDayEl  = document.getElementById('dateDay');
const dateFullEl = document.getElementById('dateFull');
const greetingEl = document.getElementById('greetingText');

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function getGreeting(h) {
  if (h >= 5  && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 21) return 'Good Evening';
  return 'Good Night';
}

function updateClock() {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  clockEl.textContent    = `${pad(h)}:${pad(m)}:${pad(s)}`;
  dateDayEl.textContent  = DAYS[now.getDay()];
  dateFullEl.textContent = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  greetingEl.textContent = getGreeting(h);
}

updateClock();
setInterval(updateClock, 1000);

/* =====================================================
   6. CUSTOM NAME IN GREETING  (Challenge 2)
   ===================================================== */

const nameInputEl    = document.getElementById('nameInput');
const saveNameBtn    = document.getElementById('saveNameBtn');
const greetingNameEl = document.getElementById('greetingName');

function displayName(name) {
  greetingNameEl.textContent = (name && name.trim()) ? name.trim() : 'Friend';
}

function saveName() {
  const val = nameInputEl.value.trim();
  if (!val) { showToast('Please enter your name first!', 'error'); nameInputEl.focus(); return; }
  state.userName = val;
  saveToStorage(STORAGE_KEYS.NAME, val);
  displayName(val);
  showToast(`👋 Hello, ${val}! Name saved.`, 'success');
}

saveNameBtn.addEventListener('click', saveName);
nameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });

/* =====================================================
   7. FOCUS TIMER — POMODORO  (Challenge 3)
   ===================================================== */

const timerDisplayEl      = document.getElementById('timerDisplay');
const startBtn            = document.getElementById('startBtn');
const stopBtn             = document.getElementById('stopBtn');
const resetBtn            = document.getElementById('resetBtn');
const timerStatusBadge    = document.getElementById('timerStatusBadge');
const timerProgressCircle = document.getElementById('timerProgressCircle');
const timerRingEl         = document.querySelector('.timer-ring');
const durationBtns        = document.querySelectorAll('.duration-btn');
const modalOverlay        = document.getElementById('modalOverlay');
const modalCloseBtn       = document.getElementById('modalClose');

/* SVG circle: r=52, circumference = 2π×52 */
const CIRCUMFERENCE = 2 * Math.PI * 52;
timerProgressCircle.style.strokeDasharray = CIRCUMFERENCE;

function updateTimerRing(remaining, total) {
  const offset = CIRCUMFERENCE * (1 - (total > 0 ? remaining / total : 0));
  timerProgressCircle.style.strokeDashoffset = offset;
}

function renderTimerDisplay() {
  const mins = Math.floor(state.timerRemaining / 60);
  const secs = state.timerRemaining % 60;
  timerDisplayEl.textContent = `${pad(mins)}:${pad(secs)}`;
  updateTimerRing(state.timerRemaining, state.timerDuration * 60);
  document.title = state.timerRunning
    ? `⏱ ${pad(mins)}:${pad(secs)} — Life Dashboard`
    : 'Life Dashboard';
}

function setTimerBadge(text, type) {
  timerStatusBadge.textContent = text;
  timerStatusBadge.className   = `badge badge-${type}`;
}

/* Start */
function startTimer() {
  if (state.timerRunning) return;
  if (state.timerRemaining <= 0) { showToast('Press Reset first.', 'error'); return; }
  state.timerRunning = true;
  startBtn.disabled  = true;
  stopBtn.disabled   = false;
  timerRingEl.classList.add('running');
  setTimerBadge('Running', 'success');

  state.timerInterval = setInterval(() => {
    state.timerRemaining--;
    renderTimerDisplay();
    if (state.timerRemaining <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      state.timerRunning  = false;
      startBtn.disabled   = false;
      stopBtn.disabled    = true;
      timerRingEl.classList.remove('running');
      setTimerBadge('Done! 🎉', 'warning');
      onTimerComplete();
    }
  }, 1000);
}

/* Pause */
function stopTimer() {
  if (!state.timerRunning) return;
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.timerRunning  = false;
  startBtn.disabled   = false;
  stopBtn.disabled    = true;
  timerRingEl.classList.remove('running');
  setTimerBadge('Paused', 'warning');
  document.title = 'Life Dashboard';
}

/* Reset */
function resetTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval  = null;
  state.timerRunning   = false;
  state.timerRemaining = state.timerDuration * 60;
  startBtn.disabled    = false;
  stopBtn.disabled     = true;
  timerRingEl.classList.remove('running');
  setTimerBadge('Ready', 'primary');
  renderTimerDisplay();
  document.title = 'Life Dashboard';
}

/* Timer complete */
function onTimerComplete() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus Timer Complete! 🎉', {
      body: `Your ${state.timerDuration}-minute session is done. Take a break!`,
    });
  }
  modalOverlay.classList.add('open');
  showToast('⏰ Focus session complete! Great work!', 'success');
  document.title = 'Life Dashboard';
}

/* Set duration (Challenge 3) */
function setDuration(minutes) {
  if (state.timerRunning) { showToast('Pause the timer before changing duration.', 'error'); return; }
  state.timerDuration  = minutes;
  state.timerRemaining = minutes * 60;
  saveToStorage(STORAGE_KEYS.DURATION, minutes);
  durationBtns.forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.minutes, 10) === minutes);
    b.setAttribute('aria-pressed', parseInt(b.dataset.minutes, 10) === minutes ? 'true' : 'false');
  });
  resetTimer();
  showToast(`⏱ Timer set to ${minutes} minutes.`, 'info');
}

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click',  stopTimer);
resetBtn.addEventListener('click', resetTimer);
durationBtns.forEach((b) => b.addEventListener('click', () => setDuration(parseInt(b.dataset.minutes, 10))));

modalCloseBtn.addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click',  (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });

/* Request notification permission on first click */
document.addEventListener('click', function reqNotif() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  document.removeEventListener('click', reqNotif);
}, { once: true });

/* =====================================================
   8. TO-DO LIST
   ===================================================== */

const todoInputEl       = document.getElementById('todoInput');
const addTodoBtnEl      = document.getElementById('addTodoBtn');
const todoListEl        = document.getElementById('todoList');
const todoEmptyEl       = document.getElementById('todoEmpty');
const todoCountEl       = document.getElementById('todoCount');
const todoDoneCountEl   = document.getElementById('todoDoneCount');
const todoFooterEl      = document.getElementById('todoFooter');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const filterBtns        = document.querySelectorAll('.filter-btn');

const editModalOverlay  = document.getElementById('editModalOverlay');
const editTaskInput     = document.getElementById('editTaskInput');
const saveEditBtn       = document.getElementById('saveEditBtn');
const cancelEditBtn     = document.getElementById('cancelEditBtn');

function saveTodos() { saveToStorage(STORAGE_KEYS.TODOS, state.todos); }

/* Add */
function addTodo(text) {
  const t = text.trim();
  if (!t) { showToast('Task cannot be empty!', 'error'); todoInputEl.focus(); return; }
  state.todos.unshift({ id: uid(), text: t, completed: false, createdAt: Date.now() });
  saveTodos();
  renderTodoList();
  todoInputEl.value = '';
  todoInputEl.focus();
  showToast('✅ Task added!', 'success');
}

/* Toggle complete */
function toggleTodo(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  renderTodoList();
}

/* Delete */
function deleteTodo(id) {
  state.todos = state.todos.filter((t) => t.id !== id);
  saveTodos();
  renderTodoList();
  showToast('🗑️ Task deleted.', 'info');
}

/* Open edit modal */
function openEditModal(id) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  state.editingTodoId = id;
  editTaskInput.value = todo.text;
  editModalOverlay.classList.add('open');
  editTaskInput.focus();
  editTaskInput.select();
}

/* Save edit */
function saveEdit() {
  const val = editTaskInput.value.trim();
  if (!val) { showToast('Task cannot be empty!', 'error'); editTaskInput.focus(); return; }
  const todo = state.todos.find((t) => t.id === state.editingTodoId);
  if (todo) { todo.text = val; saveTodos(); renderTodoList(); showToast('✏️ Task updated!', 'success'); }
  closeEditModal();
}

function closeEditModal() {
  editModalOverlay.classList.remove('open');
  state.editingTodoId = null;
  editTaskInput.value = '';
}

/* Clear completed */
function clearCompleted() {
  const count = state.todos.filter((t) => t.completed).length;
  if (!count) return;
  state.todos = state.todos.filter((t) => !t.completed);
  saveTodos();
  renderTodoList();
  showToast(`🗑️ Cleared ${count} completed task${count > 1 ? 's' : ''}.`, 'info');
}

/* Filter */
function getFilteredTodos() {
  if (state.todoFilter === 'active')    return state.todos.filter((t) => !t.completed);
  if (state.todoFilter === 'completed') return state.todos.filter((t) =>  t.completed);
  return state.todos;
}

/* Render */
function renderTodoList() {
  const filtered  = getFilteredTodos();
  const totalDone = state.todos.filter((t) => t.completed).length;

  todoCountEl.textContent     = `${state.todos.length} task${state.todos.length !== 1 ? 's' : ''}`;
  todoDoneCountEl.textContent = `${totalDone} done`;
  todoFooterEl.style.display  = totalDone > 0 ? 'block' : 'none';

  if (filtered.length === 0) {
    todoListEl.innerHTML      = '';
    todoEmptyEl.style.display = 'flex';
    return;
  }
  todoEmptyEl.style.display = 'none';

  todoListEl.innerHTML = filtered.map((todo) => `
    <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}
             aria-label="Mark as done" data-action="toggle" />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <div class="todo-actions">
        <button class="todo-btn todo-btn-edit"   title="Edit"   data-action="edit"><i class="fas fa-pen"></i></button>
        <button class="todo-btn todo-btn-delete" title="Delete" data-action="delete"><i class="fas fa-trash"></i></button>
      </div>
    </li>
  `).join('');
}

/* Event delegation */
todoListEl.addEventListener('click', (e) => {
  const item   = e.target.closest('[data-id]');
  if (!item) return;
  const id     = item.dataset.id;
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'toggle') toggleTodo(id);
  if (action === 'edit')   openEditModal(id);
  if (action === 'delete') deleteTodo(id);
});

addTodoBtnEl.addEventListener('click', () => addTodo(todoInputEl.value));
todoInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(todoInputEl.value); });

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.todoFilter = btn.dataset.filter;
    filterBtns.forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    renderTodoList();
  });
});

clearCompletedBtn.addEventListener('click', clearCompleted);

saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);
editModalOverlay.addEventListener('click', (e) => { if (e.target === editModalOverlay) closeEditModal(); });
editTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter')  saveEdit();
  if (e.key === 'Escape') closeEditModal();
});

/* =====================================================
   9. QUICK LINKS
   ===================================================== */

const linkNameEl  = document.getElementById('linkName');
const linkUrlEl   = document.getElementById('linkUrl');
const addLinkBtn  = document.getElementById('addLinkBtn');
const linksGridEl = document.getElementById('linksGrid');
const linkErrorEl = document.getElementById('linkError');

function saveLinks() { saveToStorage(STORAGE_KEYS.LINKS, state.links); }

/* Add link */
function addLink() {
  linkErrorEl.textContent = '';
  const name = linkNameEl.value.trim();
  const raw  = linkUrlEl.value.trim();

  if (!name) { linkErrorEl.textContent = 'Please enter a site name.'; linkNameEl.focus(); return; }
  if (!raw)  { linkErrorEl.textContent = 'Please enter a URL.'; linkUrlEl.focus(); return; }

  const url = normalizeUrl(raw);
  if (!isValidUrl(url)) { linkErrorEl.textContent = 'Invalid URL. Example: https://example.com'; linkUrlEl.focus(); return; }
  if (state.links.some((l) => l.url === url)) { linkErrorEl.textContent = 'This URL is already added.'; return; }

  state.links.push({ id: uid(), name, url });
  saveLinks();
  renderLinks();
  linkNameEl.value = '';
  linkUrlEl.value  = '';
  linkNameEl.focus();
  showToast(`🔗 "${name}" added!`, 'success');
}

/* Delete link */
function deleteLink(id) {
  state.links = state.links.filter((l) => l.id !== id);
  saveLinks();
  renderLinks();
  showToast('🗑️ Link removed.', 'info');
}

/* Render links */
function renderLinks() {
  if (state.links.length === 0) {
    linksGridEl.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">No quick links yet. Add one above!</p>`;
    return;
  }
  linksGridEl.innerHTML = state.links.map((link) => {
    const fav = getFaviconUrl(link.url);
    return `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
         class="link-card" title="${escapeHtml(link.url)}" data-id="${link.id}">
        ${fav
          ? `<img src="${fav}" class="link-favicon" alt="" onerror="this.style.display='none'" />`
          : `<i class="fas fa-globe" style="font-size:0.9rem;color:var(--purple-400)"></i>`}
        <span>${escapeHtml(link.name)}</span>
        <button class="link-delete" title="Remove" data-action="delete" data-id="${link.id}">
          <i class="fas fa-times"></i>
        </button>
      </a>`;
  }).join('');
}

/* Event delegation — delete button inside anchor */
linksGridEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (btn) { e.preventDefault(); e.stopPropagation(); deleteLink(btn.dataset.id); }
});

addLinkBtn.addEventListener('click', addLink);
[linkNameEl, linkUrlEl].forEach((inp) => {
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addLink(); });
  inp.addEventListener('input',   ()  => { linkErrorEl.textContent = ''; });
});

/* =====================================================
   10. TOAST NOTIFICATIONS
   ===================================================== */

const toastEl = document.getElementById('toast');
let toastTimeout = null;

function showToast(message, type = 'info', duration = 3000) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastEl.textContent = message;
  toastEl.className   = `toast ${type} show`;
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
}

/* =====================================================
   11. INIT / BOOTSTRAP
   ===================================================== */

function init() {
  /* Theme */
  applyTheme(loadFromStorage(STORAGE_KEYS.THEME, 'dark'));

  /* Name */
  const savedName = loadFromStorage(STORAGE_KEYS.NAME, '');
  if (savedName) { state.userName = savedName; nameInputEl.value = savedName; displayName(savedName); }

  /* Timer duration */
  const savedDuration = loadFromStorage(STORAGE_KEYS.DURATION, 25);
  state.timerDuration  = savedDuration;
  state.timerRemaining = savedDuration * 60;
  durationBtns.forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.minutes, 10) === savedDuration);
    b.setAttribute('aria-pressed', parseInt(b.dataset.minutes, 10) === savedDuration ? 'true' : 'false');
  });
  renderTimerDisplay();

  /* Todos */
  state.todos = loadFromStorage(STORAGE_KEYS.TODOS, []);
  renderTodoList();

  /* Links */
  const savedLinks = loadFromStorage(STORAGE_KEYS.LINKS, null);
  state.links = savedLinks !== null ? savedLinks : [...DEFAULT_LINKS];
  if (savedLinks === null) saveLinks();
  renderLinks();
}

/* Run after DOM is ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
