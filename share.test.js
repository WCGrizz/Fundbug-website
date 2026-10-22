// Sharing the Tracker with an advisor (Oct 22 2026): the invite page (share.html) and the Team page's Sharing card
// (nonprofit-portal.html loadSharing). Runs without a browser:  node share.test.js
const fs = require('fs');
const vm = require('vm');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const flush = () => new Promise(r => setTimeout(r, 0));

function els() {
  const made = {};
  return { made, get: id => made[id] || (made[id] = { id, hidden: id === 'what', textContent: '', innerHTML: '', handlers: {},
    addEventListener(k, f) { this.handlers[k] = f; } }) };
}

// ── share.html ──
const page = fs.readFileSync(__dirname + '/share.html', 'utf8');
const script = page.slice(page.indexOf('<script>') + 8, page.indexOf('</script>'));
async function runShare({ t, signedIn, invite, accept }) {
  const e = els(), store = signedIn ? { fb_token: 'tok' } : {}, calls = [];
  const ctx = { URLSearchParams, JSON, String, encodeURIComponent, Error, console,
    location: { search: t ? '?t=' + t : '' },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } },
    document: { getElementById: e.get },
    fetch: async (url, o) => { calls.push({ url, o }); const r = /accept$/.test(url) ? accept : invite;
      return { ok: r.ok, json: async () => r.body }; } };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  await flush(); await flush();
  return { e, store, calls, ctx };
}

(async () => {
  const goodInvite = { ok: true, body: { advisor_id: 'brpc', advisor: 'Berkshire Funding Focus' } };
  let r = await runShare({ t: 'abc', signedIn: false, invite: goodInvite });
  ok(/Berkshire Funding Focus/.test(r.e.get('head').textContent) && r.e.get('what').hidden === false, 'the invite names the advisor and shows what is shared');
  ok(/Sign In/.test(r.e.get('act').innerHTML) && r.store.fb_share_pending === 'abc' && r.calls.length === 1,
     'not signed in: a sign-in link, the invite kept for after sign-in, and nothing accepted');

  r = await runShare({ t: 'abc', signedIn: true, invite: goodInvite, accept: { ok: true, body: { ok: true, advisor: 'Berkshire Funding Focus' } } });
  ok(r.calls.length === 1, 'signed in: nothing is shared until they click');
  await r.e.get('go').handlers.click(); await flush();
  const post = r.calls[1];
  ok(post && /\/api\/portal\/sharing\/accept$/.test(post.url) && post.o.method === 'POST' && post.o.headers.Authorization === 'Bearer tok'
     && JSON.parse(post.o.body).token === 'abc', 'the click accepts this invite with their sign-in');
  ok(/Your Tracker is shared/.test(r.e.get('head').textContent), 'it says sharing is on');

  r = await runShare({ t: 'abc', signedIn: true, invite: goodInvite, accept: { ok: false, body: { detail: 'Only your organization’s owner or an admin can share your Tracker.' } } });
  await r.e.get('go').handlers.click(); await flush();
  ok(/owner or an admin/.test(r.e.get('err').textContent) && !/is shared/.test(r.e.get('head').textContent), 'a refusal is shown, never taken as shared');

  r = await runShare({ t: 'old', signedIn: true, invite: { ok: false, body: { detail: 'This invite link is not valid or has expired.' } } });
  ok(/cannot be used/.test(r.e.get('head').textContent) && !r.e.made.go && r.e.get('what').hidden === true, 'an expired link offers nothing to accept');
  r = await runShare({ t: '', signedIn: true, invite: goodInvite });
  ok(r.calls.length === 0 && /not complete/.test(r.e.get('head').textContent), 'a link with no token asks nothing of the server');

  // ── The Team page's Sharing card ──
  const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
  const fn = html.slice(html.indexOf('async function loadSharing'), html.indexOf('async function setTeamRole'));
  async function card(reply) {
    const e = els(), calls = [];
    const ctx = { Date, isNaN, String, encodeURIComponent, document: { getElementById: e.get },
      escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
      apiFetch: async (p, m) => { calls.push([p, m]); if (reply instanceof Error) throw reply; return reply; } };
    vm.createContext(ctx);
    vm.runInContext(fn + ';globalThis.loadSharing = loadSharing;', ctx);
    await ctx.loadSharing();
    return { box: e.get('shareBox'), calls };
  }
  let c = await card({ shares: [], can_manage: true });
  ok(c.box.hidden === true, 'no card when nobody is shared with');
  const one = { shares: [{ advisor_id: 'brpc', advisor: 'Berkshire Funding Focus', shared_at: '2026-10-22T15:00:00Z' }] };
  c = await card({ ...one, can_manage: true });
  ok(c.box.hidden === false && /Berkshire Funding Focus/.test(c.box.innerHTML) && /stopSharing\('brpc'\)/.test(c.box.innerHTML), 'the owner or an admin can stop sharing');
  c = await card({ ...one, can_manage: false });
  ok(/Berkshire Funding Focus/.test(c.box.innerHTML) && !/Stop Sharing/.test(c.box.innerHTML), 'a member sees who it is shared with, and no Stop Sharing');
  c = await card(new Error('Server error'));
  ok(c.box.hidden === false && /Could not load sharing/.test(c.box.innerHTML), 'a failed load says so, never "nobody"');
  ok(/loadSharing\(\);\n\}/.test(html) && /id="shareBox" hidden/.test(html), 'the Team page loads the card');
  ok(/load\(TOKEN_KEY\) && sharePending\) \{ store\('fb_share_pending', null\); location\.replace\('\/share\?t='/.test(html),
     'after signing in from an invite, the portal goes back to it once');

  console.log(fails ? `${fails} failed` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
