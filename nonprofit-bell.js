// The notifications bell (Nov 11 2026, Will: "a little notifications bell, with a bubble showing how many notifications
// they have. it would act just like how you get notifications on your phone"; nothing is emailed). The bubble counts
// what is unread and is gone at none; the list opens under the bell, newest first, unread in bold with a dot; opening
// one marks it read and goes to it; Mark All As Read. The list closes by its X only (CLAUDE.md). Read again every
// three minutes and when the window comes back into view. The server works it out (fundbug_notifications.py).
// nonprofit-portal.html supplies apiFetch, escHtml, MODE, homeOpenTracker, go. Run its tests: node nonprofit-bell.test.js

const BELL = {data: null, open: false, timer: null};

function bellBubble(unread) {
  return unread > 0 ? `<span class="bell-count" aria-hidden="true">${unread > 99 ? '99+' : unread}</span>` : '';
}
function bellLabel(unread) { return unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'; }
function bellAgo(iso, now) {
  const t = Date.parse(iso || ''), n = now || Date.now(); if (isNaN(t)) return '';
  const m = Math.max(0, Math.round((n - t) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const d = Math.round(h / 24); if (d < 7) return d === 1 ? 'Yesterday' : d + ' days ago';
  return new Date(t).toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
}
const BELL_ICON = {note: '✎', stage: '➜', award: '★', file: '▤', deadline: '⏰', follow_up: '↺'};
function bellListHtml(d, now) {
  if (!d) return '<p class="bell-empty">Loading…</p>';
  if (d.error) return `<p class="bell-empty">${escHtml(d.error)}</p>`;
  if (!d.items.length) return '<p class="bell-empty">Nothing here yet. Notes, files and changes your team or your advisor make show up here, with reminders before deadlines.</p>';
  return d.items.map((it, n) => `<button type="button" class="bell-item${it.read ? '' : ' unread'}" onclick="bellOpenItem(${n})">
      <span class="bell-ico" aria-hidden="true">${BELL_ICON[it.kind] || '•'}</span>
      <span class="bell-body"><span class="bell-text">${escHtml(it.text)}</span>${it.detail ? `<span class="bell-detail">${escHtml(it.detail)}</span>` : ''}
        <span class="bell-when">${escHtml(bellAgo(it.at, now))}</span></span>${it.read ? '' : '<span class="bell-dot" aria-label="Unread"></span>'}</button>`).join('');
}
function bellDraw() {
  const btn = document.getElementById('bellBtn'); if (!btn) return;
  const d = BELL.data, unread = d && !d.error ? d.unread : 0;
  btn.querySelector('.bell-slot').innerHTML = bellBubble(unread);
  btn.setAttribute('aria-label', bellLabel(unread));
  btn.setAttribute('aria-expanded', String(BELL.open));
  const panel = document.getElementById('bellPanel');
  panel.hidden = !BELL.open;
  if (BELL.open) {
    panel.querySelector('.bell-list').innerHTML = bellListHtml(d);
    panel.querySelector('.bell-all').hidden = !(d && !d.error && d.unread);
  }
}
async function bellLoad() {
  if (MODE !== 'account') return;
  try { BELL.data = await apiFetch('/api/portal/notifications'); }
  catch (e) { BELL.data = {error: e.status === 503 ? 'Notifications are being set up.' : 'Notifications could not be read just now.'}; }
  bellDraw();
}
function bellToggle() { BELL.open = !BELL.open; bellDraw(); if (BELL.open) bellLoad(); }
function bellClose() { BELL.open = false; bellDraw(); }
async function bellOpenItem(n) {
  const it = BELL.data && BELL.data.items[n]; if (!it) return;
  if (!it.read) {
    it.read = true; BELL.data.unread = Math.max(0, BELL.data.unread - 1); bellDraw();
    try { await apiFetch('/api/portal/notifications/read', 'POST', {keys: [it.key]}); } catch (e) {}
  }
  bellClose();
  if (it.program_id) homeOpenTracker(it.program_id);
  else if (it.documents) go('organization/documents');
}
async function bellReadAll() {
  try { await apiFetch('/api/portal/notifications/read-all', 'POST', {}); }
  catch (e) { fbProblem('Not marked: ' + e.message); return; }
  await bellLoad();
}
function bellStart() {
  if (MODE !== 'account' || BELL.timer) return;
  document.getElementById('bellWrap').hidden = false;
  bellLoad();
  BELL.timer = setInterval(bellLoad, 180000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) bellLoad(); });
}
if (typeof module !== 'undefined') module.exports = {BELL, bellBubble, bellLabel, bellAgo, bellListHtml};
