// The nonprofit portal's navigation (Nov 10 2026, Will: the main navigation along the top, each section's pages in a
// column on the left, and "separate URL's for each of the sections"). Runs the router from nonprofit-portal.html (between
// its NAV START and NAV END marks) against a fake page: addresses, Back, the account and preview modes, the owner-only
// page, Prep Application under My Answers, and links sent before the change. Run: node nonprofit-nav.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const redirects = fs.readFileSync(__dirname + '/_redirects', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)})`));

const a = html.indexOf('// ── NAV START'), b = html.indexOf('// ── NAV END');
ok(a > 0 && b > a, 'the portal marks its router');

function page(id) {
  const cls = new Set();
  return {id, innerHTML: '', classList: {add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
    toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }}, has: c => cls.has(c)};
}
function load(mode, opts) {
  opts = opts || {};
  const pages = ['home', 'profile', 'matches', 'tracker', 'plan', 'answers', 'prep', 'landscape', 'digests', 'subscription', 'team',
                 'advisors', 'leftout'].map(id => page('page-' + id));
  const els = {topLinks: page('topLinks'), topRight: page('topRight'), subnav: page('subnav'), wrap: page('wrap')};
  const body = page('body');
  if (opts.member) body.classList.add('member');
  const calls = [];
  const loc = {pathname: opts.path || '/nonprofit-portal', hash: opts.hash || ''};
  const setUrl = u => { const i = u.indexOf('#'); loc.pathname = i < 0 ? u : u.slice(0, i); loc.hash = i < 0 ? '' : u.slice(i); };
  const hist = [];
  const listeners = {};
  const ctx = {
    MODE: mode, TRACKER: {}, RESULT: null, LAND: null, console,
    location: loc,
    history: {pushState: (s, t, u) => { hist.push(['push', u]); setUrl(u); }, replaceState: (s, t, u) => { hist.push(['replace', u]); setUrl(u); }},
    window: {scrollTo() {}, addEventListener: (n, f) => { listeners[n] = f; }},
    document: {body, getElementById: id => els[id] || pages.find(p => p.id === id) || page(id),
               querySelectorAll: sel => sel === '.page' ? pages : []},
    escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
    loadTracker: () => calls.push('loadTracker'), loadDigests: () => calls.push('loadDigests'), openLandscape: () => calls.push('openLandscape'),
    openFundingPlan: () => calls.push('openFundingPlan'), loadDrafting: () => calls.push('loadDrafting'), drShowTab: t => calls.push('tab:' + t),
    loadTeam: () => calls.push('loadTeam'), loadSharing: () => calls.push('loadSharing'), loadSubscription: () => calls.push('loadSubscription'),
    loadStripTracker() {}, setLibraryView: f => calls.push('fits:' + f), drawMatches() {},
  };
  ctx.window.addEventListener = (n, f) => { listeners[n] = f; };
  ctx.addEventListener = ctx.window.addEventListener;
  vm.createContext(ctx);
  vm.runInContext(html.slice(a, b).replace("window.addEventListener('popstate'", "addEventListener('popstate'") +
    '\n;globalThis.__n = {routeAt, go, showPage, goInitial, drawNav, get ROUTE() { return ROUTE; }};', ctx);
  return {n: ctx.__n, ctx, pages, els, calls, hist, loc, listeners, active: () => pages.find(p => p.has('active')).id.replace('page-', '')};
}

// Addresses, by mode
{
  const {n} = load('account');
  eq(n.routeAt('/nonprofit/library/all').page, 'matches', 'All Funders is the Library page');
  eq(n.routeAt('/nonprofit/tracker/seen/').path, 'tracker/seen', 'a trailing slash is the same address');
  ok(n.routeAt('/nonprofit/library/left-out') === null, "the preview's Left Out is not an account's page");
  ok(n.routeAt('/nonprofit-portal') === null && n.routeAt('/nonprofit/nowhere') === null, 'an unknown address names no page');
}
{
  const {n} = load('preview');
  ok(n.routeAt('/nonprofit/tracker') === null && n.routeAt('/nonprofit/library/all') === null, 'the preview has no Tracker and no All Funders');
  ok(n.routeAt('/nonprofit/library/left-out').page === 'leftout', 'the preview has Left Out');
}

// The menus
{
  const T = load('account');
  T.n.goInitial();
  eq([T.loc.pathname, T.active()], ['/nonprofit/home', 'home'], 'an account opens on Home at /nonprofit/home');
  eq(T.hist, [['replace', '/nonprofit/home']], 'the opening address replaces the old one (Back does not return to /nonprofit-portal)');
  const tops = [...T.els.topLinks.innerHTML.matchAll(/>([^<]+)<\/a>/g)].map(m => m[1]);
  eq(tops, ['Home', 'Library', 'Tracker', 'Funding Plan', 'My Answers'], 'the top bar: the five sections');
  ok(/class="top-org"[^>]*>Organization</.test(T.els.topRight.innerHTML), 'Organization at the right end of the bar');
  ok(T.els.wrap.has('no-sub') && T.els.subnav.innerHTML === '', 'Home has no left column');
  T.n.go('library');
  const subs = [...T.els.subnav.innerHTML.matchAll(/>([^<]+)<\/a>/g)].map(m => m[1]);
  eq(subs, ['Fits You', 'All Funders', 'Funding Landscape', 'Digests'], "the Library's column");
  ok(!T.els.wrap.has('no-sub') && /class="active"[^>]*>Fits You</.test(T.els.subnav.innerHTML), 'Fits You is marked');
  ok(/class="active"[^>]*>Library</.test(T.els.topLinks.innerHTML), 'Library is marked in the bar');
  ok(/href="\/nonprofit\/library\/all"/.test(T.els.subnav.innerHTML), 'each link is a real address (a new tab opens it)');
}

// Going places
{
  const T = load('account', {path: '/nonprofit/tracker/seen'});
  T.n.goInitial();
  ok(T.active() === 'tracker' && T.pages.find(p => p.id === 'page-tracker').has('view-seen') && T.calls.includes('loadTracker'),
     'opened at /nonprofit/tracker/seen: the Tracker, its Seen In Your Digest view, loaded');
  T.n.go('tracker');
  ok(!T.pages.find(p => p.id === 'page-tracker').has('view-seen'), 'My Tracker drops the Seen view');
  eq(T.hist.slice(-1), [['push', '/nonprofit/tracker']], 'a menu click pushes the address (Back returns)');
  T.n.go('library/all');
  ok(T.calls.includes('fits:false'), 'All Funders turns Fits Only off');
  T.n.showPage('matches');
  eq([T.loc.pathname, T.calls.slice(-1)[0]], ['/nonprofit/library/all', 'fits:false'], "code showing the Library page it is on keeps the address and view");
  T.n.showPage('tracker');
  eq(T.loc.pathname, '/nonprofit/tracker', "code showing another page (showPage('tracker')) moves the address");
  T.loc.pathname = '/nonprofit/library/all';
  T.listeners.popstate();
  ok(T.active() === 'matches' && T.calls.slice(-1)[0] === 'fits:false', 'Back shows the page at the address');
}
{
  const T = load('account', {path: '/nonprofit/organization/subscription'});
  T.n.goInitial();
  eq(T.loc.pathname, '/nonprofit/organization/subscription', 'the owner opens Subscription by its address');
  const M = load('account', {path: '/nonprofit/organization/subscription', member: true});
  M.n.goInitial();
  ok(M.loc.pathname === '/nonprofit/home' && !/Subscription/.test(M.els.subnav.innerHTML), "a teammate cannot reach the owner's Subscription page");
}
{
  const T = load('account', {hash: '#prep/user_abc'});
  T.n.showPage('prep');
  eq([T.loc.pathname + T.loc.hash, T.active()], ['/nonprofit/answers/applications#prep/user_abc', 'prep'], 'Prep Application sits under My Answers, its #prep/ kept');
  ok(/class="active"[^>]*>Applications</.test(T.els.subnav.innerHTML), 'Applications is marked while preparing one');
}
{
  const P = load('preview');
  P.n.goInitial();
  eq([P.loc.pathname, P.active()], ['/nonprofit/organization', 'profile'], 'the preview opens on the Organization Profile');
}

// Cloudflare serves the portal for every address under /nonprofit/
ok(/^\/nonprofit \/nonprofit-portal 200$/m.test(redirects) && /^\/nonprofit\/\* \/nonprofit-portal 200$/m.test(redirects), '_redirects serves the portal at /nonprofit/...');
const drafting = fs.readFileSync(__dirname + '/nonprofit-drafting.js', 'utf8');
ok(/if \(h === '#answers'\) \{ go\('answers', \{replace: true\}\); return true; \}/.test(drafting), 'a #answers link sent before still opens My Answers');
ok(!/\.sidebar a/.test(drafting + html.slice(html.indexOf('<script>'))), 'no code marks the old side menu');

console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
