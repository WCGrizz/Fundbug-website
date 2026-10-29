// The Funding Plan page (Oct 28 2026): the capital stack, the spreadsheet in and out, the plan's changes as sent.
// Runs without a browser:  node nonprofit-funding-plan.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-funding-plan.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)})`));
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/const shortMoney = .*/), grab(/const MONTH_NAMES = .*/),
                 js, 'globalThis.t = {fpStack, fpYearLabel, fpParse, fpParseCsv, fpGuessColumns, fpDate, fpRowsFrom, fpDownloadText, fpTotalsLine};',
                 'globalThis.setFP = v => { FP = v; }; globalThis.sent = []; fpSave = c => { sent.push(c); };', 'globalThis.fpSaveAward = fpSaveAward;'].join('\n'), ctx);
const t = ctx.t;
const src = (key, label, planned, secured, pending, extra) => ({key, label, planned, secured, pending, shown: Math.max(planned, secured + pending),
  secured_other: 0, secured_tracker: 0, secured_donors: 0, pending_unknown: 0, from_tracker: false, ...extra});
const view = {fiscal_year: 2027, end_month: 6, goal: 500000, sources: [src('earned', 'Earned Revenue', 0, 0, 0), src('government', 'Government Grants', 100000, 25000, 30000),
  src('foundation', 'Foundation Grants', 200000, 60000, 0), src('individual', 'Individual Donors', 50000, 70000, 0)],
  totals: {planned: 350000, secured: 155000, pending: 30000, shown: 370000, to_raise: 345000}};

// The stack
const svg = t.fpStack(view);
ok((svg.match(/class="fp-band"/g) || []).length === 3, 'one band per source with anything in it (none for an empty one)');
ok(svg.includes('Foundation Grants: $60K of $200K') && svg.includes('Government Grants: $25K of $100K'), 'each band says what is secured of what is planned');
ok(svg.includes('Individual Donors: $70K of $50K') && svg.includes('(more than planned)'), 'a source past its plan says so');
ok(svg.includes('url(#fpHatch-government)') && !svg.includes('url(#fpHatch-foundation)"></rect>'), 'pending is striped, only where there is some');
ok(svg.includes('Not yet planned: $130,000') && svg.includes('Goal $500,000'), 'the goal is a line and the unplanned part up to it is shown');
const heights = [...svg.matchAll(/<g class="fp-band" data-key="(\w+)">.*?height="([\d.]+)"/gs)].map(m => [m[1], +m[2]]);
const h = Object.fromEntries(heights);
ok(Math.abs(h.foundation / h.government - 2) < 0.01 && Math.abs(h.individual / h.government - 0.7) < 0.01, 'band heights are in proportion to their sizes');
ok(t.fpStack({...view, goal: null, sources: view.sources.map(s => ({...s, shown: 0})), totals: {...view.totals, shown: 0}}).includes('Set this year'), 'nothing yet: an invitation, not an empty box');
ok(!t.fpStack({...view, goal: 100000}).includes('Not yet planned'), 'planned past the goal: no unplanned part');
ok(t.fpStack({...view, sources: [src('other', '<b>x</b>', 10, 0, 0)], totals: {...view.totals, shown: 10}}).includes('&lt;b&gt;'), 'labels are escaped');
ok(t.fpTotalsLine(view).includes('$155,000') && t.fpTotalsLine(view).includes('(31%)') && t.fpTotalsLine(view).includes('$345,000'), 'the totals over the stack');

// Words and figures
eq(t.fpYearLabel(2027, 6), 'FY2027 (July 2026 to June 2027)', 'a fiscal year ending in June');
eq(t.fpYearLabel(2026, 12), 'FY2026 (January 2026 to December 2026)', 'a calendar fiscal year');
eq([t.fpParse('$25,000'), t.fpParse(' 1200.6 '), t.fpParse(''), Number.isNaN(t.fpParse('lots'))], [25000, 1201, null, true], 'amounts typed with $ and commas');
eq([t.fpDate('2026-08-01'), t.fpDate('8/1/2026'), t.fpDate('08-01-26'), t.fpDate('Sept 5, 2026'), t.fpDate('soon')],
   ['2026-08-01', '2026-08-01', '2026-08-01', '2026-09-05', 'soon'], 'dates as spreadsheets write them; anything else sent as it is');

// The spreadsheet in
const csv = '﻿First Name,Last Name,Email,Gift Amount,Gift Date,Campaign\r\n"Pat","Jones, Jr.",pat@x.org,"$1,000",8/1/2026,"Spring ""Big"" Ask"\r\n,,,,,\r\nKim,Lo,,50,2026-08-02,\r\n';
const table = t.fpParseCsv(csv);
eq(table.length, 3, 'blank rows are dropped');
eq(table[1], ['Pat', 'Jones, Jr.', 'pat@x.org', '$1,000', '8/1/2026', 'Spring "Big" Ask'], 'quoted cells with commas and quotes');
const m = t.fpGuessColumns(table[0]);
eq([m.first, m.last, m.email, m.amount, m.date, m.note, m.name], [0, 1, 2, 3, 4, 5, -1], 'first and last names, gift amount and date, campaign as the note');
eq(t.fpRowsFrom(table, m)[0], {name: 'Pat Jones, Jr.', email: 'pat@x.org', amount: '$1,000', date: '2026-08-01', note: 'Spring "Big" Ask'}, 'a row sent as the backend reads it');
const lgl = t.fpGuessColumns(['Constituent Name', 'Last Gift Date', 'Gift Date', 'Amount', 'Gift Type', 'Notes']);
eq([lgl.name, lgl.last, lgl.date, lgl.amount, lgl.note], [0, -1, 1, 3, 5], 'a donor database\'s headings: "Last Gift Date" is no last name');

// The spreadsheet out, and back in
const ds = [{name: 'Pat Jones, Jr.', email: 'pat@x.org', phone: '', next_step: 'Call', next_step_on: '2026-11-01',
             gifts: [{date: '2026-08-01', amount: 1000, note: 'Spring "Big" Ask'}, {date: '2026-09-01', amount: 250, note: ''}]},
            {name: 'No Gifts Yet', email: '', phone: '', gifts: []}];
const back = t.fpParseCsv(t.fpDownloadText(ds));
eq(back.length, 4, 'one line per gift, one for a donor with none, under the headings');
eq(t.fpRowsFrom(back, t.fpGuessColumns(back[0])).map(r => [r.name, r.amount, r.date, r.note]),
   [['Pat Jones, Jr.', '1000', '2026-08-01', 'Spring "Big" Ask'], ['Pat Jones, Jr.', '250', '2026-09-01', ''], ['No Gifts Yet', '', '', '']],
   'a download imports back as it was');

// An award's choices as sent
ctx.setFP({awards: [{tracking_id: 'a', source: 'foundation', default_source: 'foundation', share: null, left_out: false}], pending: [], other_year_awards: []});
ctx.fpSaveAward('a', {source: 'corporate'});
ctx.fpSaveAward('a', {share: '$20,000'});
ctx.fpSaveAward('a', {source: 'foundation'});
eq(ctx.sent, [{awards: {a: {source: 'corporate', share: null, left_out: false}}}, {awards: {a: {source: null, share: 20000, left_out: false}}}, {awards: {a: null}}],
   'a choice is sent as a change; back to the defaults clears it');

ok(/data-page="plan" class="acct-only" onclick="openFundingPlan\(\)">Funding Plan</.test(html) && /id="page-plan"[\s\S]*?id="fpBody"/.test(html), 'the portal has the page, for accounts only');
ok(/nonprofit-funding-plan\.js\?v=\d{4}-\d{2}-\d{2}/.test(html), 'the portal loads the script with a version tag');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
