// Find A Funder searches every funder FundBug knows (Nov 12 2026, Will: yes): the Library's names first, at once, then
// the server's search below them; a funder with no Library listing opens /nonprofit/funder/<id>, its page from its
// record, with no Save (saving needs a listing).  Run: node nonprofit-find-funder.test.js
const fs = require('fs');
const vm = require('vm');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const code = html.slice(html.indexOf('// Find A Funder (Nov 10 2026)'), html.indexOf('// ── profile form'));

(async () => {
  const els = {topQ: {value: '', setAttribute() {}, blur() {}}, topHits: {innerHTML: '', hidden: true}};
  const went = [], opened = [], asked = [];
  let answer = {funders: []};
  const ctx = {
    document: {getElementById: id => els[id], querySelectorAll: () => []}, MODE: 'account', setTimeout: (f) => { f(); return 1; },
    clearTimeout() {}, escHtml: s => String(s), encodeURIComponent,
    RESULT: {shown: [{id: 'g-crane', title: 'Crane Family Foundation', kind: 'funder'}]},
    apiFetch: async path => { asked.push(path); return answer; },
    openListing: id => opened.push(id), go: p => went.push(p),
  };
  vm.createContext(ctx);
  vm.runInContext(code + ';globalThis.T = {topFind, topMore, topOpen, get more() { return TOP_MORE; }, get hits() { return TOP_HITS; }};', ctx);
  answer = {funders: [{funder_id: 'f-crane', name: 'Crane Family Foundation', place: 'Dalton, MA', group_id: 'g-crane'},
                      {funder_id: 'f-winthrop', name: 'Winthrop Crane Trust', place: 'Boston, MA', group_id: null, relationship: true},
                      {funder_id: 'f-hidden', name: 'Crane Hidden Fund', place: '', group_id: 'g-hidden'}]};
  els.topQ.value = 'crane';
  ctx.T.topFind();
  await new Promise(r => setImmediate(r));
  ok(ctx.T.hits.map(m => m.id).join() === 'g-crane', 'the Library\'s match shows first, as you type');
  ok(asked[0] === '/api/nonprofit/funders/find?q=crane', 'then every funder FundBug knows is searched');
  ok(ctx.T.more.map(f => f.funder_id).join() === 'f-winthrop,f-hidden', 'a funder already shown from the Library is not shown twice');
  ok(/More Funders/.test(els.topHits.innerHTML) && /Boston, MA, not in your Library: a relationship to build/.test(els.topHits.innerHTML),
     'the others say where they are and whether they are in the Library');
  ctx.T.topOpen(1);
  ok(went[0] === 'funder/f-winthrop', 'one with no Library listing opens its page from its record');
  els.topQ.value = 'crane'; ctx.T.topFind(); await new Promise(r => setImmediate(r));
  ctx.T.topOpen(2);
  ok(opened.pop() === 'g-hidden', 'one with a listing opens its listing');
  answer = null; ctx.apiFetch = async () => { throw new Error('offline'); };
  els.topQ.value = 'zzz'; ctx.T.topFind(); await new Promise(r => setImmediate(r));
  ok(/could not be reached/.test(els.topHits.innerHTML), 'a failed search says so, never "no funder by that name"');

  // The page: its own address, no Save, no grantee list, and one in the Library goes to its listing.
  const lp = html.slice(html.indexOf('async function loadListingPage('), html.indexOf('function showListingTab('));
  ok(/\^\(listing\|funder\)\\\/\(\[0-9a-f-\]\{36\}\)/.test(html) && /onFile \? 'funder\/' : 'listing\/'/.test(html),
     'a funder\'s page has its own address, /nonprofit/funder/<id>');
  ok(/if \(onFile && L\.group_id\) \{ LISTING = null; go\('listing\/' \+ L\.group_id, \{replace: true\}\); return; \}/.test(lp),
     'a funder in the Library opens its listing instead');
  ok(/if \(MODE === 'account' && !L\.on_file_only\)/.test(lp), 'no Save on a page from the record (saving needs a listing)');
  ok((html.match(/\(LISTING && LISTING\.onFile \? 'funder\/' : 'listing\/'\)/g) || []).length === 2,
     'its grantees and latest grants come from the funder\'s own routes');
  if (fails) { console.log(fails + ' failed'); process.exit(1); }
  console.log('all passed');
})();
