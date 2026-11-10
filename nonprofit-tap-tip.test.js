// Tap to see (Nov 2 2026): a phone has no hover, so a chart dot's, a stack band's or a Giving Change figure's details show
// on a tap. Run: node nonprofit-tap-tip.test.js   (uses jsdom from ../fundbug-review/node_modules)
const fs = require('fs');
const { JSDOM } = require(__dirname + '/../fundbug-review/node_modules/jsdom');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const handler = html.match(/\/\/ Tap to see[\s\S]*?\n\}\)\(\);/)[0];
const dom = new JSDOM(`<body><svg><circle data-tip="Lee Youth Arts, Lee: $5,000" r="5"></circle></svg>
  <span id="g" data-tip="Up 25% from 2023">▲ 25%</span><p id="plain">text</p></body>`, { runScripts: 'outside-only' });
const w = dom.window;
w.eval(handler);
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
click(w.document.querySelector('circle'));
let box = w.document.querySelector('.tap-tip');
ok(box && box.textContent === 'Lee Youth Arts, Lee: $5,000', 'a tap on a chart dot shows its details');
click(w.document.getElementById('g'));
box = w.document.querySelectorAll('.tap-tip');
ok(box.length === 1 && box[0].textContent === 'Up 25% from 2023', 'a tap elsewhere shows that one instead, never two');
click(w.document.getElementById('g'));
ok(!w.document.querySelector('.tap-tip'), 'a second tap on the same one hides it');
click(w.document.getElementById('g')); click(w.document.getElementById('plain'));
ok(!w.document.querySelector('.tap-tip'), 'a tap anywhere else hides it');
const js = fs.readFileSync(__dirname + '/nonprofit-funding-plan.js', 'utf8');
ok(/class="fp-band" data-key="\$\{s\.key\}" data-tip=/.test(js), 'the stack bands carry their figures for a tap');
const land = fs.readFileSync(__dirname + '/nonprofit-landscape.js', 'utf8');
ok(/<circle data-tip=/.test(html) && /data-tip="\$\{escHtml\(changeWords\(g\)\)\}"/.test(land), 'chart dots and Giving Change carry them too');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
