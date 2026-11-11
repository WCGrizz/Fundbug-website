// Saving, confirming and errors, one way everywhere (Nov 11 2026, Will: "1,2,3 first"). Run: node nonprofit-feedback.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const files = ['nonprofit-drafting.js', 'nonprofit-funding-plan.js', 'nonprofit-files.js', 'nonprofit-board.js', 'nonprofit-tour.js',
  'nonprofit-landscape.js', 'nonprofit-tracker-history.js', 'answers-nav.js'].map(f => [f, fs.readFileSync(__dirname + '/' + f, 'utf8')]);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const code = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

// 2. Never the browser's own boxes.
const scripts = (html.match(/<script>([\s\S]*?)<\/script>/g) || []).join('\n');
const bare = [['nonprofit-portal.html', scripts], ...files].filter(([, s]) => /(^|[^.\w])(alert|confirm|prompt)\(/m.test(code(s))).map(([f]) => f);
ok(!bare.length, 'no alert, confirm or prompt box anywhere in the nonprofit portal' + (bare.length ? ': ' + bare.join(', ') : ''));

const doc = {body: {appendChild(e) { doc.made.push(e); }}, made: [], getElementById: id => doc.made.find(e => e.id === id) || null,
  createElement: () => { const e = {id: '', className: '', innerHTML: '', attrs: {}, cls: new Set(),
    setAttribute(k, v) { e.attrs[k] = v; }, classList: {add: c => e.cls.add(c), remove: c => e.cls.delete(c)},
    querySelectorAll: () => e.btns || [], querySelector: () => (e.btns || [])[1]}; return e; }};
const ctx = {document: doc, setTimeout: () => 0, clearTimeout() {}, Promise};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function fbErrorText\([\s\S]*?\n\}/), grab(/const FB_OFFLINE = .*/),
  grab(/let FB_NOTE_T = null;[\s\S]*?function fbProblem\(text\) \{[^\n]*\}/), grab(/function fbConfirm\([\s\S]*?\n\}/),
  "const TRACKER = {stages: [{code: 'submitted', label: 'Submitted'}]};", grab(/function stageLabel\(code\) \{[\s\S]*?\n\}/),
  grab(/const MONTH_NAMES = .*/), grab(/function shortDay\(iso\).*/), grab(/function trackerSavedText\(c\) \{[\s\S]*?\n\}/),
  'globalThis.t = {fbErrorText, FB_OFFLINE, fbSaved, fbProblem, fbConfirm, trackerSavedText};'].join('\n'), ctx);
const t = ctx.t;

// 3. Plain words.
ok(t.fbErrorText(500, null).startsWith("Something went wrong on FundBug's side") && !/\b500\b/.test(t.fbErrorText(500, null)), 'a server fault says what to do, never a code');
ok(t.fbErrorText(401) === 'Your sign-in has expired. Sign in again to carry on.' && t.fbErrorText(429).startsWith('Too many tries'), 'expired sign-in, too many tries');
ok(t.fbErrorText(404, 'That file is not in this account.') === 'That file is not in this account.', "the server's own words when it wrote them for people");
ok(t.fbErrorText(502, 'Traceback: KeyError') .startsWith("Something went wrong"), "a server fault's own text is never shown");
ok(/catch \(e\) \{ const err = new Error\(FB_OFFLINE\)/.test(html) && t.FB_OFFLINE.includes('Check your internet connection'), 'no connection: says so');
ok(!/The server answered/.test(html), 'no "The server answered" anywhere');

// 1. A change that saves at once says so.
t.fbSaved('Saved: stage set to Submitted.');
const note = doc.getElementById('fbNote');
ok(note && note.innerHTML.includes('✓ Saved: stage set to Submitted.') && note.attrs.role === 'status' && note.className === '', 'the Saved note');
t.fbProblem('Not saved: <x>');
ok(note.className === 'bad' && note.innerHTML.includes('Not saved: &lt;x&gt;') && note.innerHTML.includes('aria-label="Close"'), 'a problem in red, closable, escaped');
ok(t.trackerSavedText({status: 'submitted'}) === 'Saved: stage set to Submitted.' && t.trackerSavedText({follow_up_date: '2026-11-20'}) === 'Saved: follow up on Nov 20.'
   && t.trackerSavedText({is_favorite: true}) === 'Starred.' && t.trackerSavedText({dismissed: true}) === 'Removed from your Tracker.', 'each Tracker change says what it saved');
ok(/fbSaved\(trackerSavedText\(changes\)\)/.test(html) && /fbProblem\('Not saved: ' \+ e\.message\)/.test(html), 'Tracker changes: Saved, or Not saved with the reason');
const fp = files.find(([f]) => f === 'nonprofit-funding-plan.js')[1];
ok((fp.match(/fbSaved\(\)/g) || []).length >= 2 && /Your advisor can see your Funding Plan|your advisor can see your Funding Plan/.test(html), 'the Funding Plan and its sharing say Saved');

// 2. FundBug's own confirm: says what happens, Cancel, an action that names itself; only its buttons close it.
const p = t.fbConfirm('They come off your list.', {title: 'Remove This Donor?', yes: 'Remove Donor', danger: true});
const box = doc.getElementById('fbConfirm');
ok(box.innerHTML.includes('Remove This Donor?') && box.innerHTML.includes('>Cancel<') && box.innerHTML.includes('>Remove Donor<') && box.innerHTML.includes('btn danger'),
   'the confirm names its action and offers Cancel');
ok(!/addEventListener\('click', \(\) => done\(false\)\)|onclick=.*scrim/.test(grab(/function fbConfirm\([\s\S]*?\n\}/)), 'it closes only by its buttons, never a click outside');
ok(/await fbConfirm\(/.test(fp) && /async function fpRemoveItem/.test(fp), 'removing a plan item or donor asks first, in FundBug\'s panel');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
