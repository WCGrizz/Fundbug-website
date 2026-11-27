// The code box comes before the plan and the card (Nov 27 2026): someone with a code from an event sees what it does
// before reaching the card, and a free-access code, which hides the plan card, never hides the box itself.
// Runs without a browser:  node nonprofit-code-first.test.js
const html = require('fs').readFileSync(__dirname + '/nonprofit-signup.html', 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const at = s => html.indexOf(s);
ok(at('id="comp"') > 0 && at('id="comp"') < at('id="planCard"') && at('id="planCard"') < at('id="card-element"'), 'the code box is above the plan and the card');
const code = html.slice(at('id="codeCard"'), at('id="planCard"'));
ok(code.includes('id="comp"') && !html.slice(at('id="planCard"'), at('</form>')).includes('id="comp"'), 'it is in its own card, outside the plan card a free code hides');
ok((html.match(/id="comp"/g) || []).length === 1 && html.includes('id="ref"'), 'one code box; the referral code stays');
process.exit(fails ? 1 : 0);
