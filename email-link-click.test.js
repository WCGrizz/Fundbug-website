// An email link waits for a person's click (Nov 6 2026). Microsoft 365's mail filter opened both of Katie Meehan's
// one-time login links (CHP Berkshires) in a hidden browser within a minute of sending; the portal signed in as the page
// loaded, so each link was used before she saw it. A filter loads a page but does not click. This checks both portals:
// the click step itself (nothing happens until the button is clicked), and that every call that uses up a login link
// or a team invite comes after it.  Run: node email-link-click.test.js
const fs = require('fs');
const vm = require('vm');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const pages = {business: fs.readFileSync(__dirname + '/portal.html', 'utf8'),
               nonprofit: fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8')};

function fnText(html, head) {                       // a top-level function's source, to its closing brace at column 0
  const a = html.indexOf(head);
  return a < 0 ? '' : html.slice(a, html.indexOf('\n}', a) + 2);
}

(async () => {
  for (const [name, html] of Object.entries(pages)) {
    // The click step: nothing until a click, then once.
    const src = fnText(html, 'function waitForClick(');
    ok(src, `the ${name} portal has the click step`);
    const els = {};
    const el = id => els[id] || (els[id] = {id, style: {}, textContent: '', disabled: true, handlers: [],
      addEventListener(type, f) { if (type === 'click') this.handlers.push(f); }});
    const ctx = {document: {getElementById: el}, Promise};
    vm.createContext(ctx);
    vm.runInContext(src + ';globalThis.w = waitForClick;', ctx);
    let done = false;
    const p = ctx.w('Your login link is ready.', 'Sign In To FundBug').then(() => { done = true; });
    await new Promise(r => setTimeout(r, 0));
    const go = el('linkGo'), gate = el(name === 'business' ? 'linkWrap' : 'linkGate');
    ok(!done && gate.style.display === 'flex' && go.textContent === 'Sign In To FundBug' && !go.disabled,
       `the ${name} portal shows the button and waits`);
    ok(el('app').style.display === 'none', `the ${name} portal hides the app while it waits`);
    go.handlers.forEach(f => f());
    await p;
    ok(done && go.disabled && gate.style.display === 'none', `the ${name} portal carries on after the click, once`);
    ok(new RegExp(`id="${gate.id}"[^>]*style="display:none"`).test(html) && /id="linkGo"/.test(html), `the ${name} portal's button screen starts hidden`);
  }

  // Every call that uses up a link comes after the click. One call of each endpoint per page, so a new one fails here.
  const biz = pages.business, np = pages.nonprofit;
  for (const [name, html] of Object.entries(pages)) {
    ok((html.match(/\/api\/portal\/consume-login-link/g) || []).length === 1, `the ${name} portal uses a login link in one place`);
    ok((html.match(/\/api\/portal\/seats\/accept/g) || []).length === 1, `the ${name} portal accepts an invite in one place`);
  }
  const after = (body, call) => { const w = body.indexOf('await waitForClick('), c = body.indexOf(call); return w > 0 && c > w; };
  ok(after(fnText(biz, 'async function consumeMagicLinkIfPresent('), "fetch(API + '/api/portal/consume-login-link'"),
     'business: a login link (and a Help Them Apply link) is used only after the click');
  ok(after(fnText(biz, 'async function consumeSeatInviteIfPresent('), "fetch(API + '/api/portal/seats/accept'"),
     'business: an invite is accepted only after the click');
  const nStart = np.slice(np.indexOf('(async function start()'));
  const inviteIf = nStart.slice(nStart.indexOf('if (inviteToken && !loginToken)'));
  const loginIf = nStart.slice(nStart.indexOf('if (loginToken) {'));
  ok(after(inviteIf, 'acceptInvite(inviteToken)'), 'nonprofit: an invite is accepted only after the click');
  ok(after(loginIf, 'consumeLink(loginToken)'), 'nonprofit: a login link is used only after the click');
  ok((np.match(/consumeLink\(/g) || []).length === 2 && (np.match(/acceptInvite\(/g) || []).length === 2,
     'nonprofit: consumeLink and acceptInvite are each called from one place');

  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
