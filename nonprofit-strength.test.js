// Profile strength (Nov 2 2026): nearby counties with exact counts, missing answers with why they matter.
// Run: node nonprofit-strength.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/const STRENGTH_FIELDS[\s\S]*?\nfunction strengthHtml[\s\S]*?\n\}/), 'globalThis.f = strengthHtml;'].join('\n'), ctx);
const h = ctx.f({area: [{fips: '36021', name: 'Columbia County', state: 'NY', more: 28}, {fips: '50003', name: 'Bennington County', state: 'VT', more: 1}],
                 missing: [{field: 'has_audited_financials', label: 'Whether you have audited financials', why: 'some funders require an audit'}]});
ok(h.includes('If you also work in Columbia County, NY, 28 more listings would fit') && h.includes('Bennington County, VT, 1 more listing would fit'), 'nearby counties with exact counts, singular and plural');
ok(h.includes("goToProfileItem('fAudit')") && h.includes('(some funders require an audit)'), 'a missing answer links to its field and says why');
ok(h.includes("goToProfileItem('whereCard')"), 'the counties link to Where You Work');
ok(ctx.f({area: [], missing: []}) === '' && ctx.f(null) === '', 'nothing to say: nothing shown');
ok(/loadStrength\(\);\n\}/.test(html) && /id="pfStrength" hidden/.test(html), 'the profile loads it under the meter');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
