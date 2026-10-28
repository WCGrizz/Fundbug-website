// A funder's latest grants as a scatter (Oct 28 2026, Will and BBEC: "repeat awardees in one color and first time
// awardees in another"). Runs without a browser:  node nonprofit-scatter.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/const shortMoney = .*/), grab(/const titleCase = .*/),
                 grab(/function grantScatter\(r\) \{[\s\S]*?\n\}/), 'globalThis.grantScatter = grantScatter;'].join('\n'), ctx);
const dots = (svg, color) => (svg.match(new RegExp('<circle[^>]*fill:var\\(' + color + '\\)', 'g')) || []).length;

const pts = [
  {amount: 5000, name: 'NEW ARTS GROUP', city: 'PITTSFIELD', first: true, here: true},
  {amount: 2500, name: 'Another New One', city: 'Lee', first: true, here: false},
  {amount: 10000, name: 'OLD FRIEND INC', city: 'LENOX', first: false, here: false},
  {amount: 20000, name: 'Second Old', city: 'Boston', first: false, here: false},
  {amount: 30000, name: 'Third Old', city: 'Boston', first: false, here: false},
];
const a = ctx.grantScatter({year: 2024, known: true, total: 5, points: pts});
ok(dots(a, '--green-lt') === 2 && dots(a, '--green-dk') === 3, 'first-time grantees light green, repeat grantees dark green');
ok(a.includes('First-time grantees (2)') && a.includes('Repeat grantees (3)'), 'each group labelled with its count');
ok(a.includes('$3,750 for first-time grantees') === false && a.includes('$5,000 for first-time grantees') && a.includes('$20,000 for repeat grantees'),
   'each group\'s typical grant is its median');
ok(a.includes('<title>New Arts Group, Pittsfield: $5,000</title>'), 'hovering a dot names the organization, its town and the amount');
ok((a.match(/stroke:var\(--ink\);stroke-width:1.6/g) || []).length === 1 && a.includes('A dot ringed in black (1)'), 'a grant in your county is ringed');

const most = ctx.grantScatter({year: 2024, known: true, total: 5, points: pts.map(p => ({...p, here: true}))});
ok(!most.includes('stroke-width:1.6') && most.includes('Most of them (5 of 5)'), 'no rings when most grants are in your county; said in words');

const unk = ctx.grantScatter({year: 2024, known: false, total: 5, points: pts.map(p => ({...p, first: null}))});
ok(dots(unk, '--green-lt') === 0 && unk.includes('Grants (5)') && unk.includes('cannot be told apart'),
   'with the earlier filings missing, one group, and the page says why');

const cut = ctx.grantScatter({year: 2023, known: true, total: 900, points: pts});
ok(cut.includes('(the largest 5 of 900)'), 'a capped list says it shows the largest');

ok(ctx.grantScatter({year: 2024, known: true, total: 2, points: pts.slice(0, 2)}).includes('Too few grants'), 'too few grants: no chart');
ok(!ctx.grantScatter({year: 2024, known: true, total: 5, points: [{...pts[0], name: '<b>x</b>'}, ...pts.slice(1)]}).includes('<b>x'), 'names are escaped');
ok(/loadGrantees\(id, 'county', '', 0\); loadGrantPoints\(id\);/.test(html), 'the funder page loads the scatter with its grantees');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
