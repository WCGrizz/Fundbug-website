// The Tracker's stage filter (Nov 27 2026): stages in use first with their counts, the rest under Other Stages.
// Runs without a browser:  node nonprofit-tracker-stages.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const a = html.indexOf('function stageOptions'), b = html.indexOf('// Open Tracker rows');
const ctx = {escHtml: s => String(s)}; vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + '\n;globalThis.__t = {stageOptions};', ctx);
const stages = ['saved', 'researching', 'contacted', 'loi_sent', 'invited', 'in_progress', 'submitted', 'awarded', 'declined']
  .map(c => ({code: c, label: c}));
const items = [{status: 'in_progress'}, {status: 'awarded'}, {status: 'submitted'}, {status: 'awarded', seen_in_digest: true}];
const out = ctx.__t.stageOptions(stages, items);
ok(out.startsWith('<option value="">Every Stage (3)</option>'), 'Every Stage counts the saved items (not those only seen in a digest)');
ok(out.indexOf('in_progress (1)') < out.indexOf('<optgroup label="Other Stages">') && out.includes('awarded (1)'), 'stages in use first, with counts');
ok(/<optgroup label="Other Stages">.*saved.*declined.*<\/optgroup>/.test(out) && !/saved \(/.test(out), 'the rest under Other Stages, without counts');
ok(/stSel\.innerHTML = stageOptions\(TRACKER\.stages, TRACKER\.items\); stSel\.value = stKeep;/.test(html), 'redrawn with the list, the choice kept');
process.exit(fails ? 1 : 0);
