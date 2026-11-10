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
                 'globalThis.t = {donorFundsLine, fpCfCard};'].join('\n'), ctx);
const t = ctx.t;
const btcf = {year: 2024, funds: 186, value: 56326926, grants: 6857531, contributions: 6176306, share: 0.46, services_url: null};
const h = t.donorFundsLine(btcf);
ok(h.includes("<h4>Its Donors' Funds</h4>") && h.includes('<b>186</b> donor-advised funds, worth <b>$56.3 million</b> (its 2024 Form 990)'), 'how many funds it holds and their worth, with the source');
ok(h.includes('recommended <b>$6.9 million</b> in grants, about 46% of its giving'), 'what its donors recommended, as a part of its giving');
ok(h.includes('FundBug never names them') && !h.includes('page for donors</a>'), 'says the donors are never named; no link until Will approves one');
ok(t.donorFundsLine({...btcf, services_url: 'https://x.org/donors'}).includes('href="https://x.org/donors"'), 'an approved donor services page is linked');
ok(t.donorFundsLine(null) === '' && t.donorFundsLine({year: 2024}) === '', 'none on file: no line');
ok(/put\('contact', donorFundsLine\(L\.donor_funds\)\);/.test(html), 'the funder page shows it, under People And Contact');
const card = t.fpCfCard({county: 'Berkshire', foundations: [{name: 'Berkshire Taconic Community Foundation', listing_id: 'L1', here_grants: 526, here_dollars: 22721962, donor_funds: btcf}]});
ok(card.includes(`openListing('L1')`) && card.includes('186 donor-advised funds holding $56.3 million; its donors recommended $6.9 million in grants in 2024.'), 'the plan card names the foundation, its funds and its donors\' giving');
ok(card.includes('526 grants to organizations in Berkshire County ($22.7 million)') && card.includes('FundBug never names them'), 'and its grants in your county');
ok(t.fpCfCard({county: 'Berkshire', foundations: []}).includes('No community foundation with donor-advised funds gives in Berkshire County'), 'none: says so');
ok(t.fpCfCard({error: 'down', foundations: []}).includes('could not be read just now'), 'a failed read says so, never "none"');
ok(/<h3 class="fp-h3">Community Foundations Whose Donors Give Near You<\/h3><div id="fpCf">/.test(js) && /fpLoadCf\(\);/.test(js), 'the donor card loads it');
const tbf = t.fpCfCard({county: 'Berkshire', foundations: [{name: 'The Boston Foundation', here_grants: 38, here_dollars: 1300000, donor_funds: {...btcf, value: 1403500000}}]});
ok(tbf.includes('holding $1.4 billion') && !tbf.includes('1403.5 million'), 'a fund over a billion reads as billions (Will saw "$1403.5 million")');
// Nov 10 2026 (Will: "reads very flatly"): the donor list comes first, then DAF gifts and the community foundations, each its own part.
const dc = js.slice(js.indexOf('function fpDonorsCard'), js.indexOf('function fpPanel('));
const at = x => dc.indexOf(x);
ok(at('class="fp-actions"') > 0 && at('class="fp-actions"') < at('Gifts From Donor-Advised Funds') && at('Gifts From Donor-Advised Funds') < at('Community Foundations Whose Donors'),
   'Donors: the list and its buttons first, then two parts with their own headings');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
