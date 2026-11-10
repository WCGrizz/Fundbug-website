// The Organization Profile folded (Nov 10 2026, the page-by-page plan: "Each section folds into one line that shows its
// answers ... A new organization sees The Basics open and the rest folded"). Run: node nonprofit-profile-fold.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const a = html.indexOf('const PF_OPEN = new Set();'), b = html.indexOf('function pfFoldAfterFill()');
const code = html.slice(a, html.indexOf('\n}', b) + 2);
const vals = {fOrg: 'Berkshire Youth Arts', fEin: '04-1234567', fWeb: 'https://www.bya.org/about', fAbout: 'We teach art to kids.', fZip: '', fBudget: '',
  fSince: '', fAudit: '', fFounded: '', fStaff: '', fVolunteers: '', fOrgType: 'nonprofit_501c3'};
const cls = () => { const c = new Set(); return {toggle: (k, on) => on ? c.add(k) : c.delete(k), has: k => c.has(k)}; };
const cards = ['org', 'basics', 'where', 'subjects', 'populations', 'funding_purposes'].map(k => {
  const sum = {textContent: ''}, btn = {textContent: '', setAttribute() {}}, cl = cls();
  return {dataset: {fold: k}, classList: cl, querySelector: q => q === '.pf-fold-sum' ? sum : q === '.pf-fold-btn' ? btn : null, sum, btn};
});
const ctx = {document: {getElementById: id => id === 'areaSummary' ? {textContent: '  Berkshire County, MA  '} : vals[id] !== undefined ? {value: vals[id], options: [{text: '501(c)(3) public charity'}], selectedIndex: 0} : null,
  querySelectorAll: () => cards, querySelector: q => cards.find(c => q.includes(`"${c.dataset.fold}"`))},
  picks: {subjects: new Set(['A', 'B', 'C', 'D', 'E', 'F']), populations: new Set(), funding_purposes: new Set(['G'])},
  termOf: (f, c) => ({label: 'Term ' + c}), hostOf: u => new URL(u).hostname.replace(/^www\./, ''), requestAnimationFrame: f => f()};
vm.createContext(ctx);
vm.runInContext(code + ';globalThis.__f = {pfSummary, pfFoldAfterFill, pfFold};', ctx);
const f = ctx.__f;
ok(f.pfSummary('org') === 'Berkshire Youth Arts · EIN 04-1234567 · bya.org · About: 5 words', "Your Organization's line: name, EIN, website, the About's length");
ok(f.pfSummary('basics') === '', 'The Basics with nothing in it has no line');
ok(f.pfSummary('where') === 'Berkshire County, MA' && f.pfSummary('subjects') === 'Term A, Term B, Term C, Term D, and 2 more', 'Where You Work, and a picker\'s first choices');
f.pfFoldAfterFill();
const state = k => cards.find(c => c.dataset.fold === k);
ok(state('org').classList.has('pf-folded') && state('org').btn.textContent === 'Edit', 'a section with answers starts folded, with Edit');
ok(!state('basics').classList.has('pf-folded') && state('basics').btn.textContent === 'Done' && state('basics').sum.textContent === 'Nothing here yet.', 'an empty one starts open');
ok(!state('populations').classList.has('pf-folded'), 'an empty picker starts open');
f.pfFold('org');
ok(!state('org').classList.has('pf-folded') && state('org').btn.textContent === 'Done', 'Edit opens it, Done folds it');
ok((html.match(/<div class="card[^"]*"[^>]* data-fold="/g) || []).length === 6 && /pfFoldAfterFill\(\);\n\}/.test(html), 'six sections fold, and they fold by what the saved profile holds');
ok(/const fold = el\.closest\('\.card\[data-fold\]'\);\n  if \(fold && fold\.classList\.contains\('pf-folded'\)\) pfFold\(fold\.dataset\.fold\);/.test(html),
   'a link to a profile field (EIN, website, Where You Work) opens its folded section first');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
