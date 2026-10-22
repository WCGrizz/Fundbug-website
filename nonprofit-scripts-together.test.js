// The nonprofit pages' scripts, loaded together as the browser loads them, must not declare one name twice (Oct 22 2026:
// nonprofit-choices.js and the portal page both declared titleCase, and the portal was blank for two days, since a
// classic script that redeclares a name never runs). Run: node nonprofit-scripts-together.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0;
for (const page of ['nonprofit-portal.html', 'nonprofit-signup.html']) {
  const h = fs.readFileSync(path.join(__dirname, page), 'utf8');
  const parts = [...h.matchAll(/<script(?:\s+src="\/([^"?]+)[^"]*")?\s*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1] ? fs.readFileSync(path.join(__dirname, m[1]), 'utf8') : m[2]);
  try { new vm.Script(parts.join('\n;\n'), { filename: page }); console.log('PASS ' + page + ': its scripts load together'); }
  catch (e) { console.log('FAIL ' + page + ': ' + e.message); fails++; }
}
process.exit(fails ? 1 : 0);
