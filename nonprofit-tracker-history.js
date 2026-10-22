// The Tracker's history and award details (Oct 22 2026; backend: fundbug/fundbug_tracker_history.py). Will: notes
// that never overwrite each other, each one for the team only or for everyone (an advisor the organization shares its
// Tracker with too), and the award, so an organization's results show before the IRS filings arrive.
// Loaded after nonprofit-portal.html's script; uses its apiFetch, escHtml, TRACKER and updateItem.
// Run its tests: node nonprofit-tracker-history.test.js

const TH_OPEN = {};                       // program_id -> its Activity panel is open
const TH_DECIDED = ['awarded', 'not_awarded'];
const TH_AWARD_STAGES = ['submitted', 'invited', 'awarded', 'not_awarded'];

function thMoney(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
function thSummaryLine(s) {
  if (!s || !(s.submitted || s.awarded || s.declined)) return '';
  const parts = [];
  if (s.submitted) parts.push(`${s.submitted} submitted${s.requested ? ` (${thMoney(s.requested)} requested)` : ''}`);
  if (s.awarded) parts.push(`${s.awarded} awarded${s.awarded_dollars ? ` (${thMoney(s.awarded_dollars)})` : ''}`);
  if (s.declined) parts.push(`${s.declined} declined`);
  return `This year: ${parts.join(', ')}.`;
}
function thDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// The award questions, once a stage says something was sent or decided.
function thAwardFields(i) {
  if (TH_AWARD_STAGES.indexOf(i.status) < 0) return '';
  const pid = escHtml(i.program_id);
  const num = (f, label) => `<div><label>${label}</label><input type="text" inputmode="numeric" placeholder="$" value="${i[f] != null ? escHtml(i[f]) : ''}"
      onchange="updateItem('${pid}', {${f}: this.value.replace(/[$,\\s]/g, '') || null})"></div>`;
  const day = (f, label) => `<div><label>${label}</label><input type="date" value="${escHtml(i[f] || '')}" onchange="updateItem('${pid}', {${f}: this.value || null})"></div>`;
  const reasons = ((TRACKER && TRACKER.decline_reasons) || []);
  let h = num('amount_requested', 'Amount Requested') + day('submitted_on', 'Submitted On');
  if (i.status === 'awarded') h += num('amount_awarded', 'Amount Awarded') + day('decided_on', 'Decided On');
  if (i.status === 'not_awarded') h += day('decided_on', 'Decided On') + `<div><label>Why, If You Know</label><select onchange="updateItem('${pid}', {decline_reason: this.value || null})">
      <option value="">Choose one</option>${reasons.map(r => `<option value="${r.code}" ${r.code === i.decline_reason ? 'selected' : ''}>${escHtml(r.label)}</option>`).join('')}</select></div>`;
  return `<div class="t-grid th-award">${h}</div>`;
}

// One entry in the Activity list.
function thEntry(e, pid) {
  const you = (TRACKER && TRACKER.you) || {};
  const who = escHtml(e.author_name || (e.author_side === 'email' ? 'By email' : 'FundBug'));
  const when = thDate(e.created_at);
  if (e.kind === 'stage') return `<li class="th-fact">${who} moved it from ${escHtml(stageLabel(e.detail && e.detail.from))} to <b>${escHtml(stageLabel(e.detail && e.detail.to))}</b> · ${when}</li>`;
  if (e.kind === 'award') {
    const names = { amount_requested: 'amount requested', amount_awarded: 'amount awarded', submitted_on: 'date submitted',
                    decided_on: 'decision date', decline_reason: 'reason' };
    const bits = Object.entries(e.detail || {}).map(([f, v]) => `${names[f] || f} ${/amount/.test(f) && v[1] != null ? thMoney(v[1]) : escHtml(v[1] == null ? 'cleared' : v[1])}`);
    return `<li class="th-fact">${who} set the ${bits.join(', ')} · ${when}</li>`;
  }
  if (e.kind === 'checkin') return `<li class="th-fact">FundBug emailed to ask for an update · ${when}</li>`;
  const mine = you.id && e.author_id === you.id;
  const canDelete = mine || (you.manager && e.author_side === 'organization') || (you.manager && e.author_side === 'advisor');
  const tag = e.visibility === 'everyone' ? 'Team And Advisor' : (e.author_side === 'advisor' ? 'Advisor’s Note' : 'My Team');
  return `<li class="th-note"><div class="th-head"><b>${who}</b>${e.author_side === 'advisor' ? ' (Advisor)' : ''} · ${when}${e.edited_at ? ' · edited' : ''} <span class="badge">${tag}</span></div>
    <div class="th-body" id="thb-${e.id}">${escHtml(e.body || '')}</div>
    ${mine || canDelete ? `<div class="th-acts">${mine ? `<button class="linkish" onclick="thEdit('${e.id}', '${pid}')">Edit</button>` : ''}${canDelete ? `<button class="linkish" onclick="thDelete('${e.id}', '${pid}')">Delete</button>` : ''}</div>` : ''}</li>`;
}

// The Activity panel under a Tracker row.
function thPanel(i) {
  const pid = escHtml(i.program_id);
  const earlier = i.notes ? `<div class="th-earlier"><b>Earlier notes</b> ${escHtml(i.notes)}</div>` : '';
  return `<div class="th-wrap"><button class="linkish" onclick="thToggle('${pid}')">${TH_OPEN[i.program_id] ? 'Hide Activity And Notes' : 'Activity And Notes'}</button>
    <div id="th-${pid}" ${TH_OPEN[i.program_id] ? '' : 'hidden'}>
      ${earlier}
      <textarea class="t-notes" id="thn-${pid}" placeholder="Add a note. It is dated and kept; nobody can change someone else’s."></textarea>
      <div class="th-add"><select id="thv-${pid}" aria-label="Who sees this note"><option value="team">My Team</option><option value="everyone">Team And Advisor</option></select>
        <button class="btn sm" onclick="thAdd('${pid}')">Add Note</button><span class="th-err" id="the-${pid}"></span></div>
      <ul class="th-list" id="thl-${pid}"><li class="th-fact">Loading…</li></ul>
    </div></div>`;
}
async function thToggle(pid) {
  TH_OPEN[pid] = !TH_OPEN[pid];
  const box = document.getElementById('th-' + pid);
  if (box) box.hidden = !TH_OPEN[pid];
  if (TH_OPEN[pid]) await thLoad(pid);
}
async function thLoad(pid) {
  const list = document.getElementById('thl-' + pid);
  try {
    const r = await apiFetch('/api/nonprofit/tracker/' + encodeURIComponent(pid) + '/activity');
    list.innerHTML = r.events.length ? r.events.map(e => thEntry(e, pid)).join('') : '<li class="th-fact">Nothing yet. Notes and stage changes will show here.</li>';
  } catch (e) { list.innerHTML = `<li class="th-fact">Could not load the activity: ${escHtml(e.message)}</li>`; }
}
async function thAdd(pid) {
  const box = document.getElementById('thn-' + pid), err = document.getElementById('the-' + pid);
  const body = box.value.trim();
  if (!body) { err.textContent = 'Write a note first.'; return; }
  try {
    await apiFetch('/api/nonprofit/tracker/' + encodeURIComponent(pid) + '/notes', 'POST', { body, visibility: document.getElementById('thv-' + pid).value });
    box.value = ''; err.textContent = '';
    await thLoad(pid);
  } catch (e) { err.textContent = 'Not saved: ' + e.message; }
}
async function thEdit(id, pid) {
  const el = document.getElementById('thb-' + id);
  if (!el || el.querySelector('textarea')) return;
  const old = el.textContent;
  el.innerHTML = `<textarea class="t-notes" id="thx-${id}">${escHtml(old)}</textarea><button class="btn sm" onclick="thSaveEdit('${id}', '${pid}')">Save</button> <button class="btn ghost sm" onclick="thLoad('${pid}')">Cancel</button>`;
}
async function thSaveEdit(id, pid) {
  const body = document.getElementById('thx-' + id).value.trim();
  try { await apiFetch('/api/nonprofit/tracker/notes/' + encodeURIComponent(id), 'PATCH', { body }); await thLoad(pid); }
  catch (e) { document.getElementById('the-' + pid).textContent = 'Not saved: ' + e.message; }
}
async function thDelete(id, pid) {
  try { await apiFetch('/api/nonprofit/tracker/notes/' + encodeURIComponent(id), 'DELETE'); await thLoad(pid); }
  catch (e) { document.getElementById('the-' + pid).textContent = 'Not deleted: ' + e.message; }
}

if (typeof module !== 'undefined') module.exports = { thSummaryLine, thAwardFields, thEntry, thPanel };
