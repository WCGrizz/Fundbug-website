// A filing's stock purpose line is shown blank (Nov 27 2026): the portal's BOILERPLATE_RE says what
// np_funder_brief.BOILERPLATE_RE says. Runs without a browser:  node nonprofit-grant-purpose.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const a = html.indexOf('const BOILERPLATE_RE'), b = html.indexOf('function typicalText');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
ok(a > 0 && b > a, 'the portal defines BOILERPLATE_RE and grantPurpose');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + '\n;globalThis.__t = {grantPurpose};', ctx);
const t = ctx.__t;
// The same cases as tests/test_np_funder_brief.py and the Python check of Nov 27 2026.
for (const p of ['EXEMPT PURPOSE', 'Exempt purposes', 'CHARITABLE', 'General charitable purposes', 'SEE ATTACHED',
                 'To further its exempt purpose', 'N/A', 'Various', '501(c)(3)']) ok(t.grantPurpose(p) === '', `"${p}" is left blank`);
for (const p of ['UNRESTRICTED', 'General support', 'Exempt purpose: arts education', 'Charitable purposes for youth'])
  ok(t.grantPurpose(p) === p, `"${p}" is kept`);
ok(/sentenceCase\(grantPurpose\(g\.purpose\)\)/.test(html), 'the grantee table shows grantPurpose');
process.exit(fails ? 1 : 0);
