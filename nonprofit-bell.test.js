// The notifications bell (nonprofit-bell.js, Nov 11 2026). Run: node nonprofit-bell.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-bell.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {module: {exports: {}}, Date, Math, JSON, String, Number};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), js].join('\n'), ctx);
const b = ctx.module.exports;

ok(b.bellBubble(0) === '' && b.bellBubble(3).includes('>3<') && b.bellBubble(250).includes('>99+<'), 'the bubble: none at zero, the count, 99+ past that');
ok(b.bellLabel(3) === 'Notifications, 3 unread' && b.bellLabel(0) === 'Notifications', 'a screen reader hears the count');
const now = Date.parse('2026-11-11T17:00:00Z');
ok(b.bellAgo('2026-11-11T16:59:40Z', now) === 'Just now' && b.bellAgo('2026-11-11T16:30:00Z', now) === '30 minutes ago'
   && b.bellAgo('2026-11-11T14:00:00Z', now) === '3 hours ago' && b.bellAgo('2026-11-10T12:00:00Z', now) === 'Yesterday'
   && b.bellAgo('2026-10-01T12:00:00Z', now) === 'Oct 1', 'when, the way a phone says it');
const list = b.bellListHtml({unread: 1, items: [
  {key: 'ev:1', kind: 'note', text: 'Karen (your advisor) added a note on <Arts Fund>', detail: 'Tighten the budget', at: '2026-11-11T16:30:00Z', read: false, program_id: 'p1'},
  {key: 'dl:t:2026-11-14', kind: 'deadline', text: 'Youth Grant closes in 3 days', detail: '', at: '2026-11-07T08:00:00Z', read: true}]}, now);
ok(list.includes('&lt;Arts Fund&gt;') && !list.includes('<Arts Fund>'), 'escaped');
ok(/bell-item unread[\s\S]*bell-dot/.test(list) && (list.match(/bell-dot/g) || []).length === 1, 'unread: bold with a dot; read: plain');
ok(list.includes('Tighten the budget') && list.includes('30 minutes ago') && list.includes('onclick="bellOpenItem(0)"'), 'what was said, when, and it opens');
ok(b.bellListHtml({items: [], unread: 0}).includes('Nothing here yet') && b.bellListHtml({error: 'Notifications could not be read just now.'}).includes('could not be read'),
   'nothing yet says what will show up; a failed read says so');
ok(/catch \(e\) \{ BELL\.data = \{error:/.test(js) && /const d = BELL\.data, unread = d && !d\.error \? d\.unread : 0;/.test(js), 'a failed read shows no bubble, never a wrong count');
ok(/id="bellBtn"/.test(html) && /onclick="bellClose\(\)" aria-label="Close notifications"/.test(html) && !/bellPanel[^>]*onclick/.test(html) && !/addEventListener\('click'/.test(js),
   'the list closes by its X, never by a click outside it');
ok(/bellStart\(\);/.test(html) && /setInterval\(bellLoad, 180000\)/.test(js) && /visibilitychange/.test(js), 'read on sign-in, every three minutes and when the window comes back');
ok(/'\/api\/portal\/notifications\/read', 'POST', \{keys: \[it\.key\]\}/.test(js) && /homeOpenTracker\(it\.program_id\)/.test(js), 'opening one marks it read and goes to it');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
