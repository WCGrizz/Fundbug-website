// The Tracker as a board: a mockup to try (Nov 11 2026, Will: "I think that sounds good, what about a graph like the
// advisors get, but it shows the user's saved programs?"). At /nonprofit/tracker/board, left out of the menu. It reads
// the real Tracker and saves nothing: a card moved, added or cleared here is only on this page until it reloads.
//   - The timeline (the advisors' deadline timeline, for saved programs): the next 60 days, the next two weeks shaded,
//     a dot for each deadline and each follow-up; a dot opens its card.
//   - Five columns (Researching, Applying, Submitted, Awarded, and Closed, folded): cards are dragged between them.
//   - Each card: its name, its stage, and what is next (a follow-up, or the deadline).
//   - A card opens in the side panel: stage, next step, deadline, and its page and Prep Application.
//   - Quick add at the top of Researching; From Your Digests, cleared with Add or Not For Us.
// nonprofit-portal.html supplies TRACKER, loadTracker, stageLabel, escHtml, shortDay, money, openListing, openPrep,
// fpPanel and closePanel. Run its tests: node nonprofit-board.test.js

const BOARD_COLS = [
  ['researching', 'Researching', ['not_started', 'researching', 'contacted']],
  ['applying', 'Applying', ['loi_sent', 'invited', 'in_progress']],
  ['submitted', 'Submitted', ['submitted', 'under_review']],
  ['awarded', 'Awarded', ['awarded']],
  ['closed', 'Closed', ['not_awarded', 'passed']]];
const BOARD_DAYS = 60;
const BOARD = {moved: {}, added: [], cleared: new Set(), taken: new Set(), showClosed: false, next: {}};

function boardCol(i) {
  if (BOARD.moved[i.program_id]) return BOARD.moved[i.program_id];
  const c = BOARD_COLS.find(([, , codes]) => codes.includes(i.status || 'not_started'));
  return c ? c[0] : 'researching';
}
function boardItems(items) {
  const own = (items || []).filter(i => !i.seen_in_digest && !i.dismissed);
  const taken = (items || []).filter(i => i.seen_in_digest && BOARD.taken.has(String(i.program_id)));
  return own.concat(taken, BOARD.added);
}
function boardInbox(items) {
  return (items || []).filter(i => i.seen_in_digest && !BOARD.cleared.has(String(i.program_id)) && !BOARD.taken.has(String(i.program_id)));
}
// What is next on a card: a follow-up first (overdue said so), else the deadline when it has one.
function boardNext(i, todayIso) {
  const own = BOARD.next[i.program_id];
  if (own && own.text) return {text: own.text + (own.on ? ', ' + shortDay(own.on) : ''), soon: false};
  if (i.follow_up_date) {
    const d = daysUntil(i.follow_up_date, todayIso);
    if (d != null && d < 0) return {text: 'Follow up, due ' + shortDay(i.follow_up_date), soon: true};
    if (d != null) return {text: d === 0 ? 'Follow up today' : 'Follow up ' + shortDay(i.follow_up_date), soon: d <= 3};
  }
  const dl = i.days_until_deadline;
  if (dl != null && dl >= 0) return {text: dl === 0 ? 'Closes today' : dl <= 14 ? `Closes in ${dl} day${dl === 1 ? '' : 's'}` : 'Closes ' + boardDay(dl, todayIso), soon: dl <= 14};
  return null;
}
function boardDay(days, todayIso) {
  return shortDay(new Date(Date.parse(String(todayIso).slice(0, 10) + 'T12:00:00Z') + days * 864e5).toISOString().slice(0, 10));
}
function boardCard(i, todayIso) {
  const pid = escHtml(String(i.program_id)), nx = boardNext(i, todayIso);
  return `<div class="bd-card" draggable="true" data-pid="${pid}" ondragstart="event.dataTransfer.setData('text/plain', '${pid}')"
      onclick="boardOpen('${pid}')" onkeydown="if (event.key === 'Enter') boardOpen('${pid}')" tabindex="0" role="button">
    <div class="bd-title">${escHtml(i.title)}</div>
    <div class="bd-meta"><span class="bd-stage">${escHtml(i.preview ? 'Added Here' : stageLabel(BOARD.moved[i.program_id] ? '' : i.status) || 'Moved Here')}</span>${i.kind === 'funder' ? '<span>Funder</span>' : ''}</div>
    ${nx ? `<div class="bd-next${nx.soon ? ' soon' : ''}">${escHtml(nx.text)}</div>` : ''}
  </div>`;
}
// The timeline: deadlines and follow-ups in the next 60 days; dates closer than a dot's width share one.
function boardTimeline(items, todayIso, widthPx) {
  const pts = [];
  for (const i of items) {
    const dl = i.days_until_deadline;
    if (i.kind !== 'funder' && dl != null && dl >= 0 && dl <= BOARD_DAYS && !['submitted', 'under_review', 'awarded', 'not_awarded', 'passed'].includes(i.status))
      pts.push({day: dl, what: 'deadline', i});
    if (i.follow_up_date && !['awarded', 'not_awarded', 'passed'].includes(i.status)) {
      const d = daysUntil(i.follow_up_date, todayIso);
      if (d != null && d <= BOARD_DAYS) pts.push({day: Math.max(d, 0), late: d < 0, what: 'follow_up', i});
    }
  }
  if (!pts.length) return '';
  pts.sort((a, b) => a.day - b.day);
  const pxDay = Math.max(1, (widthPx || 900) / BOARD_DAYS), cols = [];
  for (const p of pts) {
    const last = cols[cols.length - 1];
    if (last && last.what === p.what && (p.day - last.day) * pxDay < 30) last.pts.push(p);
    else cols.push({day: p.day, what: p.what, pts: [p]});
  }
  const pct = d => (100 * Math.min(d, BOARD_DAYS) / BOARD_DAYS).toFixed(2) + '%';
  const ticks = [0, 14, 28, 42, BOARD_DAYS].map((d, k, a) =>
    `<div class="bd-tick" style="left:${pct(d)}"></div><div class="bd-tlab${k === 0 ? ' first' : k === a.length - 1 ? ' last' : ''}" style="left:${pct(d)}">${d === 0 ? 'Today' : boardDay(d, todayIso)}</div>`).join('');
  const dots = cols.map(c => {
    const n = c.pts.length, a = c.pts[0];
    const label = n > 1 ? `${n} ${c.what === 'deadline' ? 'deadlines' : 'follow-ups'}, ${boardDay(c.day, todayIso)}`
      : `${a.i.title}: ${c.what === 'deadline' ? 'closes' : a.late ? 'follow-up overdue' : 'follow up'} ${a.late ? '' : boardDay(c.day, todayIso)}`.trim();
    const open = n > 1 ? `boardShowMany([${c.pts.map(p => `'${escHtml(String(p.i.program_id))}'`).join(',')}])` : `boardOpen('${escHtml(String(a.i.program_id))}')`;
    return `<button type="button" class="bd-dot ${c.what === 'deadline' ? 'dl' : 'fu'}${n > 1 ? ' many' : ''}" style="left:${pct(c.day)}"
      title="${escHtml(label)}" aria-label="${escHtml(label)}" onclick="${open}">${n > 1 ? n : ''}</button>`;
  }).join('');
  return `<div class="card bd-tl-card"><h2>Coming Up</h2>
    <div class="bd-key"><span><i class="bd-k dl"></i>Deadline</span><span><i class="bd-k fu"></i>Follow-up</span></div>
    <div class="bd-tl"><div class="bd-band" style="width:${pct(14)}"><span>Next 2 Weeks</span></div><div class="bd-track"></div>${ticks}${dots}</div></div>`;
}
function boardHtml(items, inbox, todayIso, widthPx) {
  const cols = BOARD_COLS.map(([key, label]) => {
    const these = items.filter(i => boardCol(i) === key);
    if (key === 'closed' && !BOARD.showClosed)
      return `<div class="bd-col bd-folded"><button type="button" class="bd-unfold" onclick="BOARD.showClosed = true; drawBoard()">Show Closed</button></div>`;
    return `<div class="bd-col" data-col="${key}" ondragover="event.preventDefault(); this.classList.add('over')" ondragleave="this.classList.remove('over')"
        ondrop="event.preventDefault(); this.classList.remove('over'); boardMove(event.dataTransfer.getData('text/plain'), '${key}')">
      <div class="bd-head">${label}${key === 'closed' ? ' <button type="button" class="bd-fold" onclick="BOARD.showClosed = false; drawBoard()">Hide</button>' : ''}</div>
      ${key === 'researching' ? `<input class="bd-add" placeholder="Add a funder or program" aria-label="Add a funder or program" onkeydown="if (event.key === 'Enter') boardAdd(this.value)">` : ''}
      ${these.map(i => boardCard(i, todayIso)).join('') || '<div class="bd-empty">Drag a card here.</div>'}
    </div>`;
  }).join('');
  const inboxHtml = inbox.length ? `<div class="card bd-inbox"><h2>From Your Digests</h2><p>Funders and programs your digests sent you. Add the ones you will pursue.</p>
    <div class="bd-inbox-list">${inbox.slice(0, 8).map(i => `<div class="bd-inbox-item"><span>${escHtml(i.title)}</span>
      <span class="bd-inbox-acts"><button class="btn sm" onclick="boardTake('${escHtml(String(i.program_id))}')">Add</button><button class="btn ghost sm" onclick="boardClear('${escHtml(String(i.program_id))}')">Not For Us</button></span></div>`).join('')}</div></div>` : '';
  return `<div class="bd-preview">A mockup to try: moving, adding and clearing cards here is not saved. <a onclick="go('tracker')">Back To My Tracker</a></div>
    ${boardTimeline(items, todayIso, widthPx)}<div class="bd-board">${cols}</div>${inboxHtml}`;
}
function drawBoard() {
  const box = document.getElementById('boardBox'); if (!box) return;
  if (!TRACKER) { box.innerHTML = '<div class="empty">Loading…</div>'; return; }
  const today = new Date().toISOString().slice(0, 10);
  box.innerHTML = boardHtml(boardItems(TRACKER.items), boardInbox(TRACKER.items), today, box.clientWidth || 900);
}
async function loadBoard() {
  drawBoard();
  if (!TRACKER) { try { TRACKER = await apiFetch('/api/nonprofit/tracker'); } catch (e) { document.getElementById('boardBox').innerHTML = `<div class="empty">Could not load your Tracker: ${escHtml(e.message)}</div>`; return; } }
  drawBoard();
}
function boardFind(pid) { return boardItems(TRACKER ? TRACKER.items : []).find(i => String(i.program_id) === String(pid)); }
function boardMove(pid, col) { if (!pid) return; BOARD.moved[pid] = col; drawBoard(); }
function boardAdd(title) {
  title = String(title || '').trim(); if (!title) return;
  BOARD.added.push({program_id: 'preview_' + BOARD.added.length, title, kind: 'own', status: 'not_started', preview: true});
  drawBoard();
  const el = document.querySelector('.bd-add'); if (el) el.focus();
}
function boardTake(pid) { BOARD.taken.add(String(pid)); drawBoard(); }
function boardClear(pid) { BOARD.cleared.add(String(pid)); drawBoard(); }
function boardShowMany(pids) {
  const items = pids.map(boardFind).filter(Boolean);
  fpPanel('Coming Up', `<ul class="bd-many">${items.map(i => `<li><a onclick="boardOpen('${escHtml(String(i.program_id))}')">${escHtml(i.title)}</a></li>`).join('')}</ul>`);
}
function boardOpen(pid) {
  const i = boardFind(pid); if (!i) return;
  const nx = BOARD.next[pid] || {}, col = boardCol(i), today = new Date().toISOString().slice(0, 10), n = boardNext(i, today);
  fpPanel(i.title, `<p class="bd-preview">A mockup: what you change here is not saved.</p>
    <label for="bdCol">Column</label><select id="bdCol" onchange="boardMove('${escHtml(String(pid))}', this.value); boardOpen('${escHtml(String(pid))}')">${BOARD_COLS.map(([k, l]) => `<option value="${k}"${k === col ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <label for="bdNext">Next Step</label><input id="bdNext" placeholder="e.g. Call the program officer" value="${escHtml(nx.text || '')}">
    <label for="bdNextOn">By</label><input id="bdNextOn" type="date" value="${escHtml(nx.on || i.follow_up_date || '')}">
    <div class="fp-actions"><button class="btn sm" onclick="BOARD.next['${escHtml(String(pid))}'] = {text: document.getElementById('bdNext').value.trim(), on: document.getElementById('bdNextOn').value}; drawBoard(); closePanel()">Done</button></div>
    ${n ? `<p><b>What is next now:</b> ${escHtml(n.text)}</p>` : ''}
    ${i.deadline ? `<p><b>Deadline:</b> ${escHtml(i.deadline)}</p>` : ''}${i.amount ? `<p><b>Amount:</b> ${escHtml(i.amount)}</p>` : ''}
    <div class="fp-actions">${i.group_id ? `<button class="btn ghost sm" onclick="closePanel(); openListing('${escHtml(i.group_id)}')">Open Its Page</button>` : ''}${i.preview ? '' : `<button class="btn ghost sm" onclick="closePanel(); openPrep('${escHtml(String(pid))}')">Prep Application</button>`}</div>`);
}
if (typeof module !== 'undefined') module.exports = {BOARD, BOARD_COLS, boardCol, boardItems, boardInbox, boardNext, boardTimeline, boardHtml};
