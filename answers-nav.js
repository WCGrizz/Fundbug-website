// Finding an answer among many, for both portals' My Answers and Prep Application (Nov 10 2026). Loaded before
// nonprofit-drafting.js (nonprofit-portal.html) and before portal.html's own script; each page supplies drEsc,
// drAutosize, drWordCount and, for an answer's link, drLinkSet(id, open). Tests: nonprofit-answers-nav.test.js,
// portal-answers-nav.test.js.
// ── Finding an answer among many (Nov 10 2026) ─────────────────────────
// Will: "what if someone has 30 different answers? they currently have to scroll and look at every single one to know
// what question they are looking for"; then "Yes, folded by default". Each answer is one line (its title, the start of
// its question, its status and word count) until opened; search, filters by status (All, Answered, Outline, Empty),
// the standard questions apart from the organization's own, a link for each answer (/nonprofit/answers#<its type>),
// and edits not yet saved kept through every redraw. The Prep Application slots work the same way.
const DR_VIEW = {answers: {open: new Set(), filter: 'all', q: ''}, slots: {open: new Set(), filter: 'all', q: ''}};
const DR_KIND = {answers: {prefix: 'drc-', box: 'drCards', nav: 'drNav', noun: 'answers'}, slots: {prefix: 'prc-', box: 'prSlots', nav: 'prNav', noun: 'questions'}};
// Nov 11 2026 (Will: "The answers shouldnt be flagged 'needs review' if no one flagged them that way. only the user
// should be able to tag things one way or the other"): the status says only what is there, never a judgment FundBug
// made. Answered: it has an answer (FundBug's draft or the organization's own); Outline: an outline, not yet written
// up; Empty: nothing. isDraft is still passed by both portals and no longer changes the status.
const DR_STATES = [['all', 'All'], ['answered', 'Answered'], ['outline', 'Outline'], ['empty', 'Empty']];
function drState(isDraft, answer, outline) {
  if ((answer || '').trim()) return 'answered';
  return (outline || '').trim() ? 'outline' : 'empty';
}
const DR_STATE_BADGE = {answered: '', outline: '<span class="dr-badge empty">Outline</span>', empty: '<span class="dr-badge empty">Empty</span>'};
function drWords(t) { return String(t || '').trim().split(/\s+/).filter(Boolean).length; }
function drQuestionStart(q) { const t = String(q || '').replace(/\s+/g, ' ').trim(); return t.length > 110 ? t.slice(0, 107).replace(/\s+\S*$/, '') + '…' : t; }
// The folded line, which opens and closes the card.
function drSumRow(kind, id, label, question, state, words, open) {
  return `<div class="dr-sum" role="button" tabindex="0" aria-expanded="${open}" onclick="drFold('${kind}', '${id}')"
      onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drFold('${kind}', '${id}'); }">
    <span class="dr-chev" aria-hidden="true">${open ? '▾' : '▸'}</span>
    <span class="dr-sum-main"><b class="dr-sum-title">${drEsc(label || 'Untitled')}</b><span class="dr-sum-q">${drEsc(drQuestionStart(question))}</span></span>
    <span class="dr-sum-meta">${DR_STATE_BADGE[state]}<span class="dr-unsaved">Unsaved</span><span class="dr-sum-wc">${words} word${words === 1 ? '' : 's'}</span></span></div>`;
}
function drFold(kind, id, open) {
  const v = DR_VIEW[kind], card = document.getElementById(DR_KIND[kind].prefix + id); if (!card) return;
  open = open === undefined ? card.classList.contains('folded') : open;
  if (open) v.open.add(id); else v.open.delete(id);
  card.classList.toggle('folded', !open);
  const sum = card.querySelector('.dr-sum');
  if (sum) { sum.setAttribute('aria-expanded', String(open)); sum.querySelector('.dr-chev').textContent = open ? '▾' : '▸'; }
  if (open) { card.querySelectorAll('.dr-q, .dr-a').forEach(drAutosize); card.querySelectorAll('.dr-a').forEach(drWordCount); }
  if (kind === 'answers' && typeof drLinkSet === 'function') drLinkSet(id, open);       // the answer's own link, each portal's way
}
function drFoldAll(kind, open) {
  document.querySelectorAll('#' + DR_KIND[kind].box + ' .dr-card').forEach(c => { if (!c.hidden) drFold(kind, c.id.slice(DR_KIND[kind].prefix.length), open); });
}
// Search, filters and their counts (counted from what was saved; a search reads what is on the page, edits included).
function drNavHtml(kind, counts) {
  const v = DR_VIEW[kind];
  return `<input type="search" class="dr-search" aria-label="Search your ${DR_KIND[kind].noun}" placeholder="Search your ${DR_KIND[kind].noun}" value="${drEsc(v.q)}" oninput="DR_VIEW.${kind}.q = this.value; drApply('${kind}')">
    <div class="dr-chips" role="group" aria-label="Show">${DR_STATES.filter(([k]) => k === 'all' || counts[k] || v.filter === k).map(([k, l]) => `<button class="dr-chip${v.filter === k ? ' on' : ''}" data-k="${k}" aria-pressed="${v.filter === k}" onclick="drSetFilter('${kind}', '${k}')">${l} (${counts[k] || 0})</button>`).join('')}</div>
    <span class="dr-nav-acts"><button class="dr-btn ghost small" onclick="drFoldAll('${kind}', true)">Open All</button><button class="dr-btn ghost small" onclick="drFoldAll('${kind}', false)">Fold All</button></span>`;
}
function drSetFilter(kind, f) {
  DR_VIEW[kind].filter = f;
  document.querySelectorAll('#' + DR_KIND[kind].nav + ' .dr-chip').forEach(b => { const on = b.dataset.k === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  drApply(kind);
}
function drApply(kind) {
  const v = DR_VIEW[kind], box = document.getElementById(DR_KIND[kind].box); if (!box) return;
  const words = v.q.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  box.querySelectorAll('.dr-card').forEach(c => {
    const text = [...c.querySelectorAll('.dr-label, .dr-q, .dr-a')].map(e => e.value).join(' ').toLowerCase();
    const ok = (v.filter === 'all' || c.dataset.state === v.filter) && words.every(w => text.includes(w));
    c.hidden = !ok; if (ok) shown++;
  });
  box.querySelectorAll('.dr-group').forEach(g => {
    let n = g.nextElementSibling, any = false;
    while (n && !n.classList.contains('dr-group')) { if (n.classList.contains('dr-card') && !n.hidden) any = true; n = n.nextElementSibling; }
    g.hidden = !any;
  });
  let none = box.querySelector('.dr-none');
  if (!none) { none = document.createElement('p'); none.className = 'dr-none'; box.appendChild(none); }
  none.textContent = shown ? '' : `No ${DR_KIND[kind].noun} match. Clear the search or choose All.`;
  none.hidden = !!shown;
}
// Edits not yet saved, read before a redraw and put back after it.
function drKeepEdits(kind, dirty) {
  const out = {};
  dirty.forEach(id => { const c = document.getElementById(DR_KIND[kind].prefix + id); if (c) out[id] = [...c.querySelectorAll('.dr-label, .dr-q, .dr-a')].map(e => e.value); });
  return out;
}
function drPutEdits(kind, kept, mark) {
  Object.entries(kept).forEach(([id, vals]) => {
    const c = document.getElementById(DR_KIND[kind].prefix + id); if (!c) return;
    [...c.querySelectorAll('.dr-label, .dr-q, .dr-a')].forEach((e, i) => { if (vals[i] !== undefined) e.value = vals[i]; });
    mark(id);
  });
}
