// nonprofit-landscape.js runs on two pages: the nonprofit portal and the advisor portal (fundbug-advisor/np-side.js),
// which loads it from fundbug.net and supplies only apiFetch, escHtml, money, MODE, showPage and openListing. On Nov 10
// 2026 the advisor's landscape failed with "changePeriod is not defined": the file had come to lean on a helper only
// the portal page defines. This draws the real Berkshire landscape with nothing but those six names.
// Runs without a browser: node nonprofit-landscape-host.test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const els = {};
const el = id => els[id] || (els[id] = {id, textContent: '', innerHTML: '', value: '', focus() {}, setSelectionRange() {}});
const ctx = {
  console, document: {getElementById: el}, window: {scrollTo() {}},
  // The six names a host supplies, as the advisor's np-side.js and advisor.html define them.
  apiFetch: async () => { throw new Error('no network in the test'); },
  escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
  money: n => (n == null || n === '') ? '' : '$' + Number(n).toLocaleString('en-US'),
  MODE: 'account', showPage() {}, openListing() {},
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'nonprofit-landscape.js'), 'utf8'), ctx);
const file = path.join(__dirname, '..', 'fundbug', 'nonprofit', 'data', 'landscape_MA_25003.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const view of ['community', 'all']) {
  vm.runInContext(`LAND = ${JSON.stringify(data[view])}; LAND_VIEW = '${view}';`, ctx);
  let err = null;
  try { vm.runInContext('drawLandscape()', ctx); } catch (e) { err = e; }
  ok(!err, `the ${view} view draws with only the host's six names` + (err ? `  (${err.message})` : ''));
  ok(el('lBody').innerHTML.includes('Giving Change') || el('lBody').innerHTML.length > 1000, `the ${view} view has its funder table`);
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
