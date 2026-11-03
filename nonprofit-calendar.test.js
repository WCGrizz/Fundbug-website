// The Tracker in a calendar (Nov 2 2026): one item's .ics made in the browser, the same events as the server's feed.
// Run: node nonprofit-calendar.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function calEvents\(items, todayIso\)[\s\S]*?\n\}/), grab(/function icsText\(evs\)[\s\S]*?\n\}/), 'globalThis.t = {calEvents, icsText};'].join('\n'), ctx);
const { calEvents, icsText } = ctx.t;
const items = [{tracking_id: 't1', title: 'Mass Cultural Council, Innovation Fund; FY27', days_until_deadline: 14, deadline: 'Nov. 17, 2026', follow_up_date: '2026-11-10', status: 'submitted'},
               {tracking_id: 't2', title: 'Closed', days_until_deadline: -3, status: 'researching'}, {tracking_id: 't3', title: 'Won', days_until_deadline: 5, status: 'awarded'}];
const ev = calEvents(items, '2026-11-03');
ok(ev.length === 2 && ev[0].day === '20261117' && ev[1].day === '20261110', 'a deadline ahead and a follow-up; a passed deadline and a decided item never');
ok(ev[0].uid === 't1-deadline@fundbug.net' && ev[1].uid === 't1-follow-up@fundbug.net', 'the same UIDs as the server feed, so nothing doubles');
const out = icsText(ev);
ok(out.startsWith('BEGIN:VCALENDAR\r\n') && out.endsWith('END:VCALENDAR\r\n') && out.includes('DTEND;VALUE=DATE:20261118'), 'a calendar file of all-day events');
ok(out.includes('SUMMARY:Deadline: Mass Cultural Council\\, Innovation Fund\\; FY27'), 'commas and semicolons escaped as the format asks');
ok(out.includes('DESCRIPTION:Nov. 17\\, 2026\\nhttps://fundbug.net/nonprofit-portal'), 'a line break is written as \\n');
ok(/Subscribe In Your Calendar/.test(html) && /downloadItemIcs\('\$\{pid\}'\)/.test(html), 'the Tracker has the button and the per-item link');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
