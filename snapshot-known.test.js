// The snapshot page's "You May Already Know This Funder" line (2026-10-21, Will: "these are grants/funders you
// should/may already know about"). Run: node snapshot-known.test.js
const fs = require('fs');
const h = fs.readFileSync('snapshot.html', 'utf8');
const m = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
const api = new Function(m.replace(/\n\(function \(\) \{[\s\S]*$/, '') + '; return {card, program, setOrg: n => { ORG = n; }};')();
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
api.setOrg('Berkshire Agricultural Ventures');
const c = api.card({ title: 'Lee Bank Foundation', funded_you: { dollars: 740928, grants: 9, first: 2021, last: 2024 } });
ok(c.includes('You May Already Know This Funder') && c.includes('Its filings list $740,928 in grants to Berkshire Agricultural Ventures, 2021 to 2024.'),
   'a funder that already gives to them is marked, with what its filings list');
const p = api.program({ title: 'Green Pastures Fund', funded_you: { dollars: 5000, grants: 1, first: 2023, last: 2023 } });
ok(p.includes("Its funder's filings list $5,000 in grants to Berkshire Agricultural Ventures, 2023."), "a program says it is its funder's grants");
ok(!api.card({ title: 'X' }).includes('Already Know') && !api.card({ title: 'X', funded_you: {} }).includes('Already Know'), 'the rest are not marked');
ok(h.includes('A few of these may already fund you'), 'the note above the lists');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
