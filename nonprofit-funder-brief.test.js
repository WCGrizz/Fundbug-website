// The Funder Brief on a funder's page (Nov 18 2026; backend nonprofit/np_funder_brief). Run: node nonprofit-funder-brief.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function funderBriefName\([\s\S]*?\n\}/), 'globalThis.f = funderBriefName;'].join('\n'), ctx);
ok(ctx.f('Feigenbaum Foundation', new Date(2026, 10, 18)) === 'feigenbaum-foundation-funder-brief-2026-11-18.pdf', 'named as the backend names it');
ok(ctx.f('', new Date(2026, 0, 2)) === 'funder-funder-brief-2026-01-02.pdf', 'no title: a plain name');
ok(html.includes("${L.kind === 'funder' ? `<button class=\"btn ghost sm\" onclick=\"funderBriefDownload('${id}', this)\">Funder Brief</button>` : ''}"),
   'a funder page has the button, beside Save To Tracker (signed in only), and an opportunity does not');
const dl = grab(/async function funderBriefDownload\(id, btn\) \{[\s\S]*?\n\}/);
ok(dl.includes("'/api/nonprofit/reports/funder/' + encodeURIComponent(id)") && dl.includes("'Authorization': 'Bearer '"), 'it asks the backend with the sign-in');
ok(dl.includes("fbProblem('Could not make the Funder Brief: '") && dl.includes('btn.disabled = false'), 'a failure says so and the button comes back');
['fbProblem', 'fbSaved', 'fbErrorText', 'load'].forEach(n => ok(new RegExp('function ' + n + '\\(').test(html), n + ' exists'));
ok(/let LISTING = null/.test(html), 'LISTING exists');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
