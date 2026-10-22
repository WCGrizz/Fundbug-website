// The Tracker's history and award details (nonprofit-tracker-history.js, Oct 22 2026). Run: node nonprofit-tracker-history.test.js
const fs = require('fs'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ctx = { module: { exports: {} }, escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'),
  stageLabel: c => ({ submitted: 'Submitted', awarded: 'Awarded', not_started: 'Saved' }[c] || c),
  TRACKER: { you: { id: 'u1', manager: false }, decline_reasons: [{ code: 'competitive', label: 'Very competitive' }] }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname + '/nonprofit-tracker-history.js', 'utf8') + '\n;globalThis.__x = module.exports;', ctx);
const x = ctx.__x;
ok(x.thSummaryLine({ submitted: 2, requested: 85000, awarded: 1, awarded_dollars: 20000, declined: 0 }) ===
   'This year: 2 submitted ($85,000 requested), 1 awarded ($20,000).', 'the year’s results in one line');
ok(x.thSummaryLine({ submitted: 0, awarded: 0, declined: 0 }) === '', 'nothing said when there is nothing yet');
ok(x.thAwardFields({ program_id: 'p1', status: 'not_started' }) === '', 'no award questions before anything is sent');
const won = x.thAwardFields({ program_id: 'p1', status: 'awarded', amount_awarded: 20000 });
ok(won.includes('Amount Awarded') && won.includes('Decided On') && won.includes('value="20000"'), 'an award asks the amount and date');
ok(x.thAwardFields({ program_id: 'p1', status: 'not_awarded' }).includes('Very competitive'), 'a decline offers its reasons');
const mine = x.thEntry({ id: 'e1', kind: 'note', body: 'Called <them>', author_id: 'u1', author_name: 'Katie', author_side: 'organization', visibility: 'team', created_at: '2026-10-22T10:00:00Z' }, 'p1');
const theirs = x.thEntry({ id: 'e2', kind: 'note', body: 'Hi', author_id: 'u2', author_name: 'AJ', author_side: 'organization', visibility: 'everyone', created_at: '2026-10-22T10:00:00Z' }, 'p1');
ok(mine.includes('Edit') && mine.includes('Delete') && mine.includes('Called &#60;them&#62;') && mine.includes('My Team'), 'my note: edit and delete, escaped');
ok(!theirs.includes('Edit') && !theirs.includes('Delete') && theirs.includes('Team And Advisor'), 'a teammate’s note: neither, unless an admin');
ctx.TRACKER.you.manager = true;
ok(x.thEntry({ id: 'e2', kind: 'note', body: 'Hi', author_id: 'u2', author_side: 'organization', visibility: 'team', created_at: '2026-10-22' }, 'p1').includes('Delete'),
   'an admin may delete a teammate’s note');
ok(x.thEntry({ kind: 'stage', detail: { from: 'not_started', to: 'submitted' }, author_name: 'Katie', created_at: '2026-10-22' }, 'p1').includes('<b>Submitted</b>'),
   'a stage change reads as a sentence');
ok(x.thPanel({ program_id: 'p1', notes: 'old words' }).includes('Earlier notes') , 'the old single note is kept as earlier notes');
process.exit(fails ? 1 : 0);
