// Coming Up Again (Nov 2 2026): fitting programs whose round just closed and recurs. Run: node nonprofit-again.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/const MONTH_NAMES = .*/), grab(/function escHtml\([\s\S]*?\n\}/), 'const MODE = "account"; const MODES = {};',
  'function typicalText() { return ""; } function toSecondPerson(x) { return x; } function sentenceCut(x) { return x; }',
  grab(/function tierLine\(g\) \{[\s\S]*?\n\}/), grab(/function cardWhy\(m\) \{[\s\S]*?\n\}/), grab(/function matchCard\(m\) \{[\s\S]*?\n\}/), grab(/function comingAgain\(items\)[\s\S]*?\nfunction comingAgainHtml[\s\S]*?\n\}/),
  'globalThis.t = {comingAgain, againLine, comingAgainHtml};'].join('\n'), ctx);
const { comingAgain, againLine, comingAgainHtml } = ctx.t;
const items = [{id: 'a', title: 'Fits', fits: true}, {id: 'b', title: 'Closed Yearly', fits: false, why_not: 'deadline passed (2026-10-01)', coming_again: {last_deadline: '2026-10-01', next_open: null}},
               {id: 'c', title: 'Far Away', fits: false, why_not: 'outside its area'}];
ok(comingAgain(items).map(m => m.id).join() === 'b', 'only the marked ones');
ok(againLine({last_deadline: '2026-10-01'}) === 'Its last round closed October 1, 2026; it comes round again.' &&
   againLine({next_open: '2027-01-15', last_deadline: '2026-05-01'}) === 'Opens again January 15, 2027.', 'it says when the last round closed, or when the next opens');
const h = comingAgainHtml(comingAgain(items));
ok(h.includes('Coming Up Again (1)') && h.includes('Closed Yearly') && !h.includes('May Not Fit') && !h.includes('May not fit'), 'the section shows it as fitting, not as a misfit');
ok(comingAgainHtml([]) === '', 'none: no section');
ok(/\+ comingAgainHtml\(again\);/.test(html), 'Matches shows the section after the list');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
