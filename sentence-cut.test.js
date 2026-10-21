// Long descriptions end at the end of a sentence, never with "..." (2026-10-21, Will: "there shouldnt ever be a ...,
// all copy should end correctly. i dont care if the entry is a bit longer"). Run: node sentence-cut.test.js
const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const load = (file, name) => { const h = fs.readFileSync(file, 'utf8');
  return new Function(h.match(new RegExp('(?:var|const) ABBR[\\s\\S]*?\\nfunction ' + name + '\\(t, n\\) \\{[\\s\\S]*?\\n\\}'))[0] + '; return ' + name + ';')(); };
const G = 'The Harold Grinspoon Charitable Foundation is a private foundation based in Agawam, Massachusetts, that works to enrich the quality of life in the Western Massachusetts region. Its mission centers on education, farming, and energy conservation, including its Local Farmer Awards program that celebrates farmers and teachers, provides free books to preschoolers to build literacy, and encourages homeowners and schoolchildren to conserve energy. Grants typically range from $2,200 to $2,500.';
for (const [file, name] of [['snapshot.html', 'short'], ['nonprofit-portal.html', 'sentenceCut']]) {
  const cut = load(file, name);
  const g = cut(G, 420);
  ok(g.endsWith('to conserve energy.') && !/\.\.\.|…/.test(g), file + ': the Grinspoon entry ends at its sentence (it trailed off "encourages homeowners and...")');
  ok(cut('Short and whole.', 420) === 'Short and whole.', file + ': a short one is left whole');
  const us = 'Funds projects across the U.S. Department of Agriculture regions and beyond, for farms of every size and kind. More text follows here.';
  ok(cut(us, 60) === 'Funds projects across the U.S. Department of Agriculture regions and beyond, for farms of every size and kind.', file + ': "U.S." does not end a sentence');
  ok(!/\.\.\.|…/.test(cut('a'.repeat(900) + ' with no sentence end at all', 420)), file + ': no ellipsis even when there is no sentence end');
}
ok(!/title\.slice\(0, 38\) \+ '\.\.\.'/.test(fs.readFileSync('portal.html', 'utf8')), 'portal.html: the hidden-program message shows the whole title');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
