// What To Attach on the page (nonprofit-checklist.js, Nov 11 2026). Run: node nonprofit-attach.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-checklist.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {module: {exports: {}}};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), js].join('\n'), ctx);
const c = ctx.module.exports;

const d = {guidelines: 'ok', items: [
  {id: 'a', label: 'IRS <Determination> Letter', source: 'guidelines', quote: 'Attach your IRS determination letter.', status: 'needed', file_group: null, file: null},
  {id: 'b', label: 'Project budget', source: 'application', quote: 'Project budget', status: 'attached', file_group: 'g2', file: {name: 'Mural budget'}},
  {id: 'c', label: 'Photos', source: 'own', quote: '', status: 'not_needed', file_group: null, file: null}],
  proposals: {a: {group: 'g1', name: 'IRS letter 1998.pdf'}},
  choices: [{group: 'g1', name: 'IRS letter 1998.pdf', where: 'Documents'}, {group: 'g2', name: 'Mural budget', where: 'This Program'}]};
const h = c.checkHtml('p1', d);
ok(h.includes('IRS &lt;Determination&gt; Letter') && !h.includes('<Determination>'), 'escaped');
ok(h.includes('From The Funder&#39;s Guidelines') && h.includes('<q>Attach your IRS determination letter.</q>') && h.includes('From Your Application') && h.includes('Added By You'),
   'each line says where it came from, with the funder\'s own words behind it');
ok(h.includes('Your Documents has <b>IRS letter 1998.pdf</b>') && h.includes("checkSet('p1', 'a', 'attached', 'needed', 'g1')"), 'a document on file is suggested, attached only by Use It');
ok(h.includes('Attached: Mural budget') && h.includes('Needed') && h.includes('Not Needed') && h.includes('1 still needed.'), 'Needed, Attached with its file, Not Needed');
ok(/onclick="checkRemove\('p1', 'c'\)"/.test(h) && !/checkRemove\('p1', 'a'\)/.test(h), 'only your own lines can be removed');
ok(c.checkHtml('p1', {guidelines: 'failed', items: []}).includes("The funder's list could not be read just now"), 'a failed read says so, never "nothing needed"');
ok(c.checkHtml('p1', {guidelines: 'none', items: []}).includes("don't name documents to send"), 'nothing listed says why and what to do');
ok(c.checkHtml('p1', {guidelines: 'ok', items: [{id: 'x', label: 'W-9', source: 'own', status: 'attached', file: {name: 'w9.pdf'}}]}).includes('Everything here is attached or not needed.'),
   'all done says so, never "0 still needed"');
ok(/<div class="tc" id="tc-\$\{pid\}">/.test(html) && /checkLoad\(pid\);   \/\/ and its What To Attach/.test(html), 'in each Tracker item, read when it opens');
ok(/fbSaved\(status === 'attached'/.test(js) && /fbProblem\('Not saved: '/.test(js), 'every change says Saved or what went wrong');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
