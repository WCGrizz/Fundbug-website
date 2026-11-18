// The Board Report on the Tracker (Nov 18 2026; backend nonprofit/np_board_report). Run: node nonprofit-board-report.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function boardReportName\([\s\S]*?\n\}/), 'globalThis.f = boardReportName;'].join('\n'), ctx);
ok(ctx.f({subscriber: {business_name: 'Berkshire Youth Arts (Sample)'}}, new Date(2026, 10, 8)) === 'berkshire-youth-arts-sample-board-report-2026-11-08.pdf',
   'the file is named as the backend names it');
ok(ctx.f(null, new Date(2026, 0, 2)) === 'organization-board-report-2026-01-02.pdf', 'no account: a plain name');
ok(/<button class="btn ghost sm acct-only" onclick="boardReportPanel\(\)">Board Report<\/button>/.test(html), 'the Tracker has the button, for a signed-in account only');
const panel = grab(/function boardReportPanel\(\) \{[\s\S]*?\n\}/);
ok(panel.includes('id="brDeclined" checked') && panel.includes('Include Declined Applications'), 'declined applications are in unless unticked');
ok(panel.includes('onclick="closePanel()">Cancel</button>'), 'the panel closes by its Cancel button');
const dl = grab(/async function boardReportDownload\(\) \{[\s\S]*?\n\}/);
ok(dl.includes("'/api/nonprofit/reports/board?declined=' + declined") && dl.includes("'Authorization': 'Bearer '"), 'it asks the backend with the sign-in');
ok(dl.includes("err.textContent = 'Could not make the report: '"), 'a failure says so in the panel, never silently');
ok(/function fpPanel\(/.test(fs.readFileSync(__dirname + '/nonprofit-funding-plan.js', 'utf8')) && html.includes('<script src="/nonprofit-funding-plan.js'),
   'fpPanel exists (nonprofit-funding-plan.js, loaded by the page)');
['closePanel', 'fbSaved', 'fbErrorText', 'load'].forEach(n =>
  ok(new RegExp('function ' + n + '\\(').test(html), n + ' exists'));
ok(/const FB_OFFLINE = /.test(html) && /const TOKEN_KEY/.test(html) || /TOKEN_KEY\s*=/.test(html), 'FB_OFFLINE and TOKEN_KEY exist');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
