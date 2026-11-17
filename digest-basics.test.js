// The Basics in the portal's digest archive (Nov 17 2026, fundbug_basics): openDigest shows what /api/portal/digest
// returns in basics after the matches, escaped, at 14px or more in ink; a digest without basics shows no section.
// Run: node digest-basics.test.js
const fs = require('fs');
const h = fs.readFileSync(__dirname + '/portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const start = h.indexOf('async function openDigest(');
const end = h.indexOf('\nfunction closeDigest()', start);
const src = h.slice(start, end);
const els = {};
global.document = { getElementById: id => (els[id] = els[id] || { innerHTML: '', textContent: '', style: {} }) };
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let reply;
const apiFetch = async () => reply;
eval(src);
(async () => {
  reply = { digest: { sent_at: '2026-12-01T13:00:00Z', slot_count: 1 },
            programs: [{ program_id: 'p1', title: 'NIH SBIR', capital_type: 'Grant' }],
            basics: [{ title: 'Center for Women & Enterprise', note: 'Free advising <for> women-owned businesses.',
                       url: 'https://www.cweonline.org', cta: 'Find Your Center' }] };
  await openDigest('00000000-0000-0000-0000-000000000001');
  let out = els.digestModalBody.innerHTML;
  ok(/The Basics/.test(out) && /Center for Women &amp; Enterprise/.test(out) && /&lt;for&gt;/.test(out), 'shown, escaped');
  ok(out.indexOf('NIH SBIR') < out.indexOf('The Basics'), 'after the matches');
  const block = out.slice(out.indexOf('The Basics') - 300);
  ok(!/font-size:1[0-3]px/.test(block) && !/var\(--muted\)/.test(block), 'no small or gray text in it');
  reply = { digest: { sent_at: '2026-12-01T13:00:00Z' }, programs: [{ program_id: 'p1', title: 'NIH SBIR' }] };
  await openDigest('00000000-0000-0000-0000-000000000002');
  ok(!/The Basics/.test(els.digestModalBody.innerHTML), 'none when the digest carried none');
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
