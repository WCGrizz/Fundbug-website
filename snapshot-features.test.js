// The snapshot carries the digest's features (2026-10-21, Will: "the personalization that comes with the digest isnt
// there, nor are most of the digest features ... I want someone looking at the Snapshot to be really wowed").
// Run: node snapshot-features.test.js
const fs = require('fs');
const h = fs.readFileSync('snapshot.html', 'utf8');
const m = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
const api = new Function(m.replace(/\n\(function \(\) \{[\s\S]*$/, '') + '; return {card, program, chart, vote, setOrg: n => { ORG = n; }, setCheck: c => { CHECK = c; }};')();
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
api.setOrg('Berkshire Agricultural Ventures');
const f = api.card({ id: 'g1', title: 'The Harold Grinspoon Charitable Foundation', fit: { verdict: 'strong' }, typical: '$2,200 to $2,500',
  first_grant: 'typically $2,500', where: 'Western Massachusetts', mode: 'rolling', why_it_fits: 'Farming is one of its priorities.',
  next_step: 'Ask how it chooses Local Farmer Award recipients.', giving_by_year: { 2022: 753749, 2023: 1244213, 2024: 716453 },
  description: 'A long description that is shown whole inside its own section.', site: 'https://www.hgcf.org' });
ok(f.includes('Strong Fit') && f.includes('<b>Why It Fits</b> Farming is one of its priorities.') && f.includes('Ask how it chooses'), 'the fit, the write-up and the next step');
ok(f.includes('Typical grant: $2,200 to $2,500 · First grants to a new organization: typically $2,500'), 'the typical first grant');
ok(f.includes('Its giving by year, from its IRS filings') && f.includes('$1.2M') && f.includes('>2024<'), 'the giving chart');
ok(f.includes("'save')") && f.includes("'down')") && f.includes("'up')") && f.includes('+ Save To Tracker'), 'Save To Tracker, Not A Fit and Good Match');
ok(f.includes('<details><summary>About This Funder</summary>') && !/\.\.\.|…/.test(f), 'the whole description, never cut');
ok(api.chart({ 2024: 5 }) === '', 'no chart from a single year');
// The local day ten days out (a UTC one is a day later after 8 pm Eastern, and the test failed every evening).
const soon = new Date(); soon.setDate(soon.getDate() + 10);
const p = api.program({ id: 'g2', title: 'Green Pastures Fund', deadline_date: `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`, amount: '$1,000 to $3,000' });
ok(p.includes('&#9888; Deadline:') && p.includes('(10 days)'), 'a close deadline is a warning with its days left');
ok(h.indexOf('We used publicly available information to build a basic profile') < h.indexOf("'<h1>Grants And Funders For '"), 'the profile note comes above the heading (Will)');
ok(!/\bin Berkshire County\b|your work' \+ where/.test(h), 'no single-county line');
ok(/VOTES_LIVE = Object\.prototype\.hasOwnProperty\.call\(d, 'summary'\)/.test(h) && /\(VOTES_LIVE \? '<button/.test(h),
   'the buttons show only once the API that records them answers (the one that returns the summary)');
ok(/CHECK = new URLSearchParams\(location\.search\)\.get\('check'\) === '1'/.test(h) && /\(CHECK \? '\?check=true' : ''\)/.test(h),
   'a ?check=1 look asks the API not to count an open');
(async () => {
  // A vote in Will's own look (?check=1, Oct 21 2026: a snapshot shown in a meeting) shows and records nothing.
  const sent = []; global.fetch = (u, o) => { sent.push(u); return Promise.resolve({ ok: true }); };
  const fake = () => { const row = { kids: [], querySelector: () => null, appendChild: k => row.kids.push(k) };
    return { row, btn: { parentNode: row, closest: () => ({ classList: { toggle() {} } }) } }; };
  global.document = { createElement: () => ({}) };
  api.setCheck(true); let x = fake(); api.vote(x.btn, 'g1', 'save'); await new Promise(r => setTimeout(r, 5));
  ok(sent.length === 0 && x.row.kids.length === 1 && /Saved/.test(x.row.kids[0].textContent), 'a vote in a ?check=1 look is shown and never sent');
  api.setCheck(false); x = fake(); api.vote(x.btn, 'g1', 'save'); await new Promise(r => setTimeout(r, 5));
  ok(sent.length === 1 && /\/feedback$/.test(sent[0]), 'a visitor\'s vote is sent');
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
