// What To Attach (Nov 11 2026, fundbug_checklist.py; Will approved the plan): in each Tracker item, above its Files,
// the documents the application needs, where each came from (the funder's guidelines, with their exact words; your
// uploaded application; or added by you), and whether it is ready: Needed, Attached (with its file) or Not Needed.
// A document of the right kind in your Documents is suggested, and attached only when you choose it. Every change
// says Saved (fbSaved) or what went wrong (fbProblem).
// nonprofit-portal.html supplies apiFetch, escHtml, fbSaved, fbProblem. Run its tests: node nonprofit-attach.test.js

const CHECK = {};                                     // program id: the last answer, or {error}
const CHECK_SOURCE = {guidelines: "From The Funder's Guidelines", application: 'From Your Application', own: 'Added By You'};

async function checkLoad(pid) {
  CHECK[pid] = CHECK[pid] && !CHECK[pid].error ? CHECK[pid] : null;
  checkDraw(pid);
  try { CHECK[pid] = await apiFetch('/api/portal/checklist?program_id=' + encodeURIComponent(pid)); }
  catch (e) { CHECK[pid] = {error: e.status === 503 ? 'The checklist is being set up. Try again soon.' : 'The checklist could not be read just now: ' + e.message}; }
  checkDraw(pid);
}
function checkDraw(pid) {
  const el = document.getElementById('tc-' + pid);
  if (el) el.innerHTML = checkHtml(pid, CHECK[pid]);
}
function checkLineHtml(pid, it, d) {
  const id = escHtml(String(it.id)), p = escHtml(pid);
  const prop = (d.proposals || {})[String(it.id)];
  const state = it.status === 'attached' ? `<span class="ck-state ok">Attached${it.file ? ': ' + escHtml(it.file.name) : ''}</span>`
    : it.status === 'not_needed' ? '<span class="ck-state">Not Needed</span>' : '<span class="ck-state need">Needed</span>';
  const choices = (d.choices || []).map(c => `<option value="${escHtml(c.group)}"${c.group === it.file_group ? ' selected' : ''}>${escHtml(c.name)} (${escHtml(c.where)})</option>`).join('');
  return `<li class="ck-line ${escHtml(it.status)}">
    <div class="ck-main"><div class="ck-label">${escHtml(it.label)}</div>
      <div class="ck-meta">${escHtml(CHECK_SOURCE[it.source] || '')}${it.quote && it.source !== 'own' ? ` · <details class="ck-words"><summary>Their Words</summary><q>${escHtml(it.quote)}</q></details>` : ''}</div>
      ${prop ? `<div class="ck-prop">Your Documents has <b>${escHtml(prop.name)}</b>. <button type="button" class="btn sm" onclick="checkSet('${p}', '${id}', 'attached', '${escHtml(it.status)}', '${escHtml(prop.group)}')">Use It</button></div>` : ''}</div>
    <div class="ck-acts">${state}
      ${choices ? `<select aria-label="The file that answers it" onchange="if (this.value) checkSet('${p}', '${id}', 'attached', '${escHtml(it.status)}', this.value)">
        <option value="">${it.status === 'attached' ? 'Choose Another File' : 'Choose A File'}</option>${choices}</select>` : ''}
      ${it.status !== 'needed' ? `<button type="button" class="btn ghost sm" onclick="checkSet('${p}', '${id}', 'needed', '${escHtml(it.status)}')">Mark Needed</button>` : ''}
      ${it.status === 'needed' ? `<button type="button" class="btn ghost sm" onclick="checkSet('${p}', '${id}', 'not_needed', 'needed')">Not Needed</button>` : ''}
      ${it.source === 'own' ? `<button type="button" class="btn ghost sm" onclick="checkRemove('${p}', '${id}')">Remove</button>` : ''}</div>
  </li>`;
}
function checkHtml(pid, d) {
  const head = '<h3 class="fx-h">What To Attach</h3>';
  if (!d) return `<div class="ck">${head}<p class="fx-note">Reading what this application needs…</p></div>`;
  if (d.error) return `<div class="ck">${head}<p class="fx-note">${escHtml(d.error)}</p></div>`;
  const items = d.items || [], done = items.filter(i => i.status !== 'needed').length;
  const note = d.guidelines === 'failed' ? "<p class=\"fx-note\">The funder's list could not be read just now. FundBug tries again the next time you open this.</p>"
    : !items.length ? "<p class=\"fx-note\">Nothing listed yet. The funder's guidelines don't name documents to send; add what you know it needs, or upload the application in Prep Application.</p>" : '';
  return `<div class="ck">${head}
    ${items.length ? `<p class="fx-note">${done === items.length ? 'Everything here is attached or not needed.' : `${items.length - done} still needed.`} Attach files in Files below, or from your Documents.</p>
      <ul class="ck-list">${items.map(it => checkLineHtml(pid, it, d)).join('')}</ul>` : ''}${note}
    <div class="fx-add"><input type="text" class="fx-title-in" id="ck-add-${escHtml(pid)}" maxlength="160" placeholder="Add a document it needs" aria-label="Add a document it needs"
      onkeydown="if (event.key === 'Enter') checkAdd('${escHtml(pid)}')"><button type="button" class="btn ghost sm" onclick="checkAdd('${escHtml(pid)}')">Add</button></div></div>`;
}
async function checkSet(pid, id, status, seen, group) {
  try {
    await apiFetch('/api/portal/checklist/items/' + encodeURIComponent(id) + '/status', 'POST', {status, seen, file_group: group || null});
    fbSaved(status === 'attached' ? 'Saved: attached.' : status === 'not_needed' ? 'Saved: not needed.' : 'Saved: needed.');
  } catch (e) { fbProblem('Not saved: ' + e.message); }
  await checkLoad(pid);
}
async function checkAdd(pid) {
  const el = document.getElementById('ck-add-' + pid), label = el ? el.value.trim() : '';
  if (!label) return;
  try { await apiFetch('/api/portal/checklist/items', 'POST', {program_id: pid, label}); fbSaved('Added to the checklist.'); }
  catch (e) { fbProblem('Not added: ' + e.message); return; }
  await checkLoad(pid);
}
async function checkRemove(pid, id) {
  try { await apiFetch('/api/portal/checklist/items/' + encodeURIComponent(id) + '/remove', 'POST', {}); fbSaved('Removed from the checklist.'); }
  catch (e) { fbProblem('Not removed: ' + e.message); }
  await checkLoad(pid);
}
if (typeof module !== 'undefined') module.exports = {CHECK, checkHtml, checkLineHtml};
