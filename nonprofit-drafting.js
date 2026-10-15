// My Answers and Prep Application for nonprofit accounts (Oct 15 2026,
// nonprofit/PLAN_2026-10-15_drafting_roadmap_extension.md, Phase 5).
//
// The same routes as the business portal's Application Drafting
// (/api/portal/drafting/..., /api/portal/drafts/...): the backend answers a
// nonprofit account with the nonprofit standard questions, its drafting gate,
// its Organization Profile as the writer's context and the nonprofit
// roadmap. This file is the business page's drafting code (portal.html)
// adapted for nonprofit-portal.html, which loads it after its own script and
// supplies apiFetch, escHtml, showPage, API_BASE, TOKEN_KEY and load().
//
// Rules carried over from the business page: nothing regenerates over a saved
// answer without asking; an unread draft is marked Draft; unsaved edits ask
// before the page is left; the terms are accepted once before FundBug writes
// anything; dialogs close only from their own buttons. New here: a web
// address can be given for an application, every answer has Copy and the
// line "A starting draft. Check every fact and figure before you use it.",
// and every roadmap says what it was built from (the server's note).

let drData = null, drDirty = new Set(), DR_SETTINGS = null;
let prData = null, prPid = null, prDirty = new Set(), prExtracted = [], prUploadId = null, prLoadToken = 0, prRoadmapOpen = true;
const DRAFT_LINE = 'A starting draft. Check every fact and figure before you use it.';
const drIsOutline = () => !!(DR_SETTINGS && DR_SETTINGS.mode === 'outline');
const drVerb = () => drIsOutline() ? 'Outline' : 'Draft';
const drEsc = escHtml;

function drStatus(msg, isErr) { const el = document.getElementById('drStatus'); el.textContent = msg || ''; el.className = 'dr-status' + (isErr ? ' err' : ''); }
function prStatus(msg, isErr) { const el = document.getElementById('prStatus'); el.textContent = msg || ''; el.className = 'dr-status' + (isErr ? ' err' : ''); }
function drWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) + ' ' + d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
}
// A drafting refusal names what the Organization Profile still needs.
function drGateMessage(e) {
  const d = e && e.detail;
  if (e && e.status === 409 && d && d.missing_for_drafting) return 'Add to your Organization Profile first: ' + d.missing_for_drafting.join(', ') + '.';
  return (e && e.message) || 'Something went wrong. Try again in a moment.';
}
function drShowTab(which) {
  const answers = which === 'answers';
  document.getElementById('drPaneAnswers').classList.toggle('active', answers);
  document.getElementById('drPaneApps').classList.toggle('active', !answers);
  document.getElementById('drTabAnswers').classList.toggle('active', answers);
  document.getElementById('drTabApps').classList.toggle('active', !answers);
  if (!answers) renderProgramPicker();
}
window.addEventListener('beforeunload', e => { if (drDirty.size || prDirty.size) { e.preventDefault(); e.returnValue = ''; } });

// ── Settings and the terms ─────────────────────────────────────────────
async function drLoadSettings() {
  try { DR_SETTINGS = await apiFetch('/api/portal/drafting/settings'); }
  catch (e) { DR_SETTINGS = null; throw e; }        // never assume the terms were accepted
  return DR_SETTINGS;
}
function drEnsureTerms() {
  if (DR_SETTINGS && DR_SETTINGS.terms_accepted) return Promise.resolve(true);
  return new Promise(resolve => {
    const m = document.getElementById('drTermsModal'), ok = document.getElementById('drTermsOk'), go = document.getElementById('drTermsGo');
    document.getElementById('drTermsText').textContent = (DR_SETTINGS && DR_SETTINGS.terms_text) || '';
    ok.checked = false; go.disabled = true;
    ok.onchange = () => { go.disabled = !ok.checked; };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Saving…';
      try {
        await apiFetch('/api/portal/drafting/terms', 'POST', {});
        DR_SETTINGS.terms_accepted = true;
        m.classList.remove('open'); go.textContent = 'Continue';
        resolve(true);
      } catch (e) { go.disabled = false; go.textContent = 'Continue'; alert(e.message); }
    };
    document.getElementById('drTermsNo').onclick = () => {
      m.classList.remove('open');
      if (location.hash) history.replaceState(null, '', location.pathname);
      showPage('matches');
      resolve(false);
    };
    m.classList.add('open');
    ok.focus();
  });
}
function drRenderModeBars() {
  const s = DR_SETTINGS || {};
  const terms = '<p class="dr-modebar-note">Suggestions can be wrong or incomplete, and funders can ask for things FundBug has not seen. You are responsible for everything you submit, so read and approve every answer first.</p>';
  const html = s.may_draft
    ? `<div class="dr-modebar-row"><span class="dr-modebar-label">How FundBug Helps</span>
         <span class="dr-seg" role="group" aria-label="Outlines or drafted answers">
           <button type="button" data-mode="outline" aria-pressed="${s.mode === 'outline'}">Outlines</button>
           <button type="button" data-mode="draft" aria-pressed="${s.mode !== 'outline'}">Drafted Answers</button></span></div>
       <p class="dr-modebar-note">${s.mode === 'outline'
         ? 'Each question gets an outline: what to cover, what your profile already says, and what you will need to add. You write the answer in your own words.'
         : 'Each question gets a first draft written from your Organization Profile, with [placeholders] where details are missing. Edit every answer before you use it.'}</p>${terms}`
    : `<p class="dr-modebar-note" style="margin:0">FundBug outlines each question for you: what to cover, what your profile already says, and what you will need to add. You write the answer in your own words.</p>${terms}`;
  ['drModeBar', 'prModeBar'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.querySelectorAll('button[data-mode]').forEach(b => b.onclick = () => drSetMode(b.dataset.mode));
  });
  const all = document.getElementById('prDraftAllBtn'); if (!all.disabled) all.textContent = drVerb() + ' All Answers';
  const empty = document.getElementById('drEmptyBtn'); if (!empty.disabled && drData && drData.passport && drData.passport.ready) empty.textContent = drVerb() + ' These For Me';
  const std = document.getElementById('drDraftBtn'); if (!std.disabled) std.textContent = drVerb() + ' The Standard Questions';
}
async function drSetMode(mode) {
  if (!DR_SETTINGS || DR_SETTINGS.mode === mode) return;
  try {
    await apiFetch('/api/portal/drafting/mode', 'PATCH', {mode});
    DR_SETTINGS.mode = mode;
    drRenderModeBars();
    if (document.getElementById('page-prep').classList.contains('active') && prData) renderSlots(prData.slots);
    else if (drData) renderDrafting();
  } catch (e) { alert(e.message); }
}
async function drPrepare(statusFn) {
  try { await drLoadSettings(); }
  catch (e) { statusFn('Could not load your drafting settings: ' + e.message, true); return false; }
  const ok = await drEnsureTerms();
  if (ok) drRenderModeBars();
  return ok;
}

// ── Shared pieces ──────────────────────────────────────────────────────
function drBadge(isDraft, answer, outline) {
  if (isDraft) return '<span class="dr-badge draft">Draft</span>';
  if (!(answer || '').trim() && (outline || '').trim()) return '<span class="dr-badge draft">Outline</span>';
  return '<span class="dr-badge yours">Yours</span>';
}
function drOutlineHtml(text) {
  let html = '', open = false;
  String(text).split(/\n/).forEach(raw => {
    const line = raw.trim();
    if (!line) { if (open) { html += '</ul>'; open = false; } return; }
    if (/^[-•*]\s+/.test(line)) {
      if (!open) { html += '<ul>'; open = true; }
      html += '<li>' + drEsc(line.replace(/^[-•*]\s+/, '')) + '</li>';
    } else {
      if (open) { html += '</ul>'; open = false; }
      html += '<div class="dr-outline-sub">' + drEsc(line) + '</div>';
    }
  });
  return html + (open ? '</ul>' : '');
}
function drOutlinePanel(outline, at) {
  if (!(outline || '').trim()) return '';
  return `<div class="dr-outline"><div class="dr-outline-h">Outline <span>${at ? 'written ' + drEsc(drWhen(at)) : ''}</span></div>
    <div class="dr-outline-body">${drOutlineHtml(outline)}</div></div>`;
}
// The draft line under every answer FundBug wrote or outlined (plan, section 2).
function drCheckLine(isDraft, answer, outline) {
  return (isDraft || (outline || '').trim() || (answer || '').trim()) ? `<p class="dr-check">${DRAFT_LINE}</p>` : '';
}
function drConfirmReplace(dirty, savedAnswer) {
  if (drIsOutline()) return !dirty || confirm('You have unsaved changes to this answer. They will be lost when the page refreshes. Continue?');
  if ((savedAnswer || '').trim()) return confirm('Replace your current answer with a new draft? Your current answer will not be kept on this page.');
  return !dirty || confirm('You have unsaved changes to this answer. They will be lost. Continue?');
}
function drAutosize(el) { if (!el) return; el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; }
function drWordCount(el) {
  const card = el && el.closest('.dr-card'); if (!card) return;
  const a = card.querySelector('.dr-a'), q = card.querySelector('.dr-q'), out = card.querySelector('.dr-wc');
  if (!a || !out) return;
  const words = (a.value || '').trim().split(/\s+/).filter(Boolean).length;
  const m = (q && q.value || '').match(/(\d[\d,]*)\s*words?/i);
  const limit = m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  out.textContent = limit ? `${words} of ${limit} words` + (words > limit ? ` (${words - limit} over)` : '') : `${words} word${words === 1 ? '' : 's'}`;
  out.classList.toggle('over', !!limit && words > limit);
}
function drSizeAll(root) {
  requestAnimationFrame(() => {
    document.querySelectorAll(root + ' .dr-q, ' + root + ' .dr-a').forEach(drAutosize);
    document.querySelectorAll(root + ' .dr-a').forEach(drWordCount);
  });
}
async function drCopy(text, btn, statusFn) {
  try {
    await navigator.clipboard.writeText(text || '');
    const was = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 1400);
  } catch (_) { statusFn('Your browser would not let FundBug copy. Select the text and copy it yourself.', true); }
}

// ── My Answers ─────────────────────────────────────────────────────────
function openAnswers() {
  if (location.hash !== '#answers') history.replaceState(null, '', '#answers');
  showPage('answers');
  loadDrafting();
}
async function loadDrafting() {
  if (!(await drPrepare(drStatus))) return;
  drStatus('Loading your answers…');
  try {
    drData = await apiFetch('/api/portal/drafts/library');
    drDirty.clear();
    renderDrafting();
    drStatus('');
  } catch (e) { drStatus(e.message, true); }
}
function renderMeter(p) {
  const pct = p.pct || 0;
  document.getElementById('drPct').textContent = pct;
  document.getElementById('drBarFill').style.width = pct + '%';
  const note = document.getElementById('drMeterNote');
  const link = ' <a onclick="showPage(\'profile\')">Open the Organization Profile</a>';
  if (!p.ready) note.innerHTML = 'Before FundBug can draft, add to your Organization Profile: <strong>' + drEsc((p.missing_for_drafting || []).join(', ')) + '</strong>.' + link;
  else if (pct < 100) {
    const miss = p.missing || [], names = miss.slice(0, 3).join(', '), extra = miss.length - Math.min(3, miss.length);
    note.innerHTML = 'The fuller your profile, the more specific the drafts. Still to add: ' + drEsc(names) + (extra > 0 ? ', and ' + extra + ' more' : '') + '.' + link;
  } else note.textContent = 'Your Organization Profile is complete. Drafts draw on everything in it.';
}
function renderDrafting() {
  if (!drData) return;
  const p = drData.passport || {}, answers = drData.answers || [];
  renderMeter(p);
  const empty = document.getElementById('drEmpty'), toolbar = document.getElementById('drToolbar'), cards = document.getElementById('drCards');
  const n = (drData.standard || []).length;
  if (!answers.length) {
    empty.style.display = 'block'; toolbar.style.display = 'none'; cards.innerHTML = '';
    document.getElementById('drEmptyText').textContent = `Press the button and FundBug writes first ${drIsOutline() ? 'outlines' : 'drafts'} of the ${n || 'standard'} questions foundations ask most, from your Organization Profile. You edit them; nothing is sent anywhere.`;
    const b = document.getElementById('drEmptyBtn');
    b.disabled = !p.ready; b.textContent = p.ready ? drVerb() + ' These For Me' : 'Complete Your Profile First';
    return;
  }
  empty.style.display = 'none'; toolbar.style.display = 'flex';
  const missing = (drData.standard || []).some(sq => !answers.some(a => a.question_type === sq.question_type && (a.answer_text || '').trim()));
  const db = document.getElementById('drDraftBtn');
  db.style.display = missing ? 'inline-block' : 'none'; db.disabled = !p.ready;
  const pu = p.passport_updated_at ? new Date(p.passport_updated_at) : null;
  cards.innerHTML = answers.map((a, i) => {
    const isDraft = a.review_status === 'draft', qt = drEsc(a.question_type), num = i + 1;
    const au = a.updated_at ? new Date(a.updated_at) : null;
    const stale = !!(pu && au && (a.answer_text || '').trim() && pu > au);
    return `<div class="dr-card" id="drc-${qt}">
      <div class="dr-head"><div style="flex:1;min-width:180px">
          <div class="dr-field-label">Title</div>
          <input class="dr-label" value="${drEsc(a.label)}" maxlength="200" oninput="drMarkDirty('${qt}')" aria-label="Title">
        </div>${drBadge(isDraft, a.answer_text, a.outline_text)}</div>
      <div class="dr-field-label">Question ${num}</div>
      <textarea class="dr-q" oninput="drMarkDirty('${qt}');drAutosize(this);drWordCount(this)" aria-label="Question ${num}">${drEsc(a.question_text)}</textarea>
      ${drOutlinePanel(a.outline_text, a.outline_at)}
      <div class="dr-field-label">Answer ${num}</div>
      <textarea class="dr-a ${isDraft ? 'is-draft' : ''}" oninput="drMarkDirty('${qt}');drAutosize(this);drWordCount(this)" placeholder="${a.outline_text ? 'Write your answer here, using the outline above.' : 'Write your answer, or press Regenerate.'}" aria-label="Answer ${num}">${drEsc(a.answer_text)}</textarea>
      <div class="dr-wc" aria-live="polite"></div>
      ${drCheckLine(isDraft, a.answer_text, a.outline_text)}
      ${stale ? '<div class="dr-stale">Your Organization Profile has changed since this was written. Regenerate to use the new details, or leave it as it is.</div>' : ''}
      <div class="dr-foot">
        <button class="dr-btn small" id="drsave-${qt}" onclick="saveAnswer('${qt}')">Save</button>
        <button class="dr-btn ghost small" onclick="regenerateAnswer('${qt}')" ${p.ready ? '' : 'disabled title="Complete your profile first"'}>Regenerate</button>
        <button class="dr-btn ghost small" onclick="drCopy(document.querySelector('#drc-${qt} .dr-a').value, this, drStatus)">Copy</button>
        <span class="spacer"></span>
        <span class="dr-meta">${isDraft ? 'Drafted' : 'Saved'} ${drEsc(drWhen(isDraft ? a.generated_at : (a.reviewed_at || a.updated_at)))}</span>
        <button class="dr-btn danger small" onclick="deleteAnswer('${qt}')">Remove</button>
      </div></div>`;
  }).join('');
  drSizeAll('#drCards');
}
function drMarkDirty(qt) { drDirty.add(qt); const c = document.getElementById('drc-' + qt); if (c) c.classList.add('dirty'); }
function drCard(qt) {
  const c = document.getElementById('drc-' + qt); if (!c) return null;
  return {label: c.querySelector('.dr-label').value.trim(), question: c.querySelector('.dr-q').value.trim(), answer: c.querySelector('.dr-a').value.trim()};
}
function drBusy(qt, label) {
  const b = document.getElementById('drsave-' + qt); if (!b) return;
  b.closest('.dr-card').querySelectorAll('button').forEach(x => x.disabled = true);
  b.textContent = label || 'Working…';
}
async function draftLibrary() {
  const btns = [document.getElementById('drDraftBtn'), document.getElementById('drEmptyBtn')];
  btns.forEach(b => { b.disabled = true; b.dataset.was = b.textContent; b.textContent = drIsOutline() ? 'Outlining…' : 'Drafting…'; });
  drStatus((drIsOutline() ? 'Writing outlines' : 'Writing first drafts') + ' from your Organization Profile. This takes about half a minute.');
  try {
    const r = await apiFetch('/api/portal/drafts/library/generate', 'POST', {});
    await loadDrafting();
    const k = (r.drafted || []).length;
    drStatus(k ? (drIsOutline() ? `Outlined ${k} question${k === 1 ? '' : 's'}. Use each outline to write your answer, then save.`
                                : `Drafted ${k} answer${k === 1 ? '' : 's'}. Read each one, edit anything, then save.`) : (r.message || ''));
  } catch (e) { drStatus(drGateMessage(e), true); }
  finally { btns.forEach(b => { b.disabled = false; if (b.dataset.was) b.textContent = b.dataset.was; }); renderDrafting(); }
}
async function saveAnswer(qt) {
  const c = drCard(qt); if (!c) return;
  if (!c.label) { drStatus('Give the question a name.', true); return; }
  if (!c.question) { drStatus('The question cannot be empty.', true); return; }
  drBusy(qt, 'Saving…');
  try {
    await apiFetch('/api/portal/drafts/library/' + encodeURIComponent(qt), 'PATCH', {label: c.label, question_text: c.question, answer_text: c.answer});
    drDirty.delete(qt); await loadDrafting(); drStatus('Saved.');
  } catch (e) { await loadDrafting(); drStatus(e.message, true); }
}
async function regenerateAnswer(qt) {
  if (!drConfirmReplace(drDirty.has(qt), ((drData && drData.answers || []).find(a => a.question_type === qt) || {}).answer_text)) return;
  drBusy(qt, drIsOutline() ? 'Outlining…' : 'Drafting…');
  drStatus(drIsOutline() ? 'Writing an outline for this question.' : 'Writing a new draft.');
  try {
    await apiFetch('/api/portal/drafts/library/' + encodeURIComponent(qt) + '/regenerate', 'POST', {});
    drDirty.delete(qt); await loadDrafting();
    drStatus(drIsOutline() ? 'Outlined. Use the outline to write your answer, then save.' : 'New draft ready. Read it, edit anything, then save.');
  } catch (e) { await loadDrafting(); drStatus(drGateMessage(e), true); }
}
async function deleteAnswer(qt) {
  const a = (drData && drData.answers || []).find(x => x.question_type === qt);
  if (!confirm(`Remove "${a ? a.label : 'this question'}" and its history? A standard question comes back empty the next time you draft.`)) return;
  drBusy(qt, 'Removing…');
  try { await apiFetch('/api/portal/drafts/library/' + encodeURIComponent(qt), 'DELETE'); drDirty.delete(qt); await loadDrafting(); drStatus('Removed.'); }
  catch (e) { await loadDrafting(); drStatus(e.message, true); }
}
function toggleAddQuestion(force) {
  const box = document.getElementById('drAdd');
  const show = force === undefined ? !box.classList.contains('show') : !!force;
  box.classList.toggle('show', show);
  if (show) document.getElementById('drAddLabel').focus();
}
async function submitAddQuestion() {
  const label = document.getElementById('drAddLabel').value.trim(), q = document.getElementById('drAddQuestion').value.trim(), a = document.getElementById('drAddAnswer').value.trim();
  if (!label) { drStatus('Give the question a name.', true); return; }
  if (!q) { drStatus('Enter the question.', true); return; }
  try {
    await apiFetch('/api/portal/drafts/library', 'POST', {label, question_text: q, answer_text: a});
    ['drAddLabel', 'drAddQuestion', 'drAddAnswer'].forEach(id => { document.getElementById(id).value = ''; });
    toggleAddQuestion(false); await loadDrafting();
    drStatus(a ? 'Added.' : 'Added. Press Regenerate on it whenever you want a draft.');
  } catch (e) { drStatus(e.message, true); }
}

// The Applications tab: the Tracker's funders and programs, each opening its Prep Application page.
async function renderProgramPicker() {
  const list = document.getElementById('drProgramList');
  list.innerHTML = '<div class="empty">Loading…</div>';
  let t;
  try { t = await apiFetch('/api/nonprofit/tracker'); }
  catch (e) { list.innerHTML = `<div class="empty">Could not load your Tracker: ${drEsc(e.message)}</div>`; return; }
  const items = (t.items || []).filter(i => !i.seen_in_digest);
  if (!items.length) { list.innerHTML = '<div class="empty">Nothing in your Tracker yet. Save a funder or program from your Library and it shows up here.</div>'; return; }
  const days = i => (i.days_until_deadline == null || i.days_until_deadline < 0) ? 99999 : i.days_until_deadline;
  items.sort((a, b) => (!!b.is_favorite - !!a.is_favorite) || (days(a) - days(b)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  list.innerHTML = items.slice(0, 60).map(i => {
    const d = i.days_until_deadline, soon = d != null && d >= 0 && d <= 30;
    const kind = i.kind === 'funder' ? 'Funder' : i.kind === 'own' ? 'Added by you' : 'Opportunity';
    return `<div class="pr-progrow" role="button" tabindex="0" onclick="openPrep('${drEsc(i.program_id)}')" onkeydown="if(event.key==='Enter')openPrep('${drEsc(i.program_id)}')">
      <span class="pr-star">${i.is_favorite ? '★' : ''}</span><span class="pr-progname">${drEsc(i.title)}</span>
      ${soon ? `<span class="pr-soon">${d === 0 ? 'Closes today' : d === 1 ? '1 day left' : d + ' days left'}</span>` : ''}
      <span class="pr-progmeta">${drEsc(kind)}${i.deadline ? ' · ' + drEsc(i.deadline) : ''}</span><span class="pr-progmeta">&rarr;</span></div>`;
  }).join('');
}

// ── Prep Application ───────────────────────────────────────────────────
// Reached at #prep/<tracker id>, so a reload keeps the page. The hash is the one trigger (the business page once
// started two loads of the same page and a slow reply painted over the newer one, Sept 17 2026).
function openPrep(pid) {
  const target = '#prep/' + encodeURIComponent(pid);
  if (location.hash === target) showPrep(pid); else location.hash = target;
}
// From a listing (Library or a listing's panel): saved to the Tracker first, as the drafting routes need.
async function prepListing(groupId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Opening…'; }
  try {
    const r = await apiFetch('/api/nonprofit/tracker', 'POST', {group_id: groupId});
    if (typeof TRACKER !== 'undefined') TRACKER = null;
    const m = ((typeof RESULT !== 'undefined' && RESULT && RESULT.shown) || []).find(x => x.id === groupId);
    if (m) m.saved = true;
    closePanel();
    openPrep(r.program_id);
  } catch (e) {
    alertLine('Could not open this application: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Prep Application'; }
  }
}
function backToAnswers() {
  if (prDirty.size && !confirm('You have unsaved answers on this application. Leave without saving?')) return;
  prDirty.clear();
  location.hash = 'answers';
}
function showPrep(pid) {
  showPage('prep');
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.toggle('active', a.dataset.page === 'answers'));
  loadPrep(pid);
}
function routeDrafting() {
  if (MODE !== 'account') return false;
  const h = location.hash || '';
  const m = h.match(/^#prep\/(.+)$/);
  if (m) { showPrep(decodeURIComponent(m[1])); return true; }
  if (h === '#answers') { showPage('answers'); loadDrafting(); return true; }
  return false;
}
window.addEventListener('hashchange', routeDrafting);
function prBase() { return '/api/portal/drafts/program/' + encodeURIComponent(prPid); }

async function loadPrep(pid) {
  if (!(await drPrepare(prStatus))) return;
  const mine = ++prLoadToken;
  prPid = pid; prDirty.clear();
  if (!TRACKER) { try { TRACKER = await apiFetch('/api/nonprofit/tracker'); } catch (_) {} }   // the listing's kind for the header
  prStatus('Loading this application…');
  document.getElementById('prSlots').innerHTML = '';
  try {
    const data = await apiFetch(prBase());
    if (mine !== prLoadToken) return;
    prData = data;
    renderProgramHeader(prData.program, prData.passport);
    renderLibraryPicker(prData.library);
    renderPlan(prData.plan || {});
    renderRoadmap(prData.roadmap);
    renderSlots(prData.slots);
    prStatus('');
  } catch (e) {
    if (mine !== prLoadToken) return;
    prStatus(e.status === 404 ? 'That funder or program is not in your Tracker.' : e.message, true);
  }
}
function renderProgramHeader(p, gate) {
  const facts = [];
  const item = ((typeof TRACKER !== 'undefined' && TRACKER && TRACKER.items) || []).find(i => i.program_id === prPid) || {};
  if (item.kind === 'funder') facts.push('<span class="pr-fact">Funder</span>');
  else if (item.kind === 'opportunity') facts.push('<span class="pr-fact">Opportunity</span>');
  if (p.amount) facts.push(`<span class="pr-fact">${drEsc(p.amount)}</span>`);
  if (p.deadline && item.kind !== 'funder') facts.push(`<span class="pr-fact">Deadline: ${drEsc(p.deadline)}</span>`);
  if (p.geography) facts.push(`<span class="pr-fact">${drEsc(p.geography)}</span>`);
  if (p.no_longer_listed) facts.push('<span class="pr-fact warn">No longer listed</span>');
  if (p.is_user_added) facts.push('<span class="pr-fact">You added this one</span>');
  document.getElementById('prProgram').innerHTML = `<div class="pr-prog">
      <h2>${drEsc(p.title)}</h2><div class="pr-facts">${facts.join('')}</div>
      ${p.description ? `<div class="pr-desc" id="prDesc">${drEsc(p.description)}</div><button class="pr-more" id="prDescMore" onclick="prToggleDesc(this)" style="display:none">Show More</button>` : ''}
      ${p.source_url ? `<a class="pr-apply" href="${drEsc(p.source_url)}" target="_blank" rel="noopener">Open the funder's page &rarr;</a>` : ''}
      ${gate && !gate.ready ? `<div class="dr-stale">FundBug cannot draft for you until your Organization Profile has: ${drEsc((gate.missing_for_drafting || []).join(', '))}. You can still write answers yourself. <a onclick="showPage('profile')" style="cursor:pointer">Open the Organization Profile</a></div>` : ''}
    </div>`;
  requestAnimationFrame(() => {
    const d = document.getElementById('prDesc'), b = document.getElementById('prDescMore');
    if (d && b) b.style.display = (d.scrollHeight - d.clientHeight > 2) ? 'block' : 'none';
  });
}
function prToggleDesc(btn) { const d = document.getElementById('prDesc'); btn.textContent = d.classList.toggle('open') ? 'Show Less' : 'Show More'; }

function renderLibraryPicker(lib) {
  const box = document.getElementById('prLibList');
  const used = new Set(((prData && prData.slots) || []).map(x => String(x.base_answer_id || '')));
  const withAnswers = (lib || []).filter(a => (a.answer_text || '').trim());
  document.getElementById('prLibAddBtn').disabled = !withAnswers.length;
  if (!withAnswers.length) { box.innerHTML = '<p>You have no saved answers yet. Answers you write in My Answers, or save from an application, show up here.</p>'; return; }
  box.innerHTML = withAnswers.map(a => {
    const already = used.has(String(a.id)), q = (a.question_text || '').trim(), ans = (a.answer_text || '').trim();
    return `<label class="pr-libitem"><input type="checkbox" value="${drEsc(a.question_type)}" ${already ? 'disabled' : ''}>
      <span><b>${drEsc(a.label || 'Untitled')}</b>${already ? ' <em>Already on this application</em>' : ''}
        ${q ? `<span class="pr-libq">${drEsc(q.length > 170 ? q.slice(0, 167) + '…' : q)}</span>` : ''}
        <span class="pr-liba">${drEsc(ans.length > 150 ? ans.slice(0, 147) + '…' : ans)}</span></span></label>`;
  }).join('');
}
function prAddToggle() {
  const c = document.getElementById('prAddChoose');
  if (c.classList.contains('show')) { prAddClose(); return; }
  c.classList.add('show');
  prAddTab((prData && prData.slots && prData.slots.length) ? 'lib' : 'app');
}
function prAddTab(which) {
  document.querySelectorAll('#prAddChoose [data-add]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.add === which)));
  document.getElementById('prImport').classList.toggle('show', which === 'app');
  document.getElementById('prLibBox').classList.toggle('show', which === 'lib');
  document.getElementById('prAddBlank').classList.toggle('show', which === 'type');
  const focus = {app: 'prUrl', type: 'prBlankQ'}[which];
  if (focus) document.getElementById(focus).focus();
}
function prAddClose() {
  document.getElementById('prAddChoose').classList.remove('show');
  ['prImport', 'prLibBox', 'prAddBlank'].forEach(id => document.getElementById(id).classList.remove('show'));
}
async function prAddCheckedFromLibrary() {
  const picks = [...document.querySelectorAll('#prLibList input:checked')].map(x => x.value);
  if (!picks.length) { prStatus('Tick at least one answer to add.', true); return; }
  const btn = document.getElementById('prLibAddBtn');
  btn.disabled = true; btn.textContent = 'Adding…';
  let added = 0;
  try { for (const qt of picks) { await apiFetch(prBase() + '/slots', 'POST', {base_question_type: qt}); added++; } }
  catch (e) { prStatus(e.message, true); }
  btn.disabled = false; btn.textContent = 'Add The Checked Answers';
  prAddClose();
  await loadPrep(prPid);
  if (added) prStatus(`Added ${added} ${added === 1 ? 'answer' : 'answers'}. Edit ${added === 1 ? 'it' : 'each one'} for this application, then save.`);
}

function renderSlots(slots) {
  slots = slots || [];
  const wrap = document.getElementById('prSlots'), ready = !!(prData && prData.passport && prData.passport.ready);
  const answered = slots.filter(s => (s.answer_text || '').trim()).length;
  document.getElementById('prToolbar').style.display = slots.length ? 'flex' : 'none';
  document.getElementById('prProgress').textContent = slots.length ? `${answered} of ${slots.length} answered` : '';
  const all = document.getElementById('prDraftAllBtn');
  const covered = slots.filter(s => (s.answer_text || '').trim() || (drIsOutline() && (s.outline_text || '').trim())).length;
  all.disabled = !ready || covered === slots.length;
  all.title = ready ? '' : 'Complete your Organization Profile first';
  if (!slots.length) {
    wrap.innerHTML = '<div class="card dr-empty"><h3>No Questions Yet</h3><p>Press <b>Add Questions</b> to bring them in from the application, pick from answers you have saved, or type one in.</p></div>';
    return;
  }
  wrap.innerHTML = slots.map((s, i) => {
    const isDraft = s.review_status === 'draft', n = i + 1, sid = drEsc(s.id);
    const verb = drIsOutline() ? (s.outline_text ? 'Redo The Outline' : 'Outline This Question') : ((s.answer_text || '').trim() ? 'Redraft This Answer' : 'Draft This Answer');
    return `<div class="dr-card" id="prc-${sid}">
      <div class="dr-head"><div style="flex:1;min-width:180px"><div class="pr-slotnum">Question ${n}</div>
          <div class="dr-field-label">Title</div>
          <input class="dr-label" value="${drEsc(s.label)}" maxlength="200" oninput="prMarkDirty('${sid}')" aria-label="Title">
        </div>${drBadge(isDraft, s.answer_text, s.outline_text)}</div>
      <div class="dr-field-label">Question ${n}</div>
      <textarea class="dr-q" oninput="prMarkDirty('${sid}');drAutosize(this);drWordCount(this)" aria-label="Question ${n}">${drEsc(s.question_text)}</textarea>
      ${drOutlinePanel(s.outline_text, s.outline_at)}
      ${prSuggestionBox(s)}
      <div class="dr-field-label">Answer ${n}</div>
      <textarea class="dr-a ${isDraft ? 'is-draft' : ''}" oninput="prMarkDirty('${sid}');drAutosize(this);drWordCount(this);prHideSuggestion('${sid}',this)" placeholder="${s.outline_text ? 'Write your answer here, using the outline above.' : 'Write your answer, or press ' + verb + '.'}" aria-label="Answer ${n}">${drEsc(s.answer_text)}</textarea>
      <div class="dr-wc" aria-live="polite"></div>
      ${drCheckLine(isDraft, s.answer_text, s.outline_text)}
      <div class="dr-foot">
        <button class="dr-btn small" id="prsave-${sid}" onclick="saveSlot('${sid}')">Save</button>
        <button class="dr-btn ghost small" onclick="adaptSlot('${sid}')" ${ready ? '' : 'disabled title="Complete your profile first"'}>${verb}</button>
        <button class="dr-btn ghost small" onclick="drCopy(document.querySelector('#prc-${sid} .dr-a').value, this, prStatus)">Copy</button>
        <button class="dr-btn ghost small" onclick="promoteSlot('${sid}')">Save To My Answers</button>
        <span class="spacer"></span>
        <span class="dr-meta">${isDraft ? 'Drafted' : 'Saved'} ${drEsc(drWhen(isDraft ? s.generated_at : (s.reviewed_at || s.updated_at)))}</span>
        <button class="dr-btn danger small" onclick="deleteSlot('${sid}')">Remove</button>
      </div></div>`;
  }).join('');
  drSizeAll('#prSlots');
}
function prSuggestionBox(s) {
  const g = s.suggestion;
  if (!g || (s.answer_text || '').trim()) return '';
  const where = g.in_library ? 'in My Answers' : (g.program_title ? 'for ' + drEsc(g.program_title) : 'on another application');
  return `<div class="dr-suggest" id="prsug-${drEsc(s.id)}">
    <div>You answered a question like this before: <b>“${drEsc(g.label || 'an earlier question')}”</b> ${where}.</div>
    <div class="dr-suggest-actions"><button class="dr-btn small" onclick="prUseSuggestion('${drEsc(s.id)}')">Use As A Starting Point</button>
      <button class="dr-btn ghost small" onclick="prToggleSuggestion('${drEsc(s.id)}',this)">Show It</button></div>
    <div class="dr-suggest-text" hidden>${drEsc(g.answer_text)}</div></div>`;
}
function prToggleSuggestion(sid, btn) {
  const box = document.querySelector('#prsug-' + CSS.escape(sid) + ' .dr-suggest-text'); if (!box) return;
  box.hidden = !box.hidden; btn.textContent = box.hidden ? 'Show It' : 'Hide It';
}
function prUseSuggestion(sid) {
  const slot = ((prData && prData.slots) || []).find(x => String(x.id) === String(sid)), card = document.getElementById('prc-' + sid);
  if (!slot || !slot.suggestion || !card) return;
  const a = card.querySelector('.dr-a');
  a.value = slot.suggestion.answer_text || '';
  prMarkDirty(sid); drAutosize(a); drWordCount(a);
  const box = document.getElementById('prsug-' + sid); if (box) box.remove();
  a.focus();
  prStatus('Your earlier answer is in the box. Edit it for this application, then press Save.');
}
function prHideSuggestion(sid, el) { if ((el.value || '').trim()) { const box = document.getElementById('prsug-' + sid); if (box) box.remove(); } }
function prMarkDirty(sid) { prDirty.add(sid); const c = document.getElementById('prc-' + sid); if (c) c.classList.add('dirty'); }
function prSlotFields(sid) {
  const c = document.getElementById('prc-' + sid); if (!c) return null;
  return {label: c.querySelector('.dr-label').value.trim(), question: c.querySelector('.dr-q').value.trim(), answer: c.querySelector('.dr-a').value.trim()};
}
function prBusy(sid, label) {
  const b = document.getElementById('prsave-' + sid); if (!b) return;
  b.closest('.dr-card').querySelectorAll('button').forEach(x => x.disabled = true);
  b.textContent = label || 'Working…';
}
async function saveSlot(sid) {
  const f = prSlotFields(sid); if (!f) return;
  if (!f.label) { prStatus('Give the question a name.', true); return; }
  if (!f.question) { prStatus('The question cannot be empty.', true); return; }
  prBusy(sid, 'Saving…');
  try { await apiFetch(prBase() + '/slots/' + encodeURIComponent(sid), 'PATCH', {label: f.label, question_text: f.question, answer_text: f.answer}); prDirty.delete(sid); await loadPrep(prPid); prStatus('Saved.'); }
  catch (e) { await loadPrep(prPid); prStatus(e.message, true); }
}
async function adaptSlot(sid) {
  if (!drConfirmReplace(prDirty.has(sid), (((prData && prData.slots) || []).find(x => String(x.id) === String(sid)) || {}).answer_text)) return;
  prBusy(sid, drIsOutline() ? 'Outlining…' : 'Drafting…');
  prStatus(drIsOutline() ? 'Writing an outline for this question.' : 'Writing a draft for this application.');
  try {
    await apiFetch(prBase() + '/slots/' + encodeURIComponent(sid) + '/adapt', 'POST', {});
    prDirty.delete(sid); await loadPrep(prPid);
    prStatus(drIsOutline() ? 'Outlined. Use the outline to write your answer, then save.' : 'Drafted. Read it, edit anything, then save.');
  } catch (e) { await loadPrep(prPid); prStatus(drGateMessage(e), true); }
}
async function deleteSlot(sid) {
  if (!confirm('Remove this question from this application? Your saved answers are not affected.')) return;
  prBusy(sid, 'Removing…');
  try { await apiFetch(prBase() + '/slots/' + encodeURIComponent(sid), 'DELETE'); prDirty.delete(sid); await loadPrep(prPid); prStatus('Removed.'); }
  catch (e) { await loadPrep(prPid); prStatus(e.message, true); }
}
// Three real choices, never a confirm() where Cancel means "save as new" (the business page's Sept 17 2026 lesson).
function promoteSlot(sid) {
  const slot = ((prData && prData.slots) || []).find(s => String(s.id) === String(sid)), card = document.getElementById('prc-' + sid);
  if (!card || card.querySelector('.pr-promote')) return;
  const box = document.createElement('div');
  box.className = 'pr-promote';
  box.innerHTML = `<div class="dr-field-label" style="margin:0;width:100%">Save This Answer To My Answers</div>
    ${slot && slot.base_answer_id ? `<button class="dr-btn small" data-mode="update">Update “${drEsc(slot.label)}”</button>` : ''}
    <button class="dr-btn ghost small" data-mode="new">Save As A New Answer</button>
    <button class="dr-btn ghost small" data-mode="cancel">Cancel</button>
    <div class="pr-newname" style="display:none;margin-top:10px"><label>Name It</label>
      <input class="pr-newlabel dr-box" maxlength="200" value="${drEsc((slot && slot.label) || '')}">
      <div class="dr-foot"><button class="dr-btn small" data-mode="confirm-new">Save It</button></div></div>`;
  card.querySelector('.dr-foot').after(box);
  box.addEventListener('click', async ev => {
    const b = ev.target.closest('button'); if (!b) return;
    const mode = b.dataset.mode;
    if (mode === 'cancel') { box.remove(); return; }
    if (mode === 'new') { box.querySelector('.pr-newname').style.display = 'block'; box.querySelector('.pr-newlabel').focus(); return; }
    const label = mode === 'confirm-new' ? box.querySelector('.pr-newlabel').value.trim() : null;
    if (mode === 'confirm-new' && !label) { prStatus('Give it a name first.', true); return; }
    box.remove();
    prBusy(sid, 'Saving…');
    try {
      const r = await apiFetch(prBase() + '/slots/' + encodeURIComponent(sid) + '/promote', 'POST', {mode: mode === 'update' ? 'update' : 'new', label});
      await loadPrep(prPid);
      prStatus(r.mode === 'update' ? 'Updated in My Answers.' : 'Saved to My Answers as a new answer.');
    } catch (e) { await loadPrep(prPid); prStatus(e.message, true); }
  });
}
async function draftAllSlots() {
  const empty = ((prData && prData.slots) || []).filter(s => !(s.answer_text || '').trim());
  if (!empty.length) { prStatus('Every question already has an answer. Use Redraft This Answer on one to redo it.'); return; }
  const btn = document.getElementById('prDraftAllBtn');
  btn.disabled = true; btn.textContent = drIsOutline() ? 'Outlining…' : 'Drafting…';
  prStatus(`${drIsOutline() ? 'Outlining' : 'Drafting'} ${empty.length} question${empty.length === 1 ? '' : 's'} together, so they do not repeat each other. This takes up to a minute.`);
  try {
    const r = await apiFetch(prBase() + '/draft-all', 'POST', {});
    await loadPrep(prPid);
    const fail = r.failed ? ` ${r.failed} could not be ${drIsOutline() ? 'outlined' : 'drafted'}; press ${drVerb()} All Answers again to try ${r.failed === 1 ? 'it' : 'them'}.` : '';
    prStatus(r.drafted ? (drIsOutline() ? `Outlined ${r.drafted} question${r.drafted === 1 ? '' : 's'}. Use each outline to write your answer, then save.${fail}`
                                        : `Drafted ${r.drafted} answer${r.drafted === 1 ? '' : 's'}. Read each one, edit anything, then save.${fail}`) : (r.message || ''));
  } catch (e) { prStatus(drGateMessage(e), true); }
  finally { btn.disabled = false; btn.textContent = drVerb() + ' All Answers'; renderSlots(prData && prData.slots); }
}
async function submitBlankSlot() {
  const q = document.getElementById('prBlankQ').value.trim();
  if (!q) { prStatus('Type the question first.', true); return; }
  try { await apiFetch(prBase() + '/slots', 'POST', {question_text: q}); document.getElementById('prBlankQ').value = ''; prAddClose(); await loadPrep(prPid); prStatus('Added.'); }
  catch (e) { prStatus(e.message, true); }
}
function downloadApplication() {
  if (!prData) return;
  const p = prData.program || {}, lines = [p.title || 'Application', ''];
  if (p.deadline) lines.push('Deadline: ' + p.deadline);
  if (p.amount) lines.push('Amount: ' + p.amount);
  if (p.source_url) lines.push("Funder's page: " + p.source_url);
  lines.push('', 'Prepared with FundBug on ' + new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}), '');
  lines.push('IMPORTANT: ' + ((DR_SETTINGS && DR_SETTINGS.terms_text) || 'FundBug suggestions can be wrong or incomplete. You are responsible for everything you submit.'), '');
  ((prData.slots) || []).forEach((s, i) => {
    const f = prSlotFields(s.id);
    lines.push('', `QUESTION ${i + 1}: ${s.label || ''}`, (f ? f.question : s.question_text) || '', '', (f ? f.answer : s.answer_text) || '(not answered yet)', '', '-'.repeat(60));
  });
  const url = URL.createObjectURL(new Blob([lines.join('\n')], {type: 'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = (p.title || 'application').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) + '-answers.txt';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  prStatus('Downloaded. Anything you have typed but not saved is included.');
}

// Reading an application: a PDF, a web address or pasted text, one at a time.
async function extractApplication() {
  const text = document.getElementById('prPaste').value.trim(), url = document.getElementById('prUrl').value.trim();
  const fileEl = document.getElementById('prFile'), file = fileEl.files && fileEl.files[0];
  const given = [!!file, !!url, !!text].filter(Boolean).length;
  if (!given) { prStatus('Choose a PDF, paste its web address, or paste the text first.', true); return; }
  if (given > 1) { prStatus('Give FundBug one of these at a time: the PDF, the web address or the text.', true); return; }
  if (url && !/^https?:\/\//i.test(url)) { prStatus('A web address starts with https:// (or http://).', true); return; }
  const btn = document.getElementById('prExtractBtn');
  btn.disabled = true; btn.textContent = 'Reading…';
  prStatus('Reading it. A long document takes up to a minute.');
  try {
    const fd = new FormData();
    if (file) fd.append('file', file); else if (url) fd.append('url', url); else fd.append('text', text);
    const r = await fetch(API_BASE + prBase() + '/extract', {method: 'POST', headers: {'Authorization': 'Bearer ' + (load(TOKEN_KEY) || '')}, body: fd});
    let data = {}; try { data = await r.json(); } catch (_) {}
    if (!r.ok) {
      const d = data.detail;
      throw new Error(r.status >= 500 ? 'FundBug could not read it just now. Try again in a few minutes.'
        : (typeof d === 'string' ? d : (d && d.message) || 'FundBug could not read that. Check it and try again.'));
    }
    prExtracted = data.questions || [];
    prUploadId = data.upload_id || null;
    renderPlan(data);
    prAddClose();
    if (!prExtracted.length) { prStatus([data.notice, data.message || 'Nothing to write was found in that.'].filter(Boolean).join(' '), true); return; }
    renderExtracted();
    prStatus(data.notice || '');
  } catch (e) { prStatus(e.message, true); }
  finally { btn.disabled = false; btn.textContent = 'Read It'; }
}
function renderPlan(data) {
  const box = document.getElementById('prPlan');
  const att = data.attachments || [], dates = data.dates || [], elig = data.eligibility || [], sub = data.submission || '';
  if (!att.length && !dates.length && !elig.length && !sub) { box.style.display = 'none'; return; }
  let h = '<h3>What This Application Needs</h3>';
  if (att.length) h += '<h4>Documents To Attach</h4><ul>' + att.map(a => `<li>${drEsc(a)}</li>`).join('') + '</ul>';
  if (dates.length) h += '<h4>Key Dates</h4><ul>' + dates.map(d => `<li><b>${drEsc(d.label)}</b>${d.date ? ': ' + drEsc(d.date) : ''}</li>`).join('') + '</ul>';
  if (elig.length) h += '<h4>Who Can Apply</h4><ul>' + elig.map(e => `<li>${drEsc(e)}</li>`).join('') + '</ul>';
  if (sub) h += '<h4>How To Submit</h4><p>' + drEsc(sub) + '</p>';
  if (data.file_name || data.read_at) {
    const pages = data.page_count ? `, ${data.page_count} page${data.page_count === 1 ? '' : 's'}` : '';
    h += `<div class="pr-source">From ${drEsc(data.file_name || 'what you gave FundBug')}${pages}${data.read_at ? ', read ' + drEsc(drWhen(data.read_at)) : ''}. ${DRAFT_LINE.replace('A starting draft', 'A starting point')}</div>`;
  }
  box.innerHTML = h;
  box.style.display = (prData && prData.roadmap && prData.roadmap.built) ? 'none' : 'block';
}
function renderExtracted() {
  document.getElementById('prFoundSub').textContent = `${prExtracted.length} question${prExtracted.length === 1 ? '' : 's'} found. Uncheck anything that is not a question you need to write.`;
  document.getElementById('prFoundList').innerHTML = prExtracted.map((q, i) => `<div class="pr-qrow">
      <input type="checkbox" id="prq-${i}" checked><label class="pr-qtext" for="prq-${i}">${drEsc(q.question)}</label>
      ${q.word_limit ? `<span class="pr-qlimit">${q.word_limit} words</span>` : ''}</div>`).join('');
  document.getElementById('prFound').classList.add('show');
}
async function confirmExtracted() {
  const picked = prExtracted.filter((_, i) => { const el = document.getElementById('prq-' + i); return el && el.checked; });
  if (!picked.length) { prStatus('Check at least one question first.', true); return; }
  prStatus('Adding…');
  try {
    const r = await apiFetch(prBase() + '/slots/bulk', 'POST', {questions: picked, upload_id: prUploadId});
    document.getElementById('prFound').classList.remove('show');
    ['prPaste', 'prUrl', 'prFile'].forEach(id => { document.getElementById(id).value = ''; });
    prExtracted = []; prUploadId = null;
    await loadPrep(prPid);
    prStatus(`Added ${r.created} question${r.created === 1 ? '' : 's'}. Press ${drIsOutline() ? 'Outline This Question' : 'Draft This Answer'} on each one, or ${drVerb()} All Answers.`);
  } catch (e) { prStatus(e.message, true); }
}

// ── Application Roadmap ────────────────────────────────────────────────
// Built once per listing on a button press and shared by everyone tracking it; Before You Start is this
// organization's own, from its profile, and never a verdict; the note says what it was built from.
function renderRoadmap(r) {
  const box = document.getElementById('prRoadmap');
  if (!r || !r.available) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const icon = {ok: '✓', check: '?'};
  let body = (r.personal || []).length ? `<h4>Before You Start</h4><ul class="rm-personal">${
    r.personal.map(p => `<li class="rm-${drEsc(p.state)}"><span class="rm-icon">${icon[p.state] || '?'}</span>${drEsc(p.text)}</li>`).join('')}</ul>` : '';
  if (!r.built) {
    body += `<p class="rm-intro">FundBug can read this listing's pages and guidelines, and for a foundation the application instructions in its tax filing, then lay out the documents to gather, the key dates and the steps to apply.</p>
      <button class="dr-btn" id="rmBuild" onclick="buildRoadmap(this)">Build The Application Roadmap</button><span class="rm-note">Takes about a minute.</span>`;
  } else {
    const m = r.roadmap || {}, src = r.sources || [];
    const list = (title, items, fmt, ol) => (items && items.length) ? `<h4>${title}</h4><${ol ? 'ol' : 'ul'} class="rm-list">${items.map(fmt).join('')}</${ol ? 'ol' : 'ul'}>` : '';
    const refTitle = ref => { const x = src.find(s => s.ref === ref); return x ? (x.title || x.kind || '') : (ref === 'S0' ? "FundBug's program record" : ''); };
    if (r.stale) body += '<div class="rm-warn">This listing\'s dates have changed since the roadmap was built. Rebuild it to check for the current cycle.</div>';
    if (m.cycle_note) body += `<div class="rm-warn">${drEsc(m.cycle_note)}</div>`;
    body += list('Documents To Gather', m.documents, d => `<li title="${drEsc(refTitle(d.ref))}">${drEsc(d.item)}</li>`);
    body += list('Key Dates', m.key_dates, d => `<li title="${drEsc(refTitle(d.ref))}"><b>${drEsc(d.label)}</b>${d.date ? ': ' + drEsc(d.date) : ''}</li>`);
    body += list('How To Apply', m.how_to_apply, d => `<li title="${drEsc(refTitle(d.ref))}">${drEsc(d.step || d)}</li>`, true);
    body += list('Who Can Apply', m.eligibility, d => `<li title="${drEsc(refTitle(d.ref))}">${drEsc(d.item || d)}</li>`);
    if ((m.questions || []).length) {
      body += list('Questions You’ll Answer', m.questions, q => `<li>${drEsc(q.question)}${q.word_limit ? ` <span class="rm-limit">${q.word_limit} words</span>` : ''}</li>`);
      body += '<button class="dr-btn ghost small" onclick="roadmapAddQuestions()">Add These Questions</button>';
    }
    body += list('Worth Knowing', m.worth_knowing, d => `<li title="${drEsc(refTitle(d.ref))}">${drEsc(d.item || d)}</li>`);
    if (src.length) body += `<h4>Sources</h4><ul class="rm-sources">${src.map(s => {
      const name = s.title || s.kind || 'Source';
      const link = s.url ? `<a href="${drEsc(s.url)}" target="_blank" rel="noopener">${drEsc(name)}</a>` : drEsc(name);
      const bits = [drEsc(s.kind || '')];
      if (s.document_date) bits.push('dated ' + drEsc(s.document_date));
      if (s.read_at) bits.push('read ' + drEsc(drWhen(s.read_at)));
      return `<li>${link} (${bits.filter(Boolean).join(', ')})${s.past_cycle ? ' <span class="rm-old">May describe an earlier cycle</span>' : ''}</li>`;
    }).join('')}</ul>`;
    body += `<div class="rm-foot"><span>${drEsc(r.note || 'Built ' + drWhen(r.built_at) + '. Check the funder\'s current instructions before you submit.')}</span>
      <button class="dr-btn ghost small" onclick="buildRoadmap(this)">Rebuild</button></div>`;
  }
  box.innerHTML = `<div class="rm-head"><h3>Application Roadmap</h3><button class="dr-btn ghost small" onclick="toggleRoadmap()">${prRoadmapOpen ? 'Hide' : 'Show'}</button></div>
    <div class="rm-body"${prRoadmapOpen ? '' : ' hidden'}>${body}</div>`;
  if (r.built) document.getElementById('prPlan').style.display = 'none';
}
function toggleRoadmap() { prRoadmapOpen = !prRoadmapOpen; renderRoadmap(prData && prData.roadmap); }
async function buildRoadmap(btn) {
  btn.disabled = true; btn.textContent = 'Building… about a minute';
  prStatus("Reading the listing's pages, guidelines and anything else FundBug has on file.");
  try {
    const r = await apiFetch(prBase() + '/roadmap', 'POST', {});
    prData.roadmap = r; prRoadmapOpen = true;
    renderRoadmap(r);
    prStatus('Roadmap ready.');
  } catch (e) { prStatus(e.message, true); btn.disabled = false; btn.textContent = 'Build The Application Roadmap'; }
}
function roadmapAddQuestions() {
  const q = ((prData && prData.roadmap && prData.roadmap.roadmap) || {}).questions || [];
  if (!q.length) return;
  prExtracted = q.map(x => ({label: x.label || '', question: x.question, word_limit: x.word_limit || null}));
  prUploadId = null;
  renderExtracted();
  document.getElementById('prFound').scrollIntoView({behavior: 'smooth', block: 'nearest'});
}
