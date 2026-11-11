// Linking a login that has its own account (Nov 2 2026): both portals ask before accepting with link_own_account.
// Run: node nonprofit-link.test.js
const fs = require('fs'), vm = require('vm');
const np = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8'), biz = fs.readFileSync(__dirname + '/portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext(np.match(/function linkQuestion\(d\)[\s\S]*?\n\}/)[0] + ';globalThis.q = linkQuestion;', ctx);
const q = ctx.q({account_name: 'Berkshire Black Economic Council'});
ok(q.startsWith('This email already has its own FundBug account. Join Berkshire Black Economic Council with that same login?') &&
   q.includes('FundBug keeps them, and can put them back'), 'the question names the team and says what happens to their own account');
for (const [name, page] of [['nonprofit portal', np], ['business portal', biz]]) {
  ok(/r\.status === 409 && d\.can_link && (confirm\(|await fbConfirm\()/.test(page) && /link_own_account: !!link/.test(page), `the ${name} links only after the person confirms`);
  ok(/let r = await send\(false\);/.test(page), `the ${name} asks the plain way first`);
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
