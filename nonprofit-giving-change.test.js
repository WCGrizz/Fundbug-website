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
const grab = (re, src = html) => { const m = src.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/function givingChangeOf\([\s\S]*?\n\}/),
                 grab(/const changeWords = .*/, land), grab(/function changePeriod\([\s\S]*?\n\}/, land), grab(/function givingChangeHtml\([\s\S]*?\n\}/, land),
                 'globalThis.t = {givingChangeOf, givingChangeHtml, changePeriod};'].join('\n'), ctx);
const {givingChangeOf, givingChangeHtml, changePeriod} = ctx.t;

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
// The period (Nov 2 2026, Will: "clearer about the time period its measuring").
const a = {year: 2024, prior_year: 2023, pct: 5}, b = {year: 2025, prior_year: 2024, pct: 5};
eq(changePeriod([a, a, b, null]), '2023 to 2024', 'the heading names the pair most funders compare');
ok(!givingChangeHtml(a, '2023 to 2024').includes('(2023 to 2024)') && givingChangeHtml(b, '2023 to 2024').includes('(2024 to 2025)'),
   'a funder on other years names its own in its cell');
ok(givingChangeHtml({year: 2024, prior_year: 2021, dollars: 1, prior_dollars: 1, pct: 0}, '2023 to 2024').includes('(2021 to 2024)'), 'a gap names the years compared');
ok(/Giving Change\$\{period \? ', ' \+ period : ''\}<\/th>/.test(land), 'the Top Funders heading carries the period');
ok(/given in \$\{ch\.year\} than in \$\{ch\.prior_year\}/.test(html), 'the funder page tile names both years');
eq(givingChangeHtml(null), '', 'none: an empty cell, never 0%');
ok(/givingChangeHtml\(f\.giving_change, period\)/.test(land), 'the Top Funders table shows it');
ok(/givingChangeOf\(p\.by_year\)/.test(html), 'the funder page shows it in At A Glance');
ok(/nonprofit-landscape\.js\?v=2026-11-10b/.test(html), 'the landscape script\'s version tag was bumped');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
