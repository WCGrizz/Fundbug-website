// An organization's files (Nov 11 2026, fundbug_files.py; Will: files "associated with specific programs", shared with
// an advisor). A Files section in each Tracker item, and Documents under Organization for what every application
// asks for. Each file is Team Only or Shared With Advisor; a new upload of a file is a new version, earlier ones kept;
// Remove can be undone (Removed, then Restore). An advisor's marked-up copy shows as "From <advisor>".
// nonprofit-portal.html supplies apiFetch, API_BASE, load, TOKEN_KEY, escHtml, shortDay, TRACKER.
// Run its tests: node nonprofit-files.test.js

const FILES = {};                                    // 'p:<program id>' or 'docs': the last answer, or {error}
const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.csv,.txt,.png,.jpg,.jpeg';

function filesKey(pid) { return pid ? 'p:' + pid : 'docs'; }
function filesDom(key) { return key === 'docs' ? 'docsBox' : 'tf-' + key.slice(2); }
function fileSize(n) {
  n = Number(n) || 0;
  return n >= 1048576 ? (n / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}
async function filesLoad(key) {
  const pid = key === 'docs' ? '' : key.slice(2);
  try { FILES[key] = await apiFetch('/api/portal/files' + (pid ? '?program_id=' + encodeURIComponent(pid) : '')); }
  catch (e) { FILES[key] = {error: e.message, status: e.status}; }
  filesDraw(key);
}
function filesDraw(key) {
  const el = document.getElementById(filesDom(key));
  if (el) el.innerHTML = key === 'docs' ? docsHtml(FILES[key]) : filesSectionHtml(key, FILES[key]);
}
function fileRowHtml(key, f, you) {
  const g = escHtml(f.group), k = escHtml(key);
  const mine = !f.from_advisor;
  const share = mine ? `<select class="fx-share" aria-label="Who can see it" onchange="filesShare('${k}', '${g}', '${escHtml(f.visibility)}', this.value)">
      <option value="team"${f.visibility === 'team' ? ' selected' : ''}>Team Only</option>
      <option value="shared"${f.visibility === 'shared' ? ' selected' : ''}>Shared With Advisor</option></select>`
    : `<span class="badge">From ${escHtml(f.added_by || 'Your Advisor')}</span>`;
  return `<div class="fx-row">
    <div class="fx-main"><a class="fx-name" onclick="filesOpen('${escHtml(f.id)}')">${escHtml(f.name)}</a>
      <div class="fx-meta">${fileSize(f.size)}${f.versions > 1 ? ` · Version ${f.version} of ${f.versions}` : ''} · Added by ${escHtml(f.added_by || 'your team')}, ${escHtml(shortDay(f.added_at))}</div></div>
    <div class="fx-acts">${share}
      ${mine ? `<label class="btn ghost sm fx-ver">New Version<input type="file" accept="${FILE_ACCEPT}" hidden onchange="filesUpload('${k}', this, '${g}')"></label>` : ''}
      ${f.versions > 1 ? `<button class="btn ghost sm" onclick="filesVersions('${k}', '${g}')">Earlier Versions</button>` : ''}
      <button class="btn ghost sm" onclick="filesRemove('${k}', '${g}')">Remove</button></div>
  </div>`;
}
function fileAddHtml(key, kinds) {
  const k = escHtml(key), id = 'fxa-' + k.replace(/[^A-Za-z0-9_-]/g, '_');
  return `<div class="fx-add">
    <input type="file" id="${id}" accept="${FILE_ACCEPT}" aria-label="Choose a file">
    ${kinds ? `<select id="${id}-kind" aria-label="What it is">${kinds.map(d => `<option value="${escHtml(d.code)}">${escHtml(d.label)}</option>`).join('')}</select>` : ''}
    <select id="${id}-vis" aria-label="Who can see it"><option value="team">Team Only</option><option value="shared">Shared With Advisor</option></select>
    <button class="btn sm" onclick="filesUpload('${k}', document.getElementById('${id}'))">Add File</button>
    <span class="fx-msg" id="${id}-msg" aria-live="polite"></span></div>
    <p class="fx-note">PDF, Word, Excel, PowerPoint, CSV, text or an image, up to 25 MB. Team Only stays with your organization; Shared With Advisor lets an advisor you share your Tracker with open it.</p>`;
}
function fileRemovedHtml(key, removed) {
  if (!removed || !removed.length) return '';
  return `<details class="fx-removed"><summary>Removed Files</summary>${removed.map(f => `<div class="fx-row"><div class="fx-main">${escHtml(f.name)}</div>
    <div class="fx-acts"><button class="btn ghost sm" onclick="filesRestore('${escHtml(key)}', '${escHtml(f.group)}')">Restore</button></div></div>`).join('')}</details>`;
}
function filesProblem(d) {
  if (!d) return '<p class="fx-note">Loading files…</p>';
  if (d.error) return `<p class="fx-note">${d.status === 503 ? 'Files are being set up. Try again soon.' : 'Your files could not be read just now: ' + escHtml(d.error)}</p>`;
  return '';
}
function filesSectionHtml(key, d) {
  const p = filesProblem(d);
  return `<div class="fx"><h3 class="fx-h">Files</h3>${p || ((d.files.length ? d.files.map(f => fileRowHtml(key, f, d.you)).join('')
    : '<p class="fx-note">No files yet. Add the application, its budget, letters of support, anything you are working on for it.</p>')
    + fileAddHtml(key) + fileRemovedHtml(key, d.removed))}</div>`;
}
// Documents: one part per kind of document, in the order applications ask for them; Other last.
function docsHtml(d) {
  const p = filesProblem(d); if (p) return p;
  return `<div class="card"><h2>Add A Document</h2>${fileAddHtml('docs', d.doc_kinds)}</div>` +
    `<div class="card"><h2>Your Documents</h2>${d.doc_kinds.map(k => {
      const these = d.files.filter(f => (f.doc_kind || 'other') === k.code);
      if (!these.length && k.code === 'other') return '';
      return `<h3 class="fp-h3">${escHtml(k.label)}</h3>${these.length ? these.map(f => fileRowHtml('docs', f, d.you)).join('') : '<p class="fx-note">Not added yet.</p>'}`;
    }).join('')}${fileRemovedHtml('docs', d.removed)}</div>`;
}
function filesMsg(key, text, bad) {
  const el = document.getElementById('fxa-' + key.replace(/[^A-Za-z0-9_-]/g, '_') + '-msg');
  if (el) { el.textContent = text; el.classList.toggle('bad', !!bad); }
  else if (text && bad) alert(text);
}
async function filesUpload(key, input, group) {
  const file = input && input.files && input.files[0];
  if (!file) { filesMsg(key, 'Choose a file first.', true); return; }
  if (file.size > 25 * 1024 * 1024) { filesMsg(key, 'Please keep each file under 25 MB.', true); return; }
  const base = 'fxa-' + key.replace(/[^A-Za-z0-9_-]/g, '_');
  const fd = new FormData();
  fd.append('file', file);
  if (group) fd.append('group', group);
  else {
    if (key !== 'docs') fd.append('program_id', key.slice(2));
    const kind = document.getElementById(base + '-kind'); if (kind) fd.append('doc_kind', kind.value);
    const vis = document.getElementById(base + '-vis'); if (vis) fd.append('visibility', vis.value);
  }
  filesMsg(key, 'Adding it…');
  try {
    const r = await fetch(API_BASE + '/api/portal/files', {method: 'POST', headers: {'Authorization': 'Bearer ' + (load(TOKEN_KEY) || '')}, body: fd});
    let data = {}; try { data = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'The file could not be added just now. Try again.');
  } catch (e) { filesMsg(key, e.message, true); input.value = ''; return; }
  await filesLoad(key);
  filesMsg(key, group ? 'New version added.' : 'Added.');
}
async function filesOpen(fileId) {
  const w = window.open('', '_blank');                 // opened now, while the click still counts, then pointed at the file
  try {
    const r = await apiFetch('/api/portal/files/' + encodeURIComponent(fileId) + '/link');
    if (w) w.location = r.url; else location.href = r.url;
  } catch (e) { if (w) w.close(); alert('The file could not be opened: ' + e.message); }
}
async function filesShare(key, group, seen, value) {
  try { await apiFetch('/api/portal/files/groups/' + encodeURIComponent(group) + '/sharing', 'POST', {visibility: value, seen}); }
  catch (e) { alert(e.message); }
  await filesLoad(key);
}
async function filesRemove(key, group) {
  try { await apiFetch('/api/portal/files/groups/' + encodeURIComponent(group) + '/remove', 'POST', {}); }
  catch (e) { alert(e.message); }
  await filesLoad(key);
}
async function filesRestore(key, group) {
  try { await apiFetch('/api/portal/files/groups/' + encodeURIComponent(group) + '/restore', 'POST', {}); }
  catch (e) { alert(e.message); }
  await filesLoad(key);
}
async function filesVersions(key, group) {
  let vs = [];
  try { vs = (await apiFetch('/api/portal/files/groups/' + encodeURIComponent(group) + '/versions')).versions; }
  catch (e) { alert(e.message); return; }
  fpPanel('Earlier Versions', `<div class="fx-versions">${vs.map(v => `<div class="fx-row"><div class="fx-main"><a class="fx-name" onclick="filesOpen('${escHtml(v.id)}')">Version ${v.version}: ${escHtml(v.name)}</a>
    <div class="fx-meta">${fileSize(v.size)} · Added by ${escHtml(v.added_by || 'your team')}, ${escHtml(shortDay(v.added_at))}</div></div></div>`).join('')}</div>`);
}
if (typeof module !== 'undefined') module.exports = {FILES, filesKey, filesDom, fileSize, fileRowHtml, filesSectionHtml, docsHtml, filesProblem};
