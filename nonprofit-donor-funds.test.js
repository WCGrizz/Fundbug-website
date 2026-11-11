// A community foundation's donor-advised funds (Nov 6 2026, Will: the community foundation route to DAF donors): the
// funder page's Its Donors' Funds, and the Funding Plan's community foundations whose donors give near you. The
// people behind the funds are never named. Run: node nonprofit-donor-funds.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const js = fs.readFileSync(__dirname + '/nonprofit-funding-plan.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function money\(n\).*/), grab(/const shortMoney = .*/), grab(/const MONTH_NAMES = .*/),
                 grab(/function line\(title, html\).*/), grab(/function donorFundsLine\(d\)[\s\S]*?\n\}/), js,
                 'globalThis.t = {donorFundsLine};'].join('\n'), ctx);
const t = ctx.t;
const btcf = {year: 2024, funds: 186, value: 56326926, grants: 6857531, contributions: 6176306, share: 0.46, services_url: null};
const h = t.donorFundsLine(btcf);
ok(h.includes("<h4>Its Donors' Funds</h4>") && h.includes('<b>186</b> donor-advised funds, worth <b>$56.3 million</b> (its 2024 Form 990)'), 'how many funds it holds and their worth, with the source');
ok(h.includes('recommended <b>$6.9 million</b> in grants, about 46% of its giving'), 'what its donors recommended, as a part of its giving');
ok(h.includes('FundBug never names them') && !h.includes('page for donors</a>'), 'says the donors are never named; no link until Will approves one');
ok(t.donorFundsLine({...btcf, services_url: 'https://x.org/donors'}).includes('href="https://x.org/donors"'), 'an approved donor services page is linked');
ok(t.donorFundsLine(null) === '' && t.donorFundsLine({year: 2024}) === '', 'none on file: no line');
ok(/put\('contact', donorFundsLine\(L\.donor_funds\)\);/.test(html), 'the funder page shows it, under People And Contact');
// Nov 11 2026 (Will): the community foundation list left the Donors page ("i dont know if we need" it); each community
// foundation's own page keeps Its Donors' Funds (above). The DAF note is said simply, and the list is "your
// organization's donor list".
const dc = js.slice(js.indexOf('function fpDonorsCard'), js.indexOf('function fpPanel('));
ok(!/Community Foundations Whose Donors|fpCfCard|fpLoadCf|donor-fund-foundations/.test(js), 'no community foundation list on the Donors page, and nothing loads one');
ok(dc.includes("<p class=\"lead\">Your organization's donor list.") && !dc.includes('FundBug never shares it'), "the list is introduced as your organization's donor list");
ok(/const FP_DAF_TIP = 'Some donors give through a donor-advised fund \(DAF\)/.test(js) && !/EIN/.test(js.match(/const FP_DAF_TIP = .*/)[0]), 'the DAF note is short and plain');
const at = x => dc.indexOf(x);
ok(at('class="fp-actions"') > 0 && at('class="fp-actions"') < at('Gifts From Donor-Advised Funds'), 'Donors: the list and its buttons first, then the DAF note');
// The table (Will: "a mix of left justified and right justified columns spaced weirdly"): set widths, dollars right
// aligned under right-aligned headings, room before the text columns, a dash for an empty cell, second lines beneath.
ok(/<table class="fp-dtable"><colgroup>(<col class="c-[a-z]+">){5}<\/colgroup>/.test(dc) && /\.gp-table table\.fp-dtable\{table-layout:fixed/.test(html),
   'the donor table has set column widths');
ok(/<th class="num">Given This Year<\/th><th class="num">Pledged This Year<\/th><th class="gap">Last Gift<\/th>/.test(dc) && /\.fp-dtable \.gap\{padding-left:\d{2}px\}/.test(html),
   'the dollar columns and their headings are right aligned, with room before Last Gift');
ok(/d\.given_this_year \? money\(d\.given_this_year\) : '–'/.test(dc) && /d\.pledged_this_year \? money\(d\.pledged_this_year\) : '–'/.test(dc),
   'an empty cell shows a dash, never a blank beside a figure');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
