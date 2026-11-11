// The business portal's My Answers navigation (Nov 10 2026, Will: built for both portals): its own renderDrafting and
// renderSlots, with answers-nav.js, fold each answer to one line, search and filter, group, keep unsaved edits, and an
// answer's link is #answer=<question>. Runs the page's own functions. Run: node portal-answers-nav.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/portal.html', 'utf8');
const nav = fs.readFileSync(__dirname + '/answers-nav.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const fn = name => { const a = html.indexOf('function ' + name + '('); if (a < 0) throw new Error('no ' + name); return html.slice(a, html.indexOf('\n}\n', a) + 2); };
const els = {};
const el = id => els[id] || (els[id] = {id, innerHTML: '', textContent: '', style: {}, disabled: false, hidden: false, dataset: {},
  classList: {add() {}, remove() {}, toggle() {}, contains: () => false}, querySelectorAll: () => [], querySelector: () => null, appendChild() {}, scrollIntoView() {}});
const ctx = {console, document: {getElementById: el, querySelectorAll: () => [], createElement: () => ({hidden: false})},
  window: {location: {hash: '#answer=use_of_funds', pathname: '/portal.html', origin: 'https://fundbug.net'}}, history: {replaceState() {}},
  requestAnimationFrame: f => f(), drDirty: new Set(), prDirty: new Set(), drIsOutline: () => false, renderMeter() {},
  drBadge: () => '', drOutlinePanel: () => '', drWhen: () => 'today', prSuggestionBox: () => '', drAutosizeAll() {}, drWordCount() {}, drAutosize() {}};
vm.createContext(ctx);
vm.runInContext(nav + '\n' + ['drEsc', 'renderDrafting', 'renderSlots', 'drLinkGet', 'drLinkSet', 'drMarkDirty', 'prMarkDirty'].map(fn).join('\n') +
  '\n;globalThis.__p = {renderDrafting, renderSlots, drLinkGet, setDr: d => { drData = d; }, setPr: d => { prData = d; }};\nvar drData = null, prData = null;', ctx);
const p = ctx.__p;
ok(p.drLinkGet() === 'use_of_funds', "an answer's link is #answer=<question>");

p.setDr({passport: {ready: true}, standard: [{question_type: 'business_description'}, {question_type: 'use_of_funds'}],
  answers: [{question_type: 'custom_q1', label: 'Hiring Plan', question_text: 'How many people will you hire?', answer_text: '', review_status: 'reviewed'},
            {question_type: 'business_description', label: 'About Your Business', question_text: 'Describe your business.', answer_text: 'We bake bread.', review_status: 'reviewed'},
            {question_type: 'use_of_funds', label: "How You'll Use the Funds", question_text: 'How will you use the funds?', answer_text: 'An oven.', review_status: 'draft'}]});
p.renderDrafting();
const cards = els.drCards.innerHTML;
ok(cards.indexOf('Standard Questions') < cards.indexOf('id="drc-business_description"') && cards.indexOf('Your Own Questions') < cards.indexOf('id="drc-custom_q1"')
   && cards.indexOf('id="drc-use_of_funds"') < cards.indexOf('Your Own Questions'), 'standard questions first, then the business\'s own, under headings');
ok(/class="dr-card folded" id="drc-business_description"[^>]*data-state="answered"/.test(cards), 'an answer starts folded, Answered');
ok(/class="dr-card" id="drc-use_of_funds"[^>]*data-state="answered"/.test(cards), 'the answer its link names opens (a draft is Answered, never flagged)');
ok(/id="drc-custom_q1"[^>]*data-state="empty"/.test(cards) && cards.includes(`drCopyLink('business_description', this)`), 'Empty, and a link to copy');
ok(/All \(3\)/.test(els.drNav.innerHTML) && /Answered \(2\)/.test(els.drNav.innerHTML) && !/Needs Review/.test(els.drNav.innerHTML), 'the filters count the answers');

p.setPr({passport: {ready: true}});
els.prToolbar = el('prToolbar'); els.prProgress = el('prProgress'); els.prDraftAllBtn = el('prDraftAllBtn');
p.renderSlots([{id: 's1', label: 'Mission', question_text: 'Your mission?', answer_text: 'Bread for all.', review_status: 'reviewed'},
               {id: 's2', label: 'Budget', question_text: 'Your budget?', answer_text: '', review_status: 'reviewed'}]);
ok(/class="dr-card folded" id="prc-s1"/.test(els.prSlots.innerHTML) && /1\. Mission/.test(els.prSlots.innerHTML) && /Empty \(1\)/.test(els.prNav.innerHTML),
   'Prep Application slots fold, numbered, with their filters');
ok(/id="drNav"/.test(html) && /id="prNav"/.test(html) && html.indexOf('<script src="/answers-nav.js') < html.indexOf('<script>\nconst API'),
   'both pages have the bars, and the shared file loads before the page\'s own scripts');
ok(/\/\^answer=\[A-Za-z0-9_-\]\+\$\/\.test\(hash\)/.test(html), 'opened at #answer=<question>, the portal opens My Answers');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
