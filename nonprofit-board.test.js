// The Tracker board mockup (nonprofit-board.js, Nov 11 2026). Run: node nonprofit-board.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-board.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {module: {exports: {}}, Date, Math, JSON, String, Number, Set, TRACKER: null, document: {getElementById: () => null}};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/const MONTH_NAMES = .*/), grab(/function daysUntil\([\s\S]*?\n\}/),
  grab(/function shortDay\(iso\).*/), "function stageLabel(c) { return {not_started: 'Saved', invited: 'Invited To Apply', submitted: 'Submitted', awarded: 'Awarded'}[c] || ''; }",
  js].join('\n'), ctx);
const b = ctx.module.exports, today = '2026-11-11';
const items = [
  {program_id: 'p1', title: 'Arts Fund', kind: 'opportunity', status: 'not_started', days_until_deadline: 5},
  {program_id: 'p2', title: 'Hill Foundation', kind: 'funder', status: 'contacted', follow_up_date: '2026-11-03', days_until_deadline: 3},
  {program_id: 'p3', title: 'Mill Trust', kind: 'opportunity', status: 'invited', days_until_deadline: 40},
  {program_id: 'p4', title: 'Started', kind: 'opportunity', status: 'in_progress'},
  {program_id: 'p5', title: 'Waiting', kind: 'opportunity', status: 'under_review', days_until_deadline: 2},
  {program_id: 'p6', title: 'Won', kind: 'opportunity', status: 'awarded', follow_up_date: '2026-11-20'},
  {program_id: 'p7', title: 'Declined Fund', kind: 'opportunity', status: 'not_awarded'},
  {program_id: 'd1', title: 'From A Digest', kind: 'opportunity', status: 'not_started', seen_in_digest: true}];
const col = id => b.boardCol(items.find(i => i.program_id === id));
ok(col('p1') === 'researching' && col('p2') === 'researching' && col('p3') === 'applying' && col('p4') === 'applying'
   && col('p5') === 'submitted' && col('p6') === 'awarded' && col('p7') === 'closed', 'nine stages (and the business ones) in five columns');
ok(b.boardItems(items).length === 7 && b.boardInbox(items).map(i => i.program_id).join() === 'd1', 'digest items wait in From Your Digests, not on the board');
ok(b.boardNext(items[1], today).text === 'Follow up, due Nov 3' && b.boardNext(items[1], today).soon, 'an overdue follow-up comes first, marked');
ok(b.boardNext(items[0], today).text === 'Closes in 5 days' && b.boardNext(items[2], today).text === 'Closes Dec 21', 'else the deadline: days when close, the date when not');
ok(b.boardNext(items[3], today) === null, 'nothing next: no line');
const tl = b.boardTimeline(b.boardItems(items), today, 900);
ok(/bd-dot dl/.test(tl) && /bd-dot fu/.test(tl) && tl.includes('Next 2 Weeks') && tl.includes('Today'), 'the timeline: deadlines and follow-ups, the next two weeks, today');
ok(!/Waiting: closes/.test(tl) && !/Won: /.test(tl), 'no deadline dot for what is submitted, no follow-up dot for what is decided');
ok(/Arts Fund: closes Nov 16/.test(tl) && /Hill Foundation: follow-up overdue/.test(tl), 'each dot names its card and what is due');
ok(b.boardTimeline([items[3]], today, 900) === '', 'nothing coming up: no timeline');
const page = b.boardHtml(b.boardItems(items), b.boardInbox(items), today, 900);
ok(page.includes('is not saved') && page.includes('Show Closed') && !page.includes('Declined Fund'), 'says it saves nothing; Closed starts folded');
ok(!/\(\d+\)|\d+ new/.test(page.replace(/\d+ days?/g, '')), 'no counts on the board');
b.BOARD.moved.p1 = 'submitted';
ok(b.boardCol(items[0]) === 'submitted', 'a card dragged to a column stays there, on this page only');
ok(/\{path: 'tracker\/board', page: 'board', label: 'Board \(Mockup\)', hidden: true/.test(html) && /\(!r\.hidden \|\| r\.path === cur\.path\)/.test(html),
   'reached by its address; in the column only while open');
ok(!/apiFetch\([^)]*'(POST|PATCH|DELETE)'/.test(js), 'the mockup never writes');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
