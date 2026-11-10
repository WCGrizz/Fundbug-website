// My Answers navigation (Nov 10 2026, Will: "what if someone has 30 different answers?"; "Yes, folded by default"):
// each answer one line until opened, its status (Needs Review, Empty, Saved), search and filters with counts, the
// standard questions apart from the organization's own, a link for each answer, edits kept through a redraw.
// Run: node nonprofit-answers-nav.test.js
const fs = require('fs');
const vm = require('vm');
const js = fs.readFileSync(__dirname + '/answers-nav.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/nonprofit-drafting.js', 'utf8');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const els = {};
const el = id => els[id] || (els[id] = {id, innerHTML: '', textContent: '', style: {}, disabled: false, hidden: false,
  classList: {add() {}, remove() {}, toggle() {}, contains: () => false}, querySelectorAll: () => [], querySelector: () => null, appendChild() {}, scrollIntoView() {}});
const ctx = {console, document: {getElementById: el, querySelectorAll: () => [], createElement: () => ({hidden: false})}, location: {hash: '#np_who_you_serve', pathname: '/nonprofit/answers'},
  history: {replaceState() {}}, requestAnimationFrame: f => f(), escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
  window: {addEventListener() {}}, MODE: 'account', NAV_BASE: '/nonprofit'};
vm.createContext(ctx);
vm.runInContext(js + '\n;globalThis.__d = {drState, drQuestionStart, drSumRow, drNavHtml, renderDrafting, DR_VIEW, setData: d => { drData = d; }};', ctx);
const d = ctx.__d;

ok(d.drState(true, 'x', '') === 'review' && d.drState(false, '', 'an outline') === 'review', "FundBug's draft, or an outline not written up, needs review");
ok(d.drState(false, '', '') === 'empty' && d.drState(false, 'Our answer.', '') === 'saved', 'nothing is Empty; an answer of its own is Saved');
ok(d.drQuestionStart('word '.repeat(60)).length <= 111 && d.drQuestionStart('Short question?') === 'Short question?', 'the folded line shows the start of the question');
const row = d.drSumRow('answers', 'np_x', '<b>Mission</b>', 'Describe it', 'saved', 1, false);
ok(row.includes('&#60;b&#62;Mission') && row.includes('aria-expanded="false"') && row.includes('1 word<') && row.includes('Saved'), 'the folded line: escaped title, closed, word count, status');
ok(/Needs Review \(3\)/.test(d.drNavHtml('answers', {all: 9, review: 3, empty: 2, saved: 4})) && /All \(9\)/.test(d.drNavHtml('answers', {all: 9})), 'each filter says how many');

d.setData({passport: {ready: true}, standard: [{question_type: 'np_mission'}, {question_type: 'np_who_you_serve'}],
  answers: [{question_type: 'custom_board', label: 'Our Board', question_text: 'Who is on your board?', answer_text: '', review_status: 'reviewed'},
            {question_type: 'np_mission', label: 'Mission', question_text: 'What is your mission?', answer_text: 'We teach art.', review_status: 'reviewed'},
            {question_type: 'np_who_you_serve', label: 'Who You Serve', question_text: 'Who do you serve?', answer_text: 'Kids.', review_status: 'draft'}]});
d.renderDrafting();
const cards = els.drCards.innerHTML;
ok(cards.indexOf('Standard Questions') < cards.indexOf('id="drc-np_mission"') && cards.indexOf('Your Own Questions') > cards.indexOf('id="drc-np_who_you_serve"')
   && cards.indexOf('Your Own Questions') < cards.indexOf('id="drc-custom_board"'), 'the standard questions first, then the organization\'s own, under their headings');
ok(/id="drc-np_mission" data-state="saved"/.test(cards) && /class="dr-card folded" id="drc-np_mission"/.test(cards), 'an answer starts folded');
ok(/class="dr-card" id="drc-np_who_you_serve" data-state="review"/.test(cards), 'the answer its link names (#np_who_you_serve) opens');
ok(/id="drc-custom_board" data-state="empty"/.test(cards) && cards.includes("location.origin + '/nonprofit/answers#np_mission'"), 'statuses on each card, and a link to copy');
ok(/Needs Review \(1\)/.test(els.drNav.innerHTML) && /Empty \(1\)/.test(els.drNav.innerHTML) && /Saved \(1\)/.test(els.drNav.innerHTML), 'the filters count the answers');
ok(/const kept = drKeepEdits\('answers', drDirty\);[\s\S]*drPutEdits\('answers', kept, drMarkDirty\);/.test(js) && /const kept = drKeepEdits\('slots', prDirty\);[\s\S]*drPutEdits\('slots', kept, prMarkDirty\);/.test(js),
   'edits not yet saved are kept through a redraw, in My Answers and Prep Application');
ok(/id="drNav"/.test(html) && /id="prNav"/.test(html) && /answers-nav\.js\?v=2026-11-10a/.test(html) && /nonprofit-drafting\.js\?v=2026-11-1\d[a-z]/.test(html), 'both pages have the search and filters, and the new script is loaded');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
