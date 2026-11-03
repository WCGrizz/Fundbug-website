// Getting started (Nov 2 2026): four first steps on the Organization Profile, ticked as done, hidden when all are or
// when the person hides it. Run: node nonprofit-checklist.test.js   (jsdom from ../fundbug-review/node_modules)
const fs = require('fs');
const { JSDOM } = require(__dirname + '/../fundbug-review/node_modules/jsdom');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const dom = new JSDOM('<body><div id="gsCard" hidden></div></body>', { runScripts: 'outside-only', url: 'https://fundbug.net/nonprofit-portal' });
const w = dom.window;
w.eval([grab(/function escHtml\([\s\S]*?\n\}/), "function viewerKey() { return 'me'; }",
        grab(/const GS_PROFILE_PCT[\s\S]*?\nfunction drawChecklist[\s\S]*?\n\}/), 'window.t = {checklistSteps, drawChecklist, hideChecklist};'].join('\n'));
const { checklistSteps, drawChecklist, hideChecklist } = w.t;
const steps = checklistSteps({pct: 85, saved: 1, goal: 0, teammates: 0});
ok(steps.map(s => s.done).join() === 'true,false,false,false', 'a fuller profile is done; one saved funder of three is not');
ok(steps[1].why.startsWith('1 saved so far.'), 'it says how many are saved so far');
drawChecklist({pct: 40, saved: 3, goal: 400000, teammates: 1});
const card = w.document.getElementById('gsCard');
ok(!card.hidden && card.textContent.includes('3 of 4 done.') && card.querySelectorAll('li.done').length === 3, 'the card shows what is done and what is left');
ok(card.querySelector('li:not(.done) a').getAttribute('onclick').includes('pfMeterCard'), 'a step left links to where it is done');
drawChecklist({pct: 90, saved: 5, goal: 1, teammates: 2});
ok(card.hidden, 'all four done: the card goes away');
drawChecklist({pct: 0, saved: 0, goal: 0, teammates: 0});
hideChecklist();
ok(card.hidden, 'Hide This hides it');
drawChecklist({pct: 0, saved: 0, goal: 0, teammates: 0});
ok(card.hidden, 'and it stays hidden on the next visit');
ok(/id="gsCard" hidden/.test(html) && /loadChecklist\(\);\n\}/.test(html), 'the profile page has the card and loads it with the meter');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
