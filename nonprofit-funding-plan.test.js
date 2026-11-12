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
                 js, 'globalThis.t = {fpStack, fpBandHtml, fpSourceRow, fpItemsHtml, fpPlannedLine, fpStoredItems, fpYearLabel, fpParse, fpParseCsv, fpGuessColumns, fpDate, fpRowsFrom, fpDownloadText, fpTotalsLine};',
                 'globalThis.setFP = v => { FP = v; }; globalThis.sent = []; fpSave = c => { sent.push(c); };', 'globalThis.fpSaveAward = fpSaveAward;'].join('\n'), ctx);
const t = ctx.t;

// "Berkshire County" stored with the word is not doubled (Nov 9 2026: "organizations in Berkshire County County")
// fpCountyName left with the community foundation list (Nov 11 2026).
const src = (key, label, planned, secured, pending, extra) => ({key, label, planned, secured, pending, shown: Math.max(planned, secured + pending),
  secured_other: 0, secured_tracker: 0, secured_donors: 0, pending_unknown: 0, from_tracker: false, ...extra});
const view = {fiscal_year: 2027, end_month: 6, goal: 500000, sources: [src('earned', 'Earned Revenue', 0, 0, 0), src('government', 'Government Grants', 100000, 25000, 30000),
  src('foundation', 'Foundation Grants', 200000, 60000, 0), src('individual', 'Individual Donors', 50000, 70000, 0)],
  totals: {planned: 350000, secured: 155000, pending: 30000, shown: 370000, to_raise: 345000}};

// The stack (Nov 5 2026: one bar to the goal over a row per source, Will's "B over A")
const svg = t.fpStack(view);
// Each source's bar is its row under Your Sources since Nov 10 2026 (every source, so each has its Add Source).
const rows = view.sources.map(t.fpBandHtml).join('');
ok((rows.match(/class="fp-band"/g) || []).length === 4 && !svg.includes('class="fp-band"'), 'every source has a row under Your Sources, none in the stack');
ok(/Foundation Grants<\/span>.*?\$60K of \$200K/s.test(rows) && /Government Grants<\/span>.*?\$25K of \$100K/s.test(rows), 'each row says what is secured of what is planned');
ok(/\$70K of \$50K.*?\(more than planned\)/s.test(rows), 'a source past its plan says so');
ok(/fp-band" data-key="government".*?fp-pending/s.test(rows) && !/fp-band" data-key="foundation"[^]*?fp-pending[^]*?data-key="individual"/s.test(rows), 'pending is striped, only where there is some');
ok(svg.includes('Not yet planned: $130,000') && svg.includes('Goal $500,000'), 'the goal heads the bar and the unplanned part up to it is shown');
const widths = Object.fromEntries([...svg.matchAll(/<i class="fp-seg" style="width:([\d.]+)%;background:([^"]+)"/g)].map(m => [m[2], +m[1]]));
ok(Math.abs(widths['#3d7a38'] - 12) < 0.01 && Math.abs(widths['#2f5d7c'] - 5) < 0.01, 'the goal bar shows each source\'s secured money in proportion to the goal');
ok(!svg.includes('<svg') && !svg.includes('fp-label'), 'no text drawn over the colors');
ok(t.fpStack({...view, goal: null, sources: view.sources.map(s => ({...s, shown: 0})), totals: {...view.totals, shown: 0}}).includes('Set this year'), 'nothing yet: an invitation, not an empty box');
ok(!t.fpStack({...view, goal: 100000}).includes('Not yet planned'), 'planned past the goal: no unplanned part');
ok(t.fpBandHtml(src('other', '<b>x</b>', 10, 0, 0)).includes('&lt;b&gt;'), 'labels are escaped');
ok(t.fpTotalsLine(view).includes('$155,000') && t.fpTotalsLine(view).includes('(31% of goal)') && t.fpTotalsLine(view).includes('$345,000'), 'the totals over the stack');

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
eq(ctx.sent, [{awards: {a: {source: 'corporate', share: null, left_out: false, restricted: false}}}, {awards: {a: {source: null, share: 20000, left_out: false, restricted: false}}}, {awards: {a: null}}],
   'a choice is sent as a change; back to the defaults clears it');

ok(/FP_MATCH_SOURCES\[s\.key\] && s\.planned > s\.secured \? `<button class="btn ghost sm" onclick="fpFindMatches\('\$\{s\.key\}'\)">/.test(js) && /foundation: 'Find Foundation Matches'/.test(js), 'a source with money still to raise links to its matches');

// Your Sources (Nov 10 2026, Will: "Under sources such as Earned revenue or foundation grant etc, there should be a button
// like Add source"; "a toggle ... between sum of items and manual entry"; the gap "its own page ... not expanded by default").
const ev = src('events', 'Events', 21200, 1200, 0, {planned_mode: 'items', planned_manual: 0, items_total: 21200, items: [
  {id: 'bake01', name: 'Bake Sale Fundraiser', amount: 1200, date: '2026-10-04', status: 'secured', restricted: true, notes: null, counted_by_tracker: false},
  {id: 'gala01', name: 'Spring <Gala>', amount: 20000, date: null, status: 'planned', counted_by_tracker: false}]});
ctx.setFP({...view, sources: [ev, src('foundation', 'Foundation Grants', 40000, 35000, 0, {planned_mode: 'manual', planned_manual: 40000, items_total: 40000, items: [
  {id: 'item0a', name: 'Coolidge Hill', amount: 40000, status: 'planned', tracking_id: 'a', counted_by_tracker: true}]})],
  awards: [{tracking_id: 'a', title: 'Coolidge Hill Foundation', source: 'foundation', amount: 35000, counted: 35000, decided_on: '2026-09-15'}], pending: []});
const folded = t.fpSourceRow(ev);
ok(folded.includes('aria-expanded="false"') && !folded.includes('Add Source') && !folded.includes('Bake Sale'), 'a source starts folded to its bar');
vm.runInContext("FP_OPEN.add('events')", ctx);
const opened = t.fpSourceRow(ev);
ok(opened.includes('aria-expanded="true"') && opened.includes(`onclick="fpAddPanel('events')">Add Source</button>`), 'open, it has its Add Source button');
ok(/Bake Sale Fundraiser<\/b>\s*<span class="fp-pill secured">Secured<\/span><span class="fp-pill">Restricted<\/span>/.test(opened) && opened.includes('$1,200 · Oct 4, 2026'),
   'an item shows its name, status, restricted, amount and date');
ok(opened.includes('Spring &lt;Gala&gt;') && !opened.includes('<Gala>'), "an item's name is escaped");
ok(/class="on" aria-pressed="true"[^>]*>Sum Of Items/.test(t.fpPlannedLine(ev)) && !t.fpPlannedLine(ev).includes('<input'), 'Sum Of Items: the sum, no box to type in');
const fnd = ctx.t.fpPlannedLine({...ev, key: 'foundation', planned_mode: 'manual', planned_manual: 40000, items_total: 35000});
ok(/class="on" aria-pressed="true"[^>]*>Enter An Amount/.test(fnd) && fnd.includes('value="$40,000"') && fnd.includes('$35,000 in the items below'), 'Enter An Amount: the typed amount, with the items\' sum beside it');
const fItems = t.fpItemsHtml(vm.runInContext('FP.sources[1]', ctx));
ok(fItems.includes('Counted From Your Tracker') && fItems.includes('Awarded In Your Tracker') && fItems.includes('$35,000 awarded'),
   'an item the Tracker counts says so, beside the award itself (never counted twice)');
ok(fItems.includes('<summary>More Detail</summary>') && fItems.includes('Leave Out Of The Plan') && fItems.includes("This Year's Share"), "an award's choices sit behind More Detail");
eq(t.fpStoredItems('events')[0], {id: 'bake01', name: 'Bake Sale Fundraiser', amount: 1200, date: '2026-10-04', status: 'secured', restricted: true, notes: null, tracking_id: undefined, group_id: undefined},
   'what is sent back is the stored form, without the figures the page was given');
ok(/if \(FP_VIEW === 'gap'\)/.test(js) && /\{path: 'plan\/gap', page: 'plan', label: 'Close The Gap'/.test(html) && /\{path: 'plan\/donors', page: 'plan', label: 'Donors'/.test(html),
   'Close The Gap and Donors are their own pages in Funding Plan\'s column');
ok(/\(!src \|\| m\.source === src\)/.test(html) && /id="mSource"/.test(html), 'Matches filters by source');
ok(/\{key: 'plan', label: 'Funding Plan', (short: 'Plan', )?acct: true/.test(html) && /id="page-plan"[\s\S]*?id="fpBody"/.test(html), 'the portal has the page, for accounts only');
ok(/nonprofit-funding-plan\.js\?v=\d{4}-\d{2}-\d{2}/.test(html), 'the portal loads the script with a version tag');
// Nov 5 2026, Will: "add a bit more instruction on how to use the funding plan tab".
{
  vm.runInContext(js.match(/function fpGuide\([\s\S]*?\n\}/)[0] + ';globalThis.__g = fpGuide;', ctx);
  const g = ctx.__g;
  ok(g && /<details class="card fp-guide" open>/.test(g({totals: {planned: 0, secured: 0, pending: 0}})), 'an empty plan opens How This Page Works');
  ok(g && !/ open>/.test(g({totals: {planned: 1000, secured: 0, pending: 0}})), 'a plan with figures folds it');
  ok(g && /mark Submitted or Awarded in your Tracker/.test(g({totals: {}})) && /donor list/.test(g({totals: {}})) && /Add Source/.test(g({totals: {}})), 'it says what counts by itself, and how to add the rest');
}
// Nov 5 2026: restricted money, and funders that could close the gap.
{
  ctx.sent.length = 0;
  ctx.setFP({awards: [{tracking_id: 'a', source: 'foundation', default_source: 'foundation', share: null, left_out: false, restricted: false}], pending: [], other_year_awards: []});
  ctx.fpSaveAward('a', {restricted: true});
  eq(ctx.sent, [{awards: {a: {source: null, share: null, left_out: false, restricted: true}}}], 'ticking Restricted sends it and keeps the award');
  vm.runInContext(js.match(/function fpGapCard\([\s\S]*?\n\}/)[0] + ';globalThis.__gap = fpGapCard;', ctx);
  const card = ctx.__gap({gaps: [{key: 'foundation', label: 'Foundation Grants', gap: 105000, picks: [{id: 'g1', title: '<i>Fund</i>', typical_min: 10000, typical_max: 50000, deadline: 'Rolling'}]}]});
  ok(card.includes('$105,000 still to find') && card.includes('&lt;i&gt;Fund&lt;/i&gt;') && card.includes('Typical grant $10K to $50K'), 'the gap card names the gap and each pick, escaped, with its typical grant');
  ok(ctx.__gap({gaps: []}).includes('fully planned'), 'no gap: says so');
  ok(/total.?restricted|restricted/.test(t.fpTotalsLine({...view, totals: {...view.totals, restricted: 5000, unrestricted: 150000}})), 'the secured tile says how much is restricted');
}
// Donor-advised funds (Nov 6 2026, Susan of Minerva; Will: approved).
{
  const csv = t.fpDownloadText([{name: 'Pat', email: '', phone: '', gifts: [{date: '2026-08-01', amount: 2500, note: '', daf: 'Fidelity Charitable'}]}]);
  ok(csv.split('\r\n')[0].includes('Through A DAF') && csv.includes(',Fidelity Charitable,'), 'the spreadsheet download carries each gift\'s DAF sponsor');
  vm.runInContext(`FP = {fiscal_year: 2027}; FP_DQ = ''; FP_DONORS = {donors: [
    {id: 'd1', name: 'Pat Lee', given_this_year: 3200, pledge_open: 0, pledged_this_year: 0, daf_sponsors: ['Fidelity Charitable'], given_through_daf_this_year: 2500, gifts: []},
    {id: 'd2', name: 'Sam Roe', given_this_year: 100, pledge_open: 0, pledged_this_year: 0, daf_sponsors: [], given_through_daf_this_year: 0, gifts: []}]};
    globalThis.__card = fpDonorsCard();`, ctx);
  const card = ctx.__card;
  ok(card.includes('($2,500</b> of it through donor-advised funds)') || card.includes('<b>$2,500</b> of it through donor-advised funds'), 'the donor list says how much came through DAFs');
  ok((card.match(/Gives Through A DAF/g) || []).length === 1, 'a donor who gave through a DAF is marked; one who did not is not');
  ok(card.includes('Add An Anonymous DAF Gift') && card.includes('A DAF button on your donation page'), 'an anonymous DAF gift can be added, and the list says how to welcome DAF gifts');
  ok(/s\.through_daf \? ` \(\$\{money\(s\.through_daf\)\} through donor-advised funds\)`/.test(js), 'the Individual Donors row says how much came through DAFs');
  ok(/list="fdDafList"/.test(js) && /FP_EDIT\.gifts\[\$\{i\}\]\.daf=this\.value\.trim\(\)/.test(js) && /'Fidelity Charitable'/.test(js), 'each gift takes a sponsor, with the common ones suggested');
  ok(/no tax receipt/.test(js) && /cannot pay for event tickets/.test(js), 'the panel says how to thank and what a DAF cannot pay for');
}
// Percentages beside the dollars (Nov 6 2026, Will).
{
  const v = {fiscal_year: 2027, goal: 450000, totals: {planned: 450000, secured: 181750, pending: 15000, shown: 450000, restricted: 0, unrestricted: 181750, to_raise: 268250},
             sources: [{key: 'earned', label: 'Earned Revenue', planned: 90000, secured: 58000, pending: 0, shown: 90000},
                       {key: 'individual', label: 'Individual Donors', planned: 70000, secured: 22250, pending: 15000, shown: 70000}]};
  const st = t.fpStack(v), tl = t.fpTotalsLine(v);
  ok(st.includes('$181,750 secured (40%), $15,000 pending (3%)'), 'the stack says what share of the goal is secured and pending');
  const bands = v.sources.map(t.fpBandHtml).join('');
  ok(bands.includes('$58K of $90K <b>64%</b>') && bands.includes('$22K of $70K <b>32%</b>'), 'each source says what share of its plan is secured');
  ok(tl.includes('pending (3% of goal)') && tl.includes('still to raise (60% of goal)'), 'the tiles give shares of the goal');
  vm.runInContext('globalThis.__foot = fpTotalsFoot;', ctx);
  ok(ctx.__foot({goal: 450000, totals: {planned: 450000, secured: 181750, pending: 40000, still_to_raise: 268250}}).includes('$450,000 planned (100% of your goal)'),
     "the sources' total gives its share of the goal");
  ok(!t.fpStack({...v, goal: 0}).includes('(0%)'), 'no goal: no shares of it');
}
// Pending entered and attributed (Nov 6 2026, Will), as items since Nov 10 2026: an amount entered the earlier way is
// its own line, editable; the Tracker's applications and the donors' pledges each say where they come from.
{
  ctx.setFP({fiscal_year: 2027, sources: [], awards: [], pending: [{tracking_id: 'p1', title: 'Mass Cultural Council', source: 'foundation', amount_requested: 5000}]});
  const f = t.fpItemsHtml({key: 'foundation', label: 'Foundation Grants', items: [], secured_other: 0, pending_entered: 20000, restricted_entered: 0});
  ok(f.includes('Entered as one amount') && f.includes('$20,000 pending') && f.includes(`fpOneAmountPanel('foundation')`), 'pending entered as one amount stays, and can be changed');
  ok(f.includes('Submitted In Your Tracker') && f.includes('$5,000 asked'), 'an application in the Tracker counts as pending, said');
  const i = t.fpItemsHtml({key: 'individual', label: 'Individual Donors', items: [], secured_donors: 22250, pending_pledges: 15000, through_daf: 0});
  ok(i.includes('Your donor list') && i.includes('$22,250 given this year') && i.includes('$15,000 pledged and still to come') && i.includes("go('plan/donors')"),
     "Individual Donors shows its donors' gifts and pledges, and opens the Donors page");
  ok(/key === 'individual' \? \['planned', 'secured'\]/.test(js), "an item under Individual Donors is never Pending (pledges are)");
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
