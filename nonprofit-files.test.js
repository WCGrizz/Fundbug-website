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
ok(sec.includes('Version 2 of 2') && /Uploaded Nov 11, 2026, \d{1,2}:\d\d [AP]M by Bea/.test(sec) && sec.includes('Earlier Versions'),
   'its version, and when it was uploaded (date and time) and by whom');
// Titles (Nov 11 2026, Will: "should be able to add a title to the file").
const titled = f.filesSectionHtml('p:p1', {files: [{id: 't1', group: 'gt', title: 'Mural <budget>', name: 'budget_v3_FINAL.xlsx', size: 1, version: 1, versions: 1,
  visibility: 'team', added_by: 'Ann', added_at: '2026-11-11T19:14:00Z', from_advisor: false}], removed: [], you: {}});
ok(titled.indexOf('Mural &lt;budget&gt;') >= 0 && titled.indexOf('Mural &lt;budget&gt;') < titled.indexOf('budget_v3_FINAL.xlsx') && titled.includes('Edit Title'), 'the title above the file name, editable');
ok(sec.includes('Add A Title') && !/From Karen[\s\S]*Add A Title/.test(sec.slice(sec.indexOf('From Karen') - 900)), "an untitled file offers Add A Title; an advisor's copy is not the organization's to title");
ok(/placeholder="Title \(optional\), e\.g\. Project budget"/.test(sec) && /fd\.append\('title', title\.value\.trim\(\)\)/.test(js), 'adding a file takes a title');
ok(/\/title', 'POST', \{title: input\.value\.trim\(\), seen: f\.title \|\| null\}/.test(js), 'Edit Title sends the title the page showed');
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
f.FX_SAVED.g1 = 'Saved: your advisor can open it';
ok(f.filesSectionHtml('p:p1', d).includes('<span class="fx-saved" role="status">Saved: your advisor can open it</span>'), 'a sharing change says it was saved, beside the file');
delete f.FX_SAVED.g1;
ok(/filesSaid\(key, group, value === 'shared' \? 'Saved: your advisor can open it' : 'Saved: your team only'\)/.test(js) && /filesSaid\(key, group, 'Not saved: ' \+ e\.message\)/.test(js),
   'it says Saved, or Not Saved with the reason');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
