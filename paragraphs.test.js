// The portals' paragraph rule (Nov 24 2026) agrees with the backend's fundbug_paragraphs.py on its shared cases
// (paragraph_cases.json, a copy of fundbug/tests/paragraph_cases.json). Run: node paragraphs.test.js
const fs = require('fs');
const cases = JSON.parse(fs.readFileSync(__dirname + '/paragraph_cases.json', 'utf8'));
let bad = 0;
for (const file of ['nonprofit-portal.html', 'portal.html']) {
  const src = fs.readFileSync(__dirname + '/' + file, 'utf8');
  const start = src.indexOf('// ── Short paragraphs, never a wall'); const end = src.indexOf('function paraHtml');
  const f = new Function(src.slice(start, src.indexOf('\n}', end) + 2) + '\nreturn {paragraphs, paraHtml};')();
  for (const c of cases) if (JSON.stringify(f.paragraphs(c.text)) !== JSON.stringify(c.paragraphs)) { bad++; console.log('FAIL', file, JSON.stringify(c.text.slice(0, 60))); }
  if (f.paraHtml('One here. Two <b>. Three here. Four here.', s => s.replace(/</g, '&lt;')) !== '<p style="margin-bottom:10px">One here. Two &lt;b>.</p><p>Three here. Four here.</p>') { bad++; console.log('FAIL paraHtml', file); }
}
console.log(bad ? `${bad} failed` : 'PASS the portals cut text into the same short paragraphs as the backend');
process.exit(bad ? 1 : 0);
