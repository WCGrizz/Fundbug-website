// Home, Fits Only and the tier line (Nov 9 2026, Will: "Yes" to all three).
// Run: node nonprofit-home.test.js   (jsdom from ../fundbug-review/node_modules)
const fs = require('fs');
const { JSDOM } = require(__dirname + '/../fundbug-review/node_modules/jsdom');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const dom = new JSDOM('<body><input type="checkbox" id="mFits"><div id="homePlan" hidden></div></body>',
                      { runScripts: 'outside-only', url: 'https://fundbug.net/nonprofit-portal' });
const w = dom.window;
w.eval([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/const shortMoney = .*/),
        "let VIEWER = 'me'; function viewerKey() { return VIEWER; } window.setViewer = v => { VIEWER = v; };",
        grab(/function homePlanHtml\(plan\) \{[\s\S]*?\n\}/), grab(/function initFitsOnly\(\) \{[\s\S]*?\n\}/),
        grab(/function rememberFitsOnly\(\) \{[\s\S]*?\n\}/), grab(/function tierLine\(g\) \{[\s\S]*?\n\}/),
        'window.t = {homePlanHtml, initFitsOnly, rememberFitsOnly, tierLine};'].join('\n'));
const t = w.t;

// Home's Funding Plan card
const plan = {saved: true, goal: 450000, totals: {secured: 123750, pending: 15000},
  sources: [{label: 'Foundation Grants', planned: 170000, secured: 65000, pending: 0},
            {label: 'Government Grants', planned: 45000, secured: 12500, pending: 0},
            {label: 'Events', planned: 30000, secured: 30000, pending: 0}]};
const card = t.homePlanHtml(plan);
ok(card.includes('$123,750</b> secured of your $450,000 goal (28%)') && card.includes('$15,000 pending') && card.includes('$311,250 still to raise.'),
   'secured of the goal, pending, and what is left to raise');
ok(card.includes('Furthest behind its plan: Foundation Grants, $105,000 still to find.') && card.includes('See The Funders That Could Close It'),
   'the source furthest behind its plan, linked to the funders that could close it');
ok(t.homePlanHtml({saved: false, goal: 0}).includes("Set This Year's Goal"), 'no goal yet: a link to set one');
ok(t.homePlanHtml(null) === '', 'a plan that could not be read shows nothing, never a wrong figure');
ok(t.homePlanHtml({...plan, totals: {secured: 450000, pending: 0}, sources: []}).includes('Your goal is covered.'), 'a covered goal says so');

// Fits Only: on unless this viewer turned it off
const box = w.document.getElementById('mFits');
t.initFitsOnly();
ok(box.checked === true, 'Fits Only is on by default');
box.checked = false; t.rememberFitsOnly(); box.checked = true; t.initFitsOnly();
ok(box.checked === false, 'a viewer who turned it off finds it off next time');
w.setViewer('someone-else'); t.initFitsOnly();
ok(box.checked === true, "another viewer's choice is their own");

// The tier line
ok(t.tierLine({label: 'A Major Funder In Berkshire County', grants: 147, dollars: 6272553, year: 2024}) ===
   '<div class="tier-line"><b>A Major Funder In Berkshire County</b> (147 grants, $6.27M, 2024)</div>', 'the tier line with its grants, dollars and year');
ok(t.tierLine({label: 'Has Given In Berkshire County', grants: 1, dollars: 3000, year: 2025}).includes('(1 grant, $3K, 2025)'), 'one grant is singular');
ok(t.tierLine(null) === '' && t.tierLine({}) === '', 'nothing for a listing without a tier');
ok(/\$\{m\.relationship \? '<span class="badge">Relationship Funder<\/span>' : ''\}/.test(html) && /\$\{tierLine\(m\.giving\)\}/.test(html),
   'the card shows the Relationship Funder badge and the tier line');
ok(/<a data-page="home" class="acct-only" onclick="showPage\('home'\)">Home<\/a>\s+<a data-page="profile"/.test(html), 'Home comes first in the sidebar');

process.exit(fails ? 1 : 0);
