// The guided tours (Nov 10 2026, Will: a dimmed page with each feature pointed out and described; a tour for each
// section; a permanent Take The Tour button). Run: node nonprofit-tour.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-tour.js', 'utf8');
const all = html + fs.readFileSync(__dirname + '/nonprofit-funding-plan.js', 'utf8') + fs.readFileSync(__dirname + '/answers-nav.js', 'utf8')
  + fs.readFileSync(__dirname + '/nonprofit-drafting.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = {module: {exports: {}}, window: {}, document: {}};
vm.createContext(ctx);
vm.runInContext(js, ctx);
const {TOURS, TOUR_PAGES} = ctx.module.exports;

ok(TOURS.main.length === 7, 'the main tour has its seven stops');
ok(TOUR_PAGES.every(p => TOURS[p] && TOURS[p].length) && TOUR_PAGES.every(p => html.includes(`id="page-${p}"`)), 'each page with a tour has one, and the page exists');
// Every stop points at something the portal draws: each id or class in its selector appears in the page or its scripts.
const missing = [];
for (const [name, steps] of Object.entries(TOURS)) for (const st of steps) {
  const names = [...st.el.matchAll(/#([\w-]+)|\.([\w-]+)/g)].map(m => m[1] ? `id="${m[1]}"` : m[2]);
  if (!names.some(n => n.startsWith('id=') ? all.includes(n) : new RegExp(`class="[^"]*\\b${n}\\b|className = '[^']*\\b${n}\\b|\\.${n}\\b`).test(all))) missing.push(`${name}: ${st.el}`);
  if (st.go && !new RegExp(`path: '${st.go}'`).test(html)) missing.push(`${name}: go ${st.go}`);
}
ok(!missing.length, 'every stop points at something on its page' + (missing.length ? `  (${missing.join(' | ')})` : ''));
const copy = Object.values(TOURS).flat();
ok(copy.every(st => !/ [-–—] /.test(st.text) && !/—/.test(st.text)), 'no dash as punctuation in the copy');
ok(copy.every(st => st.title.split(' ').every(w => /^[A-Z0-9'’?]/.test(w))), 'titles in Title Case');
ok(copy.every(st => st.text.length <= 220), 'each stop is short');
ok(/class="acct-only tour-top-btn" onclick="tourStart\('main'\)">Take The Tour</.test(html) && /tour-phone-only/.test(js), 'Take The Tour is always in the top bar (on a phone, on Home)');
ok(!/tour-block[^}]*onclick|addEventListener\('click', tourEnd\)/.test(js + html) && /onclick="tourEnd\(\)"/.test(js), 'the tour closes only by its own buttons');
// It shows itself once, to an account made from Nov 10 2026.
const store = {};
const run = (made) => {
  const c = {module: {exports: {}}, MODE: 'account', ACCOUNT: {subscriber: {created_at: made}}, viewerKey: () => 'a@b.org', started: [],
    localStorage: {getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }}, setTimeout: f => f(), window: {}, document: {}};
  vm.createContext(c); vm.runInContext(js + ';tourStart = n => started.push(n); tourMaybeAutostart();', c);
  return c.started;
};
ok(run('2026-10-01T12:00:00Z').length === 0, 'an account made before Nov 10 2026 is not shown it by itself');
ok(run('2026-11-12T09:00:00Z').join() === 'main' && run('2026-11-12T09:00:00Z').length === 0, 'a new account sees it once, then not again');
ok(/tourButtons\(\);/.test(html) && /tourMaybeAutostart\(\);/.test(html) && /nonprofit-tour\.js\?v=/.test(html), 'the portal loads it and starts it');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
