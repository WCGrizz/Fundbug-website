// The short Library card (Nov 10 2026, Will: yes; 566 fits were a lot of reading): name and badges, one line each for
// its giving here, its money and timing, why it may fit; the rest is on its own page. Run: node nonprofit-card.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), 'const MODE = "account"; const MODES = {open: "Open Application Round"};',
  'function typicalText(a, b) { return "$" + a + " to $" + b; } function toSecondPerson(x) { return x.replace(/\\bthe organization\\b/g, "you"); }',
  grab(/var ABBR = .*/), grab(/function sentenceCut\([\s\S]*?\n\}/), grab(/function tierLine\(g\) \{[\s\S]*?\n\}/), grab(/function cardWhy\(m\) \{[\s\S]*?\n\}/), grab(/function matchCard\(m\) \{[\s\S]*?\n\}/),
  'globalThis.matchCard = matchCard;'].join('\n'), ctx);
const m = {id: 'g1', title: 'Lee Bank Foundation', kind: 'funder', reviewed: true, typical_min: 2500, typical_max: 6000, first_grant: 'typically $4,300', mode: 'open',
  where: 'Berkshire County, MA', why: ['Your subjects: Arts and culture', 'Who you serve: Children and youth'],
  verdict: 'strong', verdict_reason: 'It focuses on Berkshire County youth and the arts, where the organization works. ' + 'More detail follows here. '.repeat(10),
  description: 'The Lee Bank Foundation, established in 2021 by Lee Bank, provides grant funding for programs and projects.'};
const c = ctx.matchCard(m);
ok(c.includes('Lee Bank Foundation') && c.includes('Strong Fit') && c.includes('Typical Grant:') && c.includes('Open Application Round'), 'name, badges, money and how');
ok(/Why It May Fit:<\/b> It focuses on Berkshire County youth and the arts, where you works\./.test(c) && (c.match(/More detail/g) || []).length <= 3, 'one line on why it may fit, spoken to the organization');
ok(!c.includes('established in 2021') && !c.includes('<ul class="why">') && !c.includes('Where:') && !c.includes('First Grant:'), 'no description, bullets, Where or First Grant (they are on its page)');
ok(c.includes(`saveListing('g1')`) && c.includes(`hideListing('g1')`) && c.includes(`openListing('g1')`) && !c.includes('prepListing'), 'Save, Hide, Open; Prep Application is on its page');
const no = ctx.matchCard({...m, fits: false, why_not: 'outside its area', verdict: null, verdict_reason: null});
ok(no.includes('May not fit: outside its area') && !no.includes('Why It May Fit'), 'one that may not fit says why, instead');
const plain = ctx.matchCard({...m, verdict: null, verdict_reason: null});
ok(plain.includes('Why It May Fit:</b> Your subjects: Arts and culture'), 'without the fit judge, its first reason');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
