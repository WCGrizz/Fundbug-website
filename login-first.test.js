// The password is back on the first screen (Nov 12 2026, Will). Stephen Corridan's login links were held by his
// company's Microsoft 365 filter, and the password sign-in he could have used was one click away behind the email link.
// The first screen now has Email, Password and Sign In, then Email Me A Login Link as the second way in.
// Run: node login-first.test.js
const fs = require('fs');
const vm = require('vm');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const html = fs.readFileSync(__dirname + '/portal.html', 'utf8');

function fnText(head) {
  const a = html.indexOf(head);
  return a < 0 ? '' : html.slice(a, html.indexOf('\n}', a) + 2);
}

// The first screen holds both ways in, the password first.
const a = html.indexOf('<div id="loginWrap"'), b = html.indexOf('<!-- EMAIL LINK');
const first = a < 0 || b < 0 ? '' : html.slice(a, b);
const at = s => first.indexOf(s);
ok(at('id="loginEmail"') > 0 && at('id="loginPassword"') > at('id="loginEmail"'), 'the first screen asks for email, then password');
ok(at('onclick="doLogin()"') > at('id="loginPassword"') && at('onclick="doPrimaryMagic()"') > at('onclick="doLogin()"'),
   'Sign In comes before Email Me A Login Link');
ok(at('showForgotPassword()') > 0, 'Forgot Your Password? is on the first screen');
ok(!/id="pwWrap"|showPwLogin|pwEmail|pwErr/.test(html), 'no separate password screen is left behind');

// doLogin: reads the first screen, trims and lower-cases the email, and says plainly what went wrong.
(async () => {
  const src = fnText('async function doLogin(');
  ok(src, 'doLogin is defined');
  const run = async (email, password, status, body) => {
    const els = {loginEmail: {value: email}, loginPassword: {value: password}, loginErr: {textContent: ''}, loginMsg: {textContent: ''}};
    const sent = [];
    const ctx = {document: {getElementById: id => els[id] || (els[id] = {style: {}, textContent: '', value: ''})},
                 API: 'https://api', localStorage: {setItem() {}}, JSON, Error, showApp() { ctx.shown = true; },
                 fetch: async (url, o) => { sent.push(JSON.parse(o.body)); return {ok: status === 200, status, json: async () => body}; }};
    vm.createContext(ctx);
    vm.runInContext(src + ';globalThis.go = doLogin;', ctx);
    await ctx.go();
    return {sent, err: els.loginErr.textContent, shown: !!ctx.shown};
  };
  let r = await run('  Stephen@Example.COM ', 'pw', 200, {token: 't', subscriber_id: 's', email: 'stephen@example.com'});
  ok(r.sent[0] && r.sent[0].email === 'stephen@example.com' && r.shown, 'a right password signs in, the email trimmed and lower-cased');
  r = await run('a@b.com', '', 200, {});
  ok(!r.sent.length && /password/.test(r.err), 'no password: nothing is sent and it says so');
  r = await run('a@b.com', 'wrong', 401, {detail: 'Invalid credentials'});
  ok(/don't match/.test(r.err) && /Email Me A Login Link/.test(r.err), 'a wrong password points to the other ways in');
  r = await run('a@b.com', 'x', 403, {detail: 'This account does not use a password.'});
  ok(/doesn't have a password yet/.test(r.err) && /Forgot Your Password\?/.test(r.err), 'an account with no password is told how to set one');
  if (fails) { console.log(fails + ' failed'); process.exit(1); }
  console.log('all passed');
})();
