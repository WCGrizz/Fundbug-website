// A long shot on the snapshot page (2026-10-27, Will: the $3 million Hilton Humanitarian Prize "shouldnt be anyones top
// spot"; the backend never puts one first). Run: node snapshot-longshot.test.js
const fs = require('fs');
const h = fs.readFileSync('snapshot.html', 'utf8');
const m = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]).join('\n');
const api = new Function(m.replace(/\n\(function \(\) \{[\s\S]*$/, '') + '; return {program, setOrg: n => { ORG = n; }};')();
let fails = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
api.setOrg('Roots Rising');
const p = api.program({ title: 'Conrad N. Hilton Humanitarian Prize', amount: '$3,000,000',
                        long_shot: 'one $3 million prize a year, chosen from hundreds of nominations worldwide' });
ok(p.includes('>Long Shot<') && p.includes('A long shot: one $3 million prize a year, chosen from hundreds of nominations worldwide.'),
   'a long shot is labelled and says why');
const q = api.program({ title: 'Youth Fund', amount: '$5,000' });
ok(!q.includes('Long Shot') && !q.includes('A long shot'), 'the rest are not');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
