// Home's new parts (Nov 10 2026, Will: "all 5, but i dont want the latest digest, just a link to it"): Your Next Steps,
// Your Pipeline, Since Your Last Visit, and the last-visit time. Run: node nonprofit-home-next.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const store = () => { const m = new Map(); return {getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m}; };
const ctx = {localStorage: store(), sessionStorage: store(), Date, Map, Set, Number, String, Math, JSON};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/const MONTH_NAMES = .*/),
  grab(/function daysUntil\([\s\S]*?\n\}/), grab(/function shortDay\(iso\).*/), "function viewerKey() { return 'me'; }",
  grab(/function homeSince\(\) \{[\s\S]*?\n\}/), grab(/function homeNotesHtml\([\s\S]*?\n\}/), grab(/const HOME_DONE = .*/),
  grab(/function homeNextSteps\([\s\S]*?\n\}/), grab(/function homeNextHtml\([\s\S]*?\n\}/), grab(/const HOME_PIPE = [\s\S]*?\]\]\];/),
  grab(/function homePipeHtml\([\s\S]*?\n\}/),
  'globalThis.t = {homeSince, homeNotesHtml, homeNextSteps, homeNextHtml, homePipeHtml};'].join('\n'), ctx);
const t = ctx.t, today = '2026-11-10';

const items = [
  {program_id: 'p1', title: 'Arts Fund', kind: 'opportunity', status: 'researching', days_until_deadline: 5},
  {program_id: 'p2', title: 'Youth Grant', kind: 'opportunity', status: 'researching', days_until_deadline: 9},
  {program_id: 'p3', title: 'Hill Foundation', kind: 'funder', status: 'contacted', follow_up_date: '2026-11-03'},
  {program_id: 'p4', title: 'Mill Trust', kind: 'opportunity', status: 'submitted', submitted_on: '2026-07-01', amount_requested: 25000},
  {program_id: 'p5', title: 'Done Fund', kind: 'opportunity', status: 'submitted', days_until_deadline: 3, submitted_on: '2026-11-01', amount_requested: 10000},
  {program_id: 'p6', title: 'Later Fund', kind: 'opportunity', status: 'invited', days_until_deadline: 60},
  {program_id: 'p7', title: 'Won Fund', kind: 'opportunity', status: 'awarded', amount_awarded: 15000, follow_up_date: '2026-10-01'},
  {program_id: 'p9', title: 'No Stage Yet', kind: 'funder'},
  {program_id: 'p10', title: 'Started Fund', kind: 'opportunity', status: 'in_progress'},
  {program_id: 'p11', title: 'Waiting Fund', kind: 'opportunity', status: 'under_review', days_until_deadline: 4, amount_requested: 5000},
  {program_id: 'p8', title: 'From A Digest', kind: 'opportunity', status: 'not_started', seen_in_digest: true, days_until_deadline: 2}];
const apps = [{program_id: 'p1', questions: 8, answered: 3}, {program_id: 'p6', questions: 4, answered: 1}, {program_id: 'p5', questions: 2, answered: 0}];
const plan = {saved: true, goal: 450000, sources: [{label: 'Foundation Grants', planned: 170000, secured: 65000, pending: 5000},
                                                  {label: 'Events', planned: 30000, secured: 30000, pending: 0}]};
const steps = t.homeNextSteps(items, apps, plan, today);
const has = (i, s) => (steps[i] || '').includes(s);
ok(has(0, 'Follow up on') && has(0, 'Hill Foundation') && has(0, 'due Nov 3'), 'first: the overdue follow-up');
ok(has(1, 'Finish your application for') && has(1, 'Arts Fund') && has(1, '3 of 8 answered, and it closes in 5 days'), 'then a part-answered application closing soon');
ok(has(2, 'Start your application for') && has(2, 'Youth Grant') && has(2, 'closes in 9 days'), 'then one closing soon with no application yet');
ok(has(3, 'Later Fund') && has(3, '1 of 4 answered.'), 'then other part-answered applications');
ok(has(4, 'Find <b>$100,000</b> more in Foundation Grants') && has(4, "go('plan/gap')"), 'and the source furthest behind its plan, kept a place');
ok(steps.length === 5 && !steps.some(s => s.includes('Mill Trust')), 'five at most: the plan keeps its place over the fifth');
ok(!steps.some(s => s.includes('Waiting Fund') || s.includes('Done Fund') || s.includes('From A Digest') || s.includes('Won Fund')),
   'never a submitted or decided one as an application to finish, nor one only seen in a digest');
const fewer = t.homeNextSteps(items.filter(i => i.program_id !== 'p1' && i.program_id !== 'p2'), apps, null, today);
ok(fewer.some(s => s.includes('Record the result for') && s.includes('Mill Trust') && s.includes('submitted Jul 1'))
   && !fewer.some(s => s.includes('Record the result for') && s.includes('Done Fund')), 'a submission with no result after 90 days: record it; not one sent nine days ago');
ok(t.homeNextSteps([], [], null, today)[0].includes("go('library')"), 'an empty Tracker: save from the Library');
ok(t.homeNextHtml([]).includes('Nothing needs you right now.') && t.homeNextHtml(['a']).includes('<ol class="home-next"><li>a</li></ol>'), 'none: says so');
ok(t.homeNextSteps(items, null, plan, today).some(s => s.includes('Start your application for') && s.includes('Arts Fund')),
   'answered counts that could not be read: it still says the program closes soon');

const pipe = t.homePipeHtml(items);
const tile = l => (pipe.match(new RegExp(`<span class="n">(\\d+)</span><span class="l">${l}</span>(?:<span class="d">([^<]*)</span>)?`)) || []).slice(1);
ok(JSON.stringify(tile('Researching')) === '["4",null]' && JSON.stringify(tile('Applying')) === '["2",null]', 'saved (or no stage yet), researching and contacted are Researching; invited and in_progress (a business stage) are Applying');
ok(JSON.stringify(tile('Submitted')) === '["3","$40,000 asked"]' && JSON.stringify(tile('Awarded')) === '["1","$15,000 awarded"]', 'submitted (and under_review) and awarded with their dollars');
ok(t.homePipeHtml([]) === '' && t.homePipeHtml(items.filter(i => i.seen_in_digest)) === '', 'nothing tracked: no pipeline');

const notes = [{program_id: 'p1', body: 'Called <them>', author_name: 'Karen', from_advisor: true, created_at: '2026-11-09T13:00:00+00:00'},
               {program_id: 'gone', body: 'Hi', author_name: '', created_at: '2026-11-08T13:00:00+00:00'}];
const nh = t.homeNotesHtml(notes, items);
ok(nh.includes('<h2>Since Your Last Visit</h2>') && nh.includes('<b>Karen (your advisor)</b> on <a') && nh.includes('Arts Fund</a>, Nov 9') && nh.includes('Called &lt;them&gt;'),
   'who, on which program, when, and the note escaped');
ok(nh.includes('<b>Someone</b>, Nov 8'), 'a note on a row no longer shown still reads');
ok(t.homeNotesHtml([], items) === '' && t.homeNotesHtml(null, items) === '', 'no notes, or none readable: nothing shown');

const first = t.homeSince();
ok(first === null, 'a first visit has no last visit');
ok(t.homeSince() === null, 'the same visit keeps its answer');
ctx.sessionStorage.m.clear();
const second = t.homeSince();
ok(typeof second === 'string' && second.startsWith('20'), 'the next visit reads the time saved at the last one');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
