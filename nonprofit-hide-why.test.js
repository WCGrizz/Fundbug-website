// Hide From Matches asks why (Nov 6 2026: Katie Meehan noted a newcomer might not check a grant's eligibility; Will:
// the digest says to check it, and the portal's Hide asks why, as the digest's Not A Fit page does). Nothing is hidden
// until Hide It; the reason goes with it in the organization's own words; Cancel hides nothing; the dialog never closes
// on an outside click.  Run: node nonprofit-hide-why.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const a = html.indexOf("const HIDE_REASONS"), b = html.indexOf('\nfunction alertLine');
ok(a > 0 && b > a, 'the Hide code is found');

const els = {};
const el = id => els[id] || (els[id] = {id, value: '', textContent: '', innerHTML: '', disabled: false,
  classList: {s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, contains(c) { return this.s.has(c); }}});
let picked = null;
const calls = [], drawn = [];
const ctx = {
  document: {getElementById: el, querySelector: q => (q.includes('hideReason') && picked ? {value: picked} : null)},
  escHtml: s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
  apiFetch: async (path, method, body) => { calls.push({path, method, body}); return {hidden: true}; },
  drawMatches: () => drawn.push('matches'), closePanel: () => drawn.push('panel closed'),
  RESULT: null, TRACKER: {}, console,
};
vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + '\n;globalThis.t = {hideListing, confirmHide, closeHide, HIDE_REASONS};\n' +
  "RESULT = {shown: [{id: 'g1', title: 'Head Start Grants'}, {id: 'g2', title: 'Other'}], counts: {shown: 2}};", ctx);
const t = ctx.t;

(async () => {
  t.hideListing('g1', true);
  ok(el('hideModal').classList.contains('open') && calls.length === 0, 'Hide opens the dialog and hides nothing yet');
  ok(el('hideText').textContent === "Head Start Grants won't show in your Matches or your digests again.", 'it names the listing');
  ok(t.HIDE_REASONS.includes('Not Eligible') && (el('hideReasons').innerHTML.match(/type="radio"/g) || []).length === 6, 'the six reasons, Not Eligible among them');
  t.closeHide();
  await t.confirmHide();
  ok(calls.length === 0 && !el('hideModal').classList.contains('open'), 'Cancel hides nothing');

  t.hideListing('g1', true);
  picked = 'Not Eligible'; el('hideNote').value = '  we are not a school ';
  await t.confirmHide();
  ok(calls.length === 1 && calls[0].path === '/api/nonprofit/tracker/hide' && calls[0].body.group_id === 'g1'
     && calls[0].body.reason === 'Not Eligible: we are not a school', 'Hide It sends the reason in their words');
  ok(ctx.RESULT.shown.map(x => x.id).join() === 'g2' && drawn.includes('panel closed') && !el('hideModal').classList.contains('open'),
     'the listing leaves Matches and the panel closes');

  picked = null; t.hideListing('g2');
  await t.confirmHide();
  ok(calls[1].body.reason === null && !drawn.slice(2).includes('panel closed'), 'no reason given: none sent; from a card, no panel to close');

  ok(!/hideModal[^\n]*addEventListener\('click'/.test(html) && !/id="hideModal"[^>]*onclick/.test(html), 'the dialog never closes on an outside click');
  ok(/onclick="hideListing\('\$\{id\}', true\)">Hide From Matches</.test(html) && /onclick="hideListing\('\$\{m\.id\}'\)">Hide</.test(html),
     'both Hide buttons open the dialog');
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
