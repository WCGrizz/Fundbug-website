// A filing's capitals made readable as the Funder Brief makes them (Nov 27 2026): titleCase for names, filingCase for
// sentences. name_case_cases.json is a copy of fundbug/tests/name_case_cases.json, which the brief's tests read; keep
// them the same. Runs without a browser:  node nonprofit-casing.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const cases = JSON.parse(fs.readFileSync(__dirname + '/name_case_cases.json', 'utf8'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const piece = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const src = [piece('const KEEP_CAPS', ';\n};') + ';\n};', piece('function mostlyCaps', '\n}') + '\n}',
             piece('function filingCase(t) {', 'let NAME_WORDS = [];'), 'let NAME_WORDS = [];',
             'const STATE_NAMES = ' + JSON.stringify(['massachusetts', 'new york', 'vermont', 'connecticut']) + ';',
             'const STATE_CODES = new Set(["MA","NY","VT","CT"]);'].join('\n');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__t = {titleCase, filingCase};', ctx);
const t = ctx.__t;
for (const [raw, want] of cases.names) ok(t.titleCase(raw) === want, `name ${raw} -> ${want}` + (t.titleCase(raw) === want ? '' : ` (got ${t.titleCase(raw)})`));
for (const [raw, want] of cases.filings) ok(t.filingCase(raw) === want, `filing ${raw.slice(0, 40)}` + (t.filingCase(raw) === want ? '' : ` (got ${t.filingCase(raw)})`));
process.exit(fails ? 1 : 0);
