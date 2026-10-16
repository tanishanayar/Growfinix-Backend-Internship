/* ============ Helpers ============ */
const $ = (id) => document.getElementById(id);
const api = async (url, opts) => {
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (e) {
    return { res: { ok: false, headers: new Headers() }, data: { error: 'Cannot reach server' } };
  }
};
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ============ Navigation ============ */
const titles = {
  overview: ['Overview', 'Everything about this project in one place'],
  chat: ['Real-Time Chat', 'Task 1 · Socket.io WebSockets'],
  products: ['Product Search', 'Task 2 Redis caching · Task 5 advanced queries'],
  register: ['Register & Email Queue', 'Task 3 · BullMQ background jobs'],
  ai: ['AI Analyzer', 'Task 4 · Sentiment analysis & summarization']
};
function openTab(name) {
  document.querySelectorAll('.nav').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.id === name));
  $('page-title').textContent = titles[name][0];
  $('page-sub').textContent = titles[name][1];
  $('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'overview') loadHealth();
  if (name === 'register') loadQueue();
}
document.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.go)));
$('menu-btn').addEventListener('click', () => $('sidebar').classList.toggle('open'));

/* Theme */
const savedTheme = localStorage.getItem('theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
const syncThemeIcon = () => ($('theme-btn').textContent = document.documentElement.dataset.theme === 'dark' ? '☀️' : '🌙');
syncThemeIcon();
$('theme-btn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
  syncThemeIcon();
});

/* ============ Overview / health ============ */
async function loadHealth() {
  const { data } = await api('/api/health');
  const show = (id, pillId, v) => {
    $(id).textContent = (v || 'down').toUpperCase();
    $(id).className = v === 'up' ? 'up' : 'down';
    $(pillId).className = 'pill ' + (v === 'up' ? 'up' : 'down');
  };
  show('st-server', 'pill-server', data.server);
  show('st-db', 'pill-db', data.database);
  show('st-redis', 'pill-redis', data.redis);
  if (data.cache) {
    $('st-hit').textContent = data.cache.hitRate;
    $('st-hm').textContent = `hits ${data.cache.hits} · misses ${data.cache.misses}`;
  }
  if (data.uptimeSec != null) $('st-uptime').textContent = `uptime ${data.uptimeSec}s`;
}
$('clear-cache').addEventListener('click', async () => {
  const { data } = await api('/api/cache', { method: 'DELETE' });
  $('cache-msg').textContent = `Cleared ${data.cleared ?? 0} cached entries`;
  toast('🧹 Redis cache cleared');
  loadHealth();
});
loadHealth();
setInterval(loadHealth, 8000);

/* ============ Chat (Task 1) ============ */
const socket = io();
let me = '';
const log = $('chat-log');
const colors = ['#6366f1', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const colorOf = (n) => colors[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function addEl(html, cls) {
  const empty = log.querySelector('.empty');
  if (empty) empty.remove();
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
}
function renderMsg(m) {
  const mine = m.username === me;
  addEl(
    `<div class="avatar" style="background:${colorOf(m.username)}">${esc(m.username[0].toUpperCase())}</div>
     <div class="bubble"><small>${mine ? 'You' : esc(m.username)} · ${clock(m.at)}</small>${esc(m.text)}</div>`,
    'm-row' + (mine ? ' me' : '')
  );
}
$('chat-join').addEventListener('click', () => {
  me = $('chat-name').value.trim();
  if (!me) return toast('✋ Please enter your name first');
  log.innerHTML = '';
  socket.emit('join_room', { room: $('chat-room').value, username: me });
  $('chat-text').disabled = false;
  $('chat-send').disabled = false;
  $('chat-text').focus();
});
function sendMsg() {
  const t = $('chat-text').value;
  if (!t.trim()) return;
  socket.emit('send_message', { text: t });
  $('chat-text').value = '';
}
$('chat-send').addEventListener('click', sendMsg);
$('chat-text').addEventListener('keydown', (e) => (e.key === 'Enter' ? sendMsg() : socket.emit('typing')));
socket.on('history', (list) => list.forEach(renderMsg));
socket.on('message', renderMsg);
socket.on('system', (s) => addEl(esc(s.text), 'sys'));
socket.on('room_users', (r) => { $('room-count').textContent = `🟢 ${r.count} online in #${r.room}`; });
let typingTimer;
socket.on('typing', (u) => {
  $('typing').textContent = `${u} is typing…`;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => ($('typing').textContent = ''), 1200);
});

/* ============ Products (Task 2 + 5) ============ */
let page = 1, totalPages = 1;
async function loadCategories() {
  const { data } = await api('/api/products/categories');
  if (Array.isArray(data)) {
    data.forEach((c) => $('p-category').insertAdjacentHTML('beforeend', `<option value="${esc(c.category)}">${esc(c.category)} (${c.count})</option>`));
  }
}
async function loadProducts() {
  $('p-body').innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
  const q = new URLSearchParams({ page, limit: 10, sort: $('p-sort').value, order: $('p-order').value });
  if ($('p-search').value) q.set('search', $('p-search').value);
  if ($('p-category').value) q.set('category', $('p-category').value);
  if ($('p-min').value) q.set('minPrice', $('p-min').value);
  if ($('p-max').value) q.set('maxPrice', $('p-max').value);
  const { res, data } = await api('/api/products?' + q);
  if (!data.data) {
    $('p-body').innerHTML = '<tr><td colspan="6">Could not load products. Did you run <code>npm run setup</code>?</td></tr>';
    return;
  }
  const cache = res.headers.get('X-Cache');
  $('p-badge').textContent = cache ? `${cache} · ${res.headers.get('X-Response-Time') || ''}` : 'NO CACHE';
  $('p-badge').className = 'badge ' + (cache === 'HIT' ? 'hit' : cache === 'MISS' ? 'miss' : '');
  totalPages = data.meta.totalPages || 1;
  $('p-meta').textContent = `${data.meta.total} products found`;
  $('p-page').textContent = `Page ${data.meta.page} of ${totalPages}`;
  $('p-body').innerHTML =
    data.data.map((p) =>
      `<tr><td>${p.id}</td><td><b>${esc(p.name)}</b></td><td><span class="cat cat-${esc(p.category)}">${esc(p.category)}</span></td><td>₹${p.price.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>⭐ ${p.rating}</td><td>${new Date(p.createdAt).toLocaleDateString()}</td></tr>`
    ).join('') || '<tr><td colspan="6" class="muted">No products match your filters.</td></tr>';
}
$('p-go').addEventListener('click', () => { page = 1; loadProducts(); });
$('p-prev').addEventListener('click', () => { if (page > 1) { page--; loadProducts(); } });
$('p-next').addEventListener('click', () => { if (page < totalPages) { page++; loadProducts(); } });
$('p-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') { page = 1; loadProducts(); } });
loadCategories();
loadProducts();

/* ============ AI (Task 4) ============ */
const POSITIVE_TEXT = 'I recently started using this new backend platform and it is amazing. Setup was easy and the performance is fantastic. The documentation is helpful, and I would recommend it to every developer who wants fast and reliable APIs.';
const NEGATIVE_TEXT = 'The app is slow and keeps crashing. The support team was useless and I am very disappointed. It was a waste of money and I hate the new update.';
$('ai-sample').addEventListener('click', () => { $('ai-text').value = POSITIVE_TEXT; });
$('ai-sample2').addEventListener('click', () => { $('ai-text').value = NEGATIVE_TEXT; });
$('ai-go').addEventListener('click', async () => {
  $('ai-go').disabled = true;
  $('ai-status').textContent = '⏳ Analyzing…';
  const { res, data } = await post('/api/ai/analyze', { text: $('ai-text').value, task: 'both' });
  $('ai-go').disabled = false;
  if (!res.ok) { $('ai-status').textContent = ''; return toast('⚠️ ' + (data.error || 'Something went wrong')); }
  $('ai-status').textContent = '';
  $('ai-out').hidden = false;
  const label = (data.sentiment.label || '').toUpperCase();
  const pos = /POS/.test(label), neg = /NEG/.test(label);
  $('ai-emoji').textContent = pos ? '😊' : neg ? '😞' : '😐';
  $('ai-sent').textContent = label;
  $('ai-sent').className = pos ? 'pos' : neg ? 'neg' : 'neu';
  const score = data.sentiment.score != null ? data.sentiment.score : 0.7;
  $('ai-meter').style.background = pos ? 'var(--ok)' : neg ? 'var(--bad)' : '#f59e0b';
  $('ai-meter').style.width = '0%';
  setTimeout(() => ($('ai-meter').style.width = Math.round(score * 100) + '%'), 50);
  $('ai-sent-p').textContent = `via ${data.sentiment.provider}${data.sentiment.score != null ? ' · confidence ' + Math.round(score * 100) + '%' : ''}`;
  $('ai-sum').textContent = data.summary.summary;
  $('ai-sum-p').textContent = `via ${data.summary.provider}`;
});

/* ============ Register + Queue (Task 3) ============ */
const setStep = (n, cls) => { $('step-' + n).className = cls; };
const resetSteps = () => [1, 2, 3, 4].forEach((n) => setStep(n, ''));

$('r-go').addEventListener('click', async () => {
  const email = $('r-email').value.trim();
  resetSteps();
  setStep(1, 'done');
  const started = Date.now();
  const { res, data } = await post('/api/auth/register', { name: $('r-name').value, email, password: $('r-pass').value });
  const box = $('r-result');
  box.hidden = false;
  if (!res.ok) {
    box.className = 'result err';
    box.innerHTML = `❌ ${esc(data.error || 'Registration failed')}`;
    resetSteps();
    return;
  }
  box.className = 'result ok';
  box.innerHTML = `✅ <b>${esc(data.message)}</b><br/>API replied in <b>${data.responseTimeMs} ms</b> · Queue job #${esc(data.jobId)}`;
  setStep(2, 'done'); setStep(3, 'done'); setStep(4, 'wait');
  toast('✅ Registered. Email is being sent in the background');
  loadQueue();
  // poll until the worker finishes the email (max ~40s)
  for (let i = 0; i < 27; i++) {
    await sleep(1500);
    const { data: log } = await api('/api/auth/email-log');
    renderQueue(log);
    if ((log.items || []).some((x) => x.to === email && new Date(x.at).getTime() >= started - 2000)) {
      setStep(4, 'done');
      toast('📧 Email sent by the background worker');
      return;
    }
  }
});

function renderQueue(data) {
  const c = data.counts || {};
  $('q-counts').innerHTML =
    `<span>⏳ Waiting: ${c.waiting || 0}</span><span>⚙️ Active: ${c.active || 0}</span><span>✅ Completed: ${c.completed || 0}</span><span>❌ Failed: ${c.failed || 0}</span>`;
  $('q-items').innerHTML =
    (data.items || []).map((i) =>
      `<div class="qitem"><span>${i.status === 'sent' ? '✅' : '❌'} ${esc(i.to)}</span><span>${i.preview ? `<a href="${esc(i.preview)}" target="_blank" rel="noopener">View email ↗</a>` : esc(i.error || 'sent')}</span></div>`
    ).join('') || '<p class="muted">No emails processed yet. Register a user to see one here.</p>';
}
async function loadQueue() {
  const { data } = await api('/api/auth/email-log');
  renderQueue(data);
}
$('r-refresh').addEventListener('click', loadQueue);
