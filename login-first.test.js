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
ok(at('showForgotPassword()') > 0, 'Forgot/Set Your Password? is on the first screen');
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
  ok(/doesn't have a password yet/.test(r.err) && /Forgot\/Set Your Password\?/.test(r.err), 'an account with no password is told how to set one');
  // The nonprofit portal has its own sign-in screen (Will, Nov 12 2026: "the sign in page doesnt seem pushed").
  const np = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
  const g = np.slice(np.indexOf('<div class="gate" id="gate"'), np.indexOf('<div class="gate" id="linkGate"'));
  const gi = x => g.indexOf(x);
  ok(gi('id="emailIn"') > 0 && gi('id="pwIn"') > gi('id="emailIn"') && gi('onclick="signIn()"') > gi('id="pwIn"')
     && gi('forgotPassword()') > 0 && gi('onclick="requestLink()"') > gi('onclick="signIn()"'),
     'the nonprofit sign-in asks for email and password first, then offers the email link');
  const npFn = head => { const a = np.indexOf(head); return a < 0 ? '' : np.slice(a, np.indexOf('\n}', a) + 2); };
  const signIn = npFn('async function signIn(');
  ok(signIn, 'the nonprofit portal defines signIn');
  const npRun = async (email, password, status, body) => {
    const els = {emailIn: {value: email}, pwIn: {value: password}, signErr: {textContent: ''}, signOk: {textContent: ''}};
    const sent = [], stored = {}, loc = {};
    const ctx = {document: {getElementById: id => els[id] || (els[id] = {textContent: '', value: ''})}, API_BASE: 'https://api',
                 TOKEN_KEY: 'fb_token', SUB_KEY: 'fb_sub', NONPROFIT_ORG_TYPES: ['nonprofit_501c3'], JSON,
                 store: (k, v) => { stored[k] = v; },
                 location: {reload() { loc.reloaded = true; }, replace(u) { loc.to = u; }},
                 fetch: async (url, o) => { sent.push(JSON.parse(o.body)); return {ok: status === 200, status, json: async () => body}; }};
    vm.createContext(ctx);
    vm.runInContext(signIn + ';globalThis.go = signIn;', ctx);
    await ctx.go();
    return {sent, err: els.signErr.textContent, stored, loc};
  };
  r = await npRun(' Kim@Org.ORG ', 'pw', 200, {token: 't', subscriber_id: 's', email: 'kim@org.org', org_type: 'nonprofit_501c3'});
  ok(r.sent[0].email === 'kim@org.org' && r.stored.fb_token === 't' && r.loc.reloaded, 'a nonprofit signs in with a password and the portal opens');
  r = await npRun('a@b.com', 'pw', 200, {token: 't', org_type: 'for_profit'});
  ok(r.loc.to === '/portal', 'a business account signing in here goes to its own portal');
  r = await npRun('a@b.com', '', 200, {});
  ok(!r.sent.length && /password/.test(r.err), 'the nonprofit sign-in sends nothing without a password');
  r = await npRun('a@b.com', 'x', 403, {});
  ok(/doesn't have a password yet/.test(r.err), 'a nonprofit account with no password is told how to set one');
  if (fails) { console.log(fails + ' failed'); process.exit(1); }
  console.log('all passed');
})();
