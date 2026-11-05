// Who is signing up (Nov 5 2026, Will: "the signup needs a swap function between forprofit and nonprofit"): both
// signup pages carry the switch, each naming itself as the current page and linking to the other; the link keeps the
// source tag and never a code.  Run: node signup-switch.test.js
const fs = require('fs');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const biz = fs.readFileSync(__dirname + '/signup.html', 'utf8');
const np = fs.readFileSync(__dirname + '/nonprofit-signup.html', 'utf8');
ok(/<span aria-current="page">Small Business<\/span><a id="audOther" href="\/nonprofit-signup">Nonprofit<\/a>/.test(biz), 'the business signup links to the nonprofit one');
ok(/<a id="audOther" href="\/signup">Small Business<\/a><span aria-current="page">Nonprofit<\/span>/.test(np), 'the nonprofit signup links to the business one');
ok(/id="audSwitch"[^>]*hidden/.test(biz) && /signup-status/.test(biz.slice(biz.indexOf('id="audSwitch"'))), 'the business page shows it only when nonprofit signup is open');
ok(!/id="audSwitch"[^>]*hidden/.test(np), 'the nonprofit page always shows it');
for (const [name, html] of [['business', biz], ['nonprofit', np]]) {
  ok(/a\.href \+= '\?src=' \+ encodeURIComponent\(src\)/.test(html) && !/a\.href[^;]*code=/.test(html), `the ${name} page's link keeps the source tag, never a code`);
  ok(/\.aud-toggle \[aria-current\]/.test(html), `the ${name} page styles the current choice`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
