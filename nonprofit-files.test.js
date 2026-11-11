// An organization's files on the page (nonprofit-files.js, Nov 11 2026). Run: node nonprofit-files.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-files.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {module: {exports: {}}, Date, Math, JSON, String, Number};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/const MONTH_NAMES = .*/), grab(/function shortDay\(iso\).*/), js].join('\n'), ctx);
const f = ctx.module.exports;

ok(f.fileSize(2400) === '2 KB' && f.fileSize(5 * 1048576) === '5 MB' && f.fileSize(1572864) === '1.5 MB', 'sizes read plainly');
ok(f.filesDom('p:user_1') === 'tf-user_1' && f.filesDom('docs') === 'docsBox', 'each place has its box');
const d = {files: [
  {id: 'v2', group: 'g1', name: 'Budget <FY27>.xlsx', size: 30000, version: 2, versions: 2, visibility: 'team', added_by: 'Bea', added_at: '2026-11-11T10:00:00Z', from_advisor: false},
  {id: 'k1', group: 'g2', name: 'Narrative marked up.pdf', size: 90000, version: 1, versions: 1, visibility: 'shared', added_by: 'Karen', added_at: '2026-11-10T10:00:00Z', from_advisor: true}],
  removed: [{id: 'r1', group: 'g3', name: 'Old letter.pdf'}], you: {id: 'ann', manager: true}};
const sec = f.filesSectionHtml('p:p1', d);
ok(sec.includes('Budget &lt;FY27&gt;.xlsx') && !sec.includes('<FY27>'), 'a file name is escaped');
ok(sec.includes('Version 2 of 2') && sec.includes('Added by Bea, Nov 11') && sec.includes('Earlier Versions'), 'its version, who added it and when');
ok(/<option value="team" selected>Team Only<\/option>/.test(sec) && sec.includes("filesShare('p:p1', 'g1', 'team', this.value)"), 'its sharing, sent with what the page showed');
ok(sec.includes('From Karen') && (sec.match(/New Version/g) || []).length === 1, "an advisor's copy says who it is from, and is never versioned by the organization");
ok(sec.includes('Removed Files') && sec.includes("filesRestore('p:p1', 'g3')"), 'removed files can be restored');
ok(f.filesSectionHtml('p:p1', {error: 'down', status: 500}).includes('could not be read just now') && !f.filesSectionHtml('p:p1', {error: 'down'}).includes('No files yet'),
   'a failed read says so, never "no files"');
ok(f.filesSectionHtml('p:p1', {error: 'x', status: 503}).includes('being set up'), 'before the table exists: being set up');
const docs = f.docsHtml({files: [{id: 'a', group: 'ga', name: '990.pdf', size: 1, version: 1, versions: 1, visibility: 'shared', added_by: 'Ann', added_at: '2026-11-11', doc_kind: 'form_990'}],
  removed: [], you: {}, doc_kinds: [{code: 'determination_letter', label: 'IRS Determination Letter'}, {code: 'form_990', label: 'Latest Form 990'}, {code: 'other', label: 'Other'}]});
ok(docs.indexOf('IRS Determination Letter') < docs.indexOf('Latest Form 990') && docs.includes('Not added yet.') && docs.includes('990.pdf') && !docs.includes('<h3 class="fp-h3">Other</h3>'),
   'Documents: each kind in order, what is missing said so, Other only when used');
ok(/<option value="form_990">Latest Form 990<\/option>/.test(docs), 'adding a document asks what it is');
ok(/\{path: 'organization\/documents', page: 'documents', label: 'Documents', acct: true/.test(html) && /id="page-documents"/.test(html), 'Documents is a page under Organization');
ok(/<div class="tf" id="tf-\$\{pid\}">/.test(html) && /if \(open && !FILES\['p:' \+ pid\]\) filesLoad\('p:' \+ pid\);/.test(html), "each Tracker item has its Files, read when it is opened");
ok(/const w = window\.open\('', '_blank'\);/.test(js) && /\/link'\)/.test(js), 'a file opens through its short-lived link');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
