// Every person has their own password (Nov 12 2026, Will: required at signup and when joining a team). Checks both
// signup pages ask for one and send it (a nonprofit join keeps the login's own), both portals ask a new teammate for
// theirs when the server answers needs_password and send it on, and the nonprofit Team page sets the signed-in
// person's own.  Run: node password-pages.test.js
const fs = require('fs');
const vm = require('vm');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const read = f => fs.readFileSync(__dirname + '/' + f, 'utf8');
const fnOf = (html, head) => { const a = html.indexOf(head); return a < 0 ? '' : html.slice(a, html.indexOf('\n}', a) + 2); };

(async () => {
  // ── The signup pages ──
  const biz = read('signup.html'), np = read('nonprofit-signup.html');
  for (const [name, html, ids] of [['business', biz, ['password', 'password2']], ['nonprofit', np, ['pw1', 'pw2']]]) {
    ok(ids.every(id => new RegExp(`id="${id}"[^>]*type="password"|type="password"[^>]*id="${id}"`).test(html)),
       `the ${name} signup asks for a password twice`);
    const ctx = {TextEncoder};
    vm.createContext(ctx);
    vm.runInContext(fnOf(html, 'function newPasswordProblem(') + ';globalThis.f = newPasswordProblem;', ctx);
    ok(ctx.f('short', 'short') && ctx.f('long-enough', 'long-enougH') && ctx.f('x'.repeat(73), 'x'.repeat(73))
       && ctx.f('', '') && ctx.f('long-enough', 'long-enough') === '', `the ${name} signup checks it as the server does`);
  }
  ok(/const pwProblem = newPasswordProblem\(password, password2\);\s*if \(pwProblem\)/.test(biz) && /\n    password,\n/.test(biz),
     'the business signup stops on a bad password and sends a good one');
  ok(/JOINED \? '' : newPasswordProblem\(/.test(np) && /\.\.\.\(JOINED \? \{\} : \{password: /.test(np)
     && /document\.getElementById\('pwFields'\)\.hidden = true/.test(fnOf(np, 'function fillJoin(')),
     'the nonprofit signup asks for one, except when an existing login joins');

  // ── A new teammate's own password, on both portals ──
  const flows = {
    nonprofit: {html: read('nonprofit-portal.html'), head: 'async function acceptInvite(', call: 'acceptInvite("tok")'},
    business: {html: read('portal.html'), head: 'async function consumeSeatInviteIfPresent(', call: 'consumeSeatInviteIfPresent()'},
  };
  for (const [name, f] of Object.entries(flows)) {
    const sent = [], asked = [];
    const answers = [{status: 400, body: {needs_password: true, detail: 'Create a password to finish joining.'}},
                     {status: 400, body: {needs_password: true, detail: 'Please create a password of at least 8 characters.'}},
                     {status: 200, body: {token: 't', subscriber_id: 's', org_type: 'nonprofit_501c3'}}];
    const ctx = {
      API: 'https://api', API_BASE: 'https://api', TOKEN_KEY: 'fb_token', SUB_KEY: 'fb_sub', JSON, URLSearchParams, document: {title: ''},
      window: {location: {search: '?seat_invite=tok', hash: '', pathname: '/portal'}, history: {replaceState() {}}},
      history: {replaceState() {}}, location: {pathname: '/nonprofit/home'},
      localStorage: {setItem() {}}, store() {}, alert(m) { ctx.alerted = m; }, confirm: () => false, fbConfirm: async () => false,
      waitForClick: async () => {}, linkQuestion: () => '',
      askNewPassword: async note => { asked.push(note); return asked.length === 1 ? 'short' : 'long-enough-1'; },
      fetch: async (url, o) => { sent.push(JSON.parse(o.body)); const a = answers.shift();
        return {ok: a.status === 200, status: a.status, json: async () => a.body}; },
    };
    vm.createContext(ctx);
    vm.runInContext(fnOf(f.html, f.head) + `;globalThis.run = () => ${f.call};`, ctx);
    await ctx.run();
    ok(sent.length === 3 && sent[0].password === '' && sent[1].password === 'short' && sent[2].password === 'long-enough-1',
       `the ${name} portal asks a new teammate for a password and sends it`);
    ok(asked[0] === '' && /at least 8/.test(asked[1]), `the ${name} portal shows the server's reason when one is refused`);
    ok(/id="newPw1"/.test(f.html) && /id="newPw2"/.test(f.html) && /id="newPwGo"/.test(f.html) && fnOf(f.html, 'function askNewPassword('),
       `the ${name} portal has the Create A Password screen`);
  }

  // ── Your Password on the nonprofit Team page ──
  const npp = flows.nonprofit.html;
  const save = fnOf(npp, 'async function savePassword(');
  ok(save && /id="pwCard"/.test(npp), 'the nonprofit Team page has Your Password');
  const runSave = async (hasOld, a, b, old) => {
    const els = {pwNew: {value: a}, pwNew2: {value: b}, pwOld: {value: old || ''}, pwOldRow: {hidden: !hasOld},
                 pwErr: {textContent: ''}, pwOk: {textContent: ''}};
    const calls = [];
    const ctx = {TextEncoder, document: {getElementById: id => els[id] || (els[id] = {value: '', textContent: ''})},
                 loadPasswordCard() {}, apiFetch: async (path, m, body) => { calls.push([path, body]); return {first_time: !hasOld}; }};
    vm.createContext(ctx);
    vm.runInContext(save + ';globalThis.go = savePassword;', ctx);
    await ctx.go();
    return {calls, err: els.pwErr.textContent, ok: els.pwOk.textContent};
  };
  let r = await runSave(false, 'new-pass-1', 'new-pass-1');
  ok(r.calls.length === 1 && r.calls[0][0] === '/api/portal/change-password' && r.calls[0][1].new_password === 'new-pass-1'
     && !('old_password' in r.calls[0][1]) && /set/.test(r.ok), 'a first password is set without a current one');
  r = await runSave(true, 'new-pass-1', 'new-pass-1', 'old-pass-1');
  ok(r.calls[0][1].old_password === 'old-pass-1' && /changed/.test(r.ok), 'changing one sends the current password');
  r = await runSave(false, 'new-pass-1', 'new-pass-2');
  ok(!r.calls.length && /match/.test(r.err), 'two passwords that differ are never sent');

  if (fails) { console.log(fails + ' failed'); process.exit(1); }
  console.log('all passed');
})();
