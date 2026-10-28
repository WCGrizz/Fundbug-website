// A funder's giving, its latest filing against the one before (Oct 28 2026, Will: "a percentage change from the latest
// 990 to the 2nd latest 990 next to top funders"). The same cases as tests/test_np_landscape.py's giving_change test in
// the backend, so the page and np_giving_profile.giving_change agree. Runs without a browser:
// node nonprofit-giving-change.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const land = fs.readFileSync(__dirname + '/nonprofit-landscape.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)})`));
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/function givingChangeOf\([\s\S]*?\n\}/),
                 grab(/const changeWords = .*/), grab(/function givingChangeHtml\([\s\S]*?\n\}/),
                 'globalThis.t = {givingChangeOf, givingChangeHtml};'].join('\n'), ctx);
const {givingChangeOf, givingChangeHtml} = ctx.t;

eq(givingChangeOf({'2023': {dollars: 100000}, '2024': {dollars: 125000}, '2022': {dollars: 1}}),
   {year: 2024, prior_year: 2023, dollars: 125000, prior_dollars: 100000, pct: 25}, 'the latest year against the one before it');
eq(givingChangeOf({'2023': {dollars: 200000}, '2024': {dollars: 50000}}).pct, -75, 'a drop is negative');
eq(givingChangeOf({'2021': {dollars: 100000}, '2024': {dollars: 90000}}).prior_year, 2021, 'a missing year is skipped, never a zero');
eq(givingChangeOf({'2024': {dollars: 90000}}), null, 'one year on file: none');
eq(givingChangeOf({'2023': {dollars: 0}, '2024': {dollars: 90000}}), null, 'nothing given the year before: none');
eq(givingChangeOf(null), null, 'no profile: none');

const up = givingChangeHtml({year: 2024, prior_year: 2023, dollars: 125000, prior_dollars: 100000, pct: 25});
ok(up.includes('▲ 25%') && up.includes('title="Up 25% from 2023: $125,000 in its 2024 filing, $100,000 in 2023"'), 'up: an arrow, and the amounts on hover');
ok(givingChangeHtml({year: 2024, prior_year: 2023, dollars: 1, prior_dollars: 4, pct: -75}).includes('▼ 75%'), 'down: the arrow down, the figure without a minus');
ok(givingChangeHtml({year: 2024, prior_year: 2021, dollars: 1, prior_dollars: 1, pct: 0}).includes('vs 2021'), 'a gap names the year compared');
eq(givingChangeHtml(null), '', 'none: an empty cell, never 0%');
ok(/Giving Change<\/th>[\s\S]*givingChangeHtml\(f\.giving_change\)/.test(land), 'the Top Funders table shows it');
ok(/givingChangeOf\(p\.by_year\)/.test(html), 'the funder page shows it in At A Glance');
ok(/nonprofit-landscape\.js\?v=2026-10-28/.test(html), 'the landscape script\'s version tag was bumped');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
