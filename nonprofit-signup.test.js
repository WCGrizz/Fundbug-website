// The nonprofit signup's choice helpers (Oct 19 2026): the search over Subjects, Who You Serve and What You Need
// Funding For, Suggested For You, Narrow It Down's groups, about 12 broad choices, and Where You Work as the
// service_regions the matcher reads (nationwide included). Runs without a browser:  node nonprofit-signup.test.js
const fs = require('fs');
const vm = require('vm');
// Oct 19 2026: the helpers moved to nonprofit-choices.js, which the signup and the Organization Profile both load.
const html = fs.readFileSync(__dirname + '/nonprofit-signup.html', 'utf8');
const shared = fs.readFileSync(__dirname + '/nonprofit-choices.js', 'utf8');
const a = shared.indexOf('// ── CHOICE HELPERS START'), b = shared.indexOf('// ── CHOICE HELPERS END');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
ok(a >= 0 && b > a, 'the shared file marks its choice helpers');
// Each local script carries a version tag (Oct 19 2026: the browser kept a 4-hour-old nonprofit-drafting.js beside
// the new page and the profile meter stuck on Loading). Change the tag whenever the script changes.
ok([...html.matchAll(/<script src="(\/[^"]+)"/g)].every(m => /\?v=[\w-]+$/.test(m[1])), 'the signup\'s own scripts carry a version tag');
ok(/<script src="\/nonprofit-choices\.js\?v=[\w-]+"><\/script>\s*<script>/.test(html), 'the signup loads the shared helpers before its own script');
ok(!/function (searchTerms|narrowGroups|regionsFor|drawPicker|buildPicker)\b|const CATS\b/.test(html), 'the signup keeps no copy of its own');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(shared.slice(a, b) + '\n;globalThis.__t = {CATS, SHOWN_CATS, BROAD, searchTerms, searchCats, addSuggestions, narrowGroups, regionsFor, regionsProblem, plainDefinition};', ctx);
const t = ctx.__t;

const SUBJECTS = [
  {code: 'SA000000', label: 'Arts and culture', tier: 1, parent: null, definition: ''},
  {code: 'SA030000', label: 'Performing arts', tier: 2, parent: 'SA000000', definition: 'Theater, dance and music.'},
  {code: 'SA030100', label: 'Theater', tier: 2, parent: 'SA000000', definition: ''},
  {code: 'SM000000', label: 'Agriculture, fishing and forestry', tier: 1, parent: null, definition: 'Food production'},
  {code: 'SM030000', label: 'Food security', tier: 2, parent: 'SM000000', definition: ''},
];
const POPS = [
  {code: 'PA010000', label: 'Children and youth', tier: 1, parent: null, definition: ''},
  {code: 'PA010400', label: 'Adolescents', tier: 2, parent: 'PA010000', definition: 'Young people aged 13 to 19'},
  {code: 'PJ070000', label: 'Veterans', tier: 1, parent: null, definition: ''},
  {code: 'PG080000', label: 'Out-of-school youth', tier: 1, parent: null, definition: ''},
  {code: 'PA020300', label: 'Older adults', tier: 2, parent: 'PA020000', definition: 'Seniors'},
];

// Search filters as you type: by the label's words, then (when few) by the definition.
const labels = xs => xs.map(x => x.label);
ok(JSON.stringify(labels(t.searchTerms(SUBJECTS, 'thea'))) === '["Theater","Performing arts"]',
   'typing "thea" finds Theater first, then a term whose definition names theater');
ok(JSON.stringify(labels(t.searchTerms(POPS, 'youth'))) === '["Children and youth","Out-of-school youth"]',
   'typing "youth" finds every label with the word');
ok(JSON.stringify(labels(t.searchTerms(POPS, 'senior'))) === '["Older adults"]', 'a definition finds Older adults for "senior"');
ok(t.searchTerms(SUBJECTS, 'music')[0].label === 'Performing arts', 'a musician searching "music" finds Performing arts first');
ok(t.searchTerms(POPS, 'kids')[0].label === 'Children and youth', 'everyday words find their terms ("kids")');
ok(t.searchTerms(POPS, '').length === 0 && t.searchTerms(POPS, '   ').length === 0, 'an empty search shows nothing (the broad choices stay)');
ok(t.searchTerms(POPS, 'zzz').length === 0, 'a word nothing has finds nothing');
ok(t.searchTerms(POPS.concat(Array.from({length: 60}, (_, i) => ({code: 'X' + i, label: 'Youth group ' + i, tier: 2}))), 'youth').length === 40,
   'never more than 40 at once');
ok(JSON.stringify(t.searchCats('food').map(i => t.CATS[i].label)) === '["Food And Farming"]', 'the plain-language areas are searched too');

// About 12 broad choices by default; the codes stored are the same codes as before.
ok(t.SHOWN_CATS === 12 && t.CATS.length === 18, '12 of the 18 areas show by default; all are under Narrow It Down');
ok(t.BROAD.populations.length >= 10 && t.BROAD.populations.length <= 14 && t.BROAD.funding_purposes.length >= 10 && t.BROAD.funding_purposes.length <= 14,
   'about 12 broad choices for Who You Serve and What You Need Funding For');
ok([...t.BROAD.populations, ...t.BROAD.funding_purposes].every(c => /^[A-Z]{2}\d{6}$/.test(c)), 'every broad choice is a stored code');

// Suggested For You: from a prefill, once each, only what the page offers.
const offered = new Set(['SA000000', 'SM030000']);
ok(JSON.stringify(t.addSuggestions([], [{code: 'SA000000'}, {code: 'ZZ999999'}, {code: 'SA000000'}], offered)) === '["SA000000"]',
   'a suggestion appears once, and never a code the page does not offer');
ok(JSON.stringify(t.addSuggestions(['SA000000'], [{code: 'SM030000', source: 'ntee'}], offered)) === '["SA000000","SM030000"]',
   'the EIN guess joins the website suggestions');
ok(t.addSuggestions([], null, offered).length === 0, 'no prefill, no suggestions');

// Narrow It Down groups the narrower terms under their broad choice.
const sg = t.narrowGroups('subjects', SUBJECTS);
ok(sg.length === 18 && JSON.stringify(sg[0].kids.map(k => k.code)) === '["SA030000","SA030100"]', 'subjects group under their area');
const pg = t.narrowGroups('populations', POPS);
ok(JSON.stringify(pg.find(g => g.code === 'PA010000').kids.map(k => k.code)) === '["PA010400"]', 'Adolescents sits under Children and youth');
ok(pg.some(g => g.code === null && g.kids.some(k => k.code === 'PA020300')), 'a narrower term with no broad parent offered is still listed');
ok(pg.length === 2 && pg[1].kids.some(k => k.code === 'PJ070000') && !pg.some(g => g.code === 'PJ070000'),
   'broad choices with nothing narrower share one box (Veterans), not a box each');

// Where You Work: the service_regions the matcher reads.
const W = (o) => Object.assign({mode: 'county', counties: [], statewide: [], several: [], national: []}, o);
ok(JSON.stringify(t.regionsFor(W({counties: [{state: 'MA', fips: '25003'}]}))) === '[{"type":"county","state":"MA","fips":"25003"}]',
   'My County Or Towns saves counties as before');
ok(JSON.stringify(t.regionsFor(W({mode: 'statewide', statewide: ['MA', 'NY'], counties: [{state: 'MA', fips: '25003'}]}))) ===
   '[{"type":"state","value":"MA"},{"type":"state","value":"NY"}]', 'Statewide saves its states, and only the chosen mode is saved');
ok(JSON.stringify(t.regionsFor(W({mode: 'several', several: ['RI', 'CT']}))) === '[{"type":"state","value":"RI"},{"type":"state","value":"CT"}]',
   'Several States saves each state');
ok(JSON.stringify(t.regionsFor(W({mode: 'national'}))) === '[{"type":"national"}]', 'Nationwide saves {"type": "national"}');
ok(JSON.stringify(t.regionsFor(W({mode: 'national', national: ['NY']}))) === '[{"type":"national"},{"type":"state","value":"NY"}]',
   'Nationwide keeps the states it adds');
ok(t.regionsProblem(W({mode: 'several'})) !== '' && t.regionsProblem(W({mode: 'statewide'})) !== '', 'a state mode with no state is refused');
ok(t.regionsProblem(W({})) === '' && t.regionsProblem(W({mode: 'national'})) === '', 'county and nationwide need nothing more');

ok(t.plainDefinition('People engaged in formal study. ' + 'Can' + 'did uses this term chiefly with others. Also teachers.') ===
   'People engaged in formal study. Also teachers.', 'a definition sentence naming the publisher is left out of tooltips and search');
// The page never names Candid (Will, Oct 19 2026), and the long About Your Organization fits.
ok(!/candid/i.test(html) && !/candid/i.test(shared.replace(/c\[a\]ndid/g, '')), 'no mention of Candid anywhere on the page or in the shared file');
ok(/<textarea id="about"[^>]*maxlength="10000"/.test(html) && html.includes('A few sentences, or as much detail as you like.'),
   'About Your Organization takes 10,000 characters, with its hint');
ok(html.includes('value="individual">Individual (artist, musician, writer)</option>'), 'Individual is a kind of applicant');

// A join link (Oct 19 2026, nonprofit/np_join.py): ?join=<token> prefills an existing login's names and email, keeps
// the email read-only, says so in one line (the email escaped), and sends join_token; a bad link is said plainly and
// the person can still sign up normally.
const ja = html.indexOf('// ── JOIN HELPERS START'), jb = html.indexOf('// ── JOIN HELPERS END');
ok(ja > 0 && jb > ja, 'the signup marks its join helpers');
const jctx = {};
vm.createContext(jctx);
vm.runInContext(html.match(/function escHtml\(s\) \{[^\n]*\}/)[0] + '\n' + html.slice(ja, jb) +
  '\n;globalThis.__j = {joinLine, joinPath, withJoin};', jctx);
const j = jctx.__j;
ok(j.joinLine({email: 'blamb@1berkshire.com', advisor: true}) ===
   'This adds nonprofit matching to your existing FundBug login (blamb@1berkshire.com). Your advisor portal access stays as it is.',
   'the join line, word for word, for an advisor account');
ok(j.joinLine({email: 'a<b>"c@x.org', advisor: true}).includes('(a&lt;b&gt;&quot;c@x.org)') && !j.joinLine({email: '<i>@x.org'}).includes('<i>'),
   'the email in the join line is escaped');
ok(!j.joinLine({email: 'owner@shop.com', advisor: false}).includes('advisor'), 'no advisor sentence for an account that is not an advisor');
ok(j.joinPath('ab.c_d-') === '/api/nonprofit/join/ab.c_d-' && j.joinPath('a/b?c') === '/api/nonprofit/join/a%2Fb%3Fc', 'the join route, the token encoded');
const body = {email: 'x@y.org'};
ok(JSON.stringify(j.withJoin(body, 'tok')) === '{"email":"x@y.org","join_token":"tok"}' && j.withJoin(body, '') === body && !('join_token' in body),
   'the form carries join_token only with a join link');
ok(/const JOIN = params\.get\('join'\) \|\| '';/.test(html) && /if \(JOIN\) await readJoin\(\);/.test(html), 'the page reads ?join= before deciding what to show');
ok(/if \(!OPEN && !params\.get\('code'\) && !JOINED\)/.test(html), 'a good join link shows the form even while signup is closed');
ok(/em\.value = JOINED\.email \|\| ''; em\.readOnly = true;/.test(html) && /note\.innerHTML = joinLine\(JOINED\)/.test(html),
   'the email is prefilled and read-only, with the join line beneath it');
ok(/document\.getElementById\('first'\)\.value = JOINED\.first_name/.test(html) && /document\.getElementById\('last'\)\.value = JOINED\.last_name/.test(html),
   'the names are prefilled');
ok(/catch \(e\) \{ JOINED = null; document\.getElementById\('joinBad'\)\.hidden = false; \}/.test(html) &&
   /id="joinBad"[^>]*hidden><p class="lead">This join link is not valid or has expired/.test(html), 'a bad link is said plainly, and the normal signup goes on');
ok(/JSON\.stringify\(withJoin\(body, JOINED \? JOIN : ''\)\)/.test(html), 'the form is sent with join_token after the card step, so nothing is lost');
ok(/if \(JOINED && !compValid\) \{ err\.textContent = 'A valid code from FundBug is needed/.test(html), 'a join needs a valid code, said before any card is asked for');

// The EIN from the website scan (Oct 19 2026, Will: "if there is any doubt at all, we should make sure they double
// check it"). The page's prefill code runs here against a stand-in page and a stand-in API: nothing fills the EIN
// box without the click, an EIN already typed hides the suggestion, Not Ours clears it, Use This EIN fills the box
// and runs Fill It In From The EIN.
const pa = html.indexOf('// ── PREFILL START'), pb = html.indexOf('// ── PREFILL END');
ok(pa > 0 && pb > pa, 'the signup marks its prefill code');
ok(!/fillEmpty\('ein'/.test(html), 'the scan never fills the EIN box by itself');
ok(/<input id="ein"[^>]*oninput="if \(this\.value\.trim\(\)\) dropEinSuggestion\(\)"/.test(html), 'typing an EIN hides the suggestion');
ok(/<div class="suggest" id="einSuggest" role="status" hidden><\/div>/.test(html) &&
   html.indexOf('id="einSuggest"') > html.indexOf('id="ein"') && html.indexOf('id="einSuggest"') < html.indexOf('id="einNote"'),
   'the suggestion sits under the EIN box');
ok(/if \(ind\) dropEinSuggestion\(\);/.test(html), 'choosing Individual clears a suggestion');
ok(/\.suggest\{[^}]*font-size:15px;color:var\(--ink\)/.test(html), 'the suggestion is 15px, in ink');

function page(over) {
  const els = {};
  const el = id => els[id] || (els[id] = {id, value: '', hidden: false, textContent: '', innerHTML: '', disabled: false});
  const calls = [];
  const replies = Object.assign({
    '/api/nonprofit/scan-website': {proposals: {name: 'Community Health Programs', ein: '999999999'}},
    '/api/nonprofit/prefill/ein': {proposals: {name: 'COMMUNITY HEALTH PROGRAMS INC', zip_code: '01230'}},
  }, over || {});
  const pctx = {
    document: {getElementById: el}, API: '', TERMS: null, picks: {subjects: new Set()}, descSource: '',
    isIndividual: () => el('orgType').value === 'individual', subjectTerm: () => null, applyKind() {},
    fetch: async (url, opts) => { calls.push({url, body: JSON.parse(opts.body)}); return {ok: true, json: async () => replies[url]}; },
  };
  vm.createContext(pctx);
  vm.runInContext(html.match(/function escHtml\(s\) \{[^\n]*\}/)[0] + '\n' + html.slice(pa, pb), pctx);
  el('scanUrl').value = 'chp.org';
  return {ctx: pctx, el, calls};
}
const SITE = {source: 'site', choices: [{ein: '042104397', name: 'COMMUNITY HEALTH PROGRAMS INC', city: 'Great Barrington', state: 'MA'}], note: '', failed: false};
const SEARCH = {source: 'search', note: '', failed: false, choices: [
  {ein: '010000001', name: 'Health Group <b>One</b>', city: 'Pittsfield', state: 'MA'},
  {ein: '010000002', name: 'Health Group Two', city: 'Lee', state: 'MA'},
  {ein: '010000003', name: 'Health Group Three', city: null, state: 'MA'}]};
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  // Nothing fills without the click, even when the site shows an EIN (and the model read one).
  let pg = page({'/api/nonprofit/scan-website': {proposals: {name: 'Community Health Programs', ein: '999999999'}, ein_suggestion: SITE}});
  pg.el('orgType').value = 'nonprofit_501c3';
  await pg.ctx.scanSite(); await tick();
  const box = pg.el('einSuggest');
  ok(pg.el('ein').value === '' && pg.calls.length === 1 && pg.calls[0].url === '/api/nonprofit/scan-website',
     'after the scan the EIN box is still empty and Fill It In From The EIN has not run');
  ok(pg.calls[0].body.org_type === 'nonprofit_501c3', 'the scan sends the kind of applicant');
  ok(!box.hidden && box.innerHTML.startsWith('<p>We found EIN 04-2104397 on your website. The IRS lists it for COMMUNITY HEALTH PROGRAMS INC, Great Barrington, MA. Is this your organization?</p>'),
     'the site\'s EIN is shown with its IRS name and place, as a question');
  ok(box.innerHTML.includes('onclick="useEin(0)">Use This EIN</button>') && box.innerHTML.includes('onclick="dropEinSuggestion()">Not Ours</button>'),
     'Use This EIN and Not Ours');
  ok(pg.el('org').value === 'Community Health Programs' && pg.el('scanNote').textContent.endsWith('We may have found your EIN; check it under the EIN box.'),
     'the scan\'s other results fill as before, and its note points to the EIN');

  // Use This EIN fills the box and runs Fill It In From The EIN.
  pg.ctx.useEin(0); await tick(); await tick();
  ok(pg.el('ein').value === '04-2104397' && box.hidden && box.innerHTML === '', 'Use This EIN puts it in the EIN box and clears the suggestion');
  ok(pg.calls.length === 2 && pg.calls[1].url === '/api/nonprofit/prefill/ein' && pg.calls[1].body.ein === '04-2104397',
     'Use This EIN runs Fill It In From The EIN with that EIN');
  ok(pg.el('zip').value === '01230', 'which fills only the empty boxes it can');

  // Not Ours clears it; nothing fills afterwards.
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: SITE}});
  await pg.ctx.scanSite(); await tick();
  pg.ctx.dropEinSuggestion(); pg.ctx.useEin(0); await tick();
  ok(pg.el('einSuggest').hidden && pg.el('einSuggest').innerHTML === '' && pg.el('ein').value === '' && pg.calls.length === 1,
     'Not Ours clears the suggestion and nothing fills');

  // An EIN already typed hides the suggestion and is never replaced.
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: SITE}});
  pg.el('ein').value = '11-1111111';
  await pg.ctx.scanSite(); await tick();
  ok(pg.el('einSuggest').hidden && pg.el('einSuggest').innerHTML === '', 'with an EIN already typed, the scan shows no suggestion at all');
  pg.ctx.useEin(0); await tick();
  ok(pg.el('einSuggest').hidden && pg.el('ein').value === '11-1111111' && pg.calls.length === 1,
     'an EIN already typed shows no suggestion and is never replaced');
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: SITE}});
  await pg.ctx.scanSite(); await tick();
  pg.el('ein').value = '22-2222222'; pg.ctx.useEin(0); await tick();
  ok(pg.el('ein').value === '22-2222222' && pg.el('einSuggest').hidden && pg.calls.length === 1,
     'an EIN typed while the suggestion shows is kept, and the click only clears it');

  // Search choices: each with name, place and EIN, escaped; None Of These.
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: SEARCH}});
  await pg.ctx.scanSite(); await tick();
  const h = pg.el('einSuggest').innerHTML;
  ok(h.startsWith('<p>Is one of these your organization?</p>') && (h.match(/>Use This EIN</g) || []).length === 3 &&
     h.includes('onclick="dropEinSuggestion()">None Of These</button>'), 'Is one of these your organization? with three choices and None Of These');
  ok(h.includes('<b>Health Group &lt;b&gt;One&lt;/b&gt;</b>, Pittsfield, MA, EIN 01-0000001') && !h.includes('<b>One</b>'),
     'each choice shows name, place and EIN, the name escaped');
  ok(h.includes('<b>Health Group Three</b>, MA, EIN 01-0000003'), 'a choice with no city shows its state');
  pg.ctx.useEin(2); await tick(); await tick();
  ok(pg.el('ein').value === '01-0000003' && pg.calls[1].body.ein === '01-0000003', 'the chosen one, and only it, goes in');

  // A failed lookup says so, offers nothing to click; an individual sees nothing.
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: {source: null, choices: [], failed: true,
    note: 'We could not look up your EIN just now, so nothing is suggested. You can type it in and use Fill It In From The EIN.'}}});
  await pg.ctx.scanSite(); await tick();
  ok(!pg.el('einSuggest').hidden && pg.el('einSuggest').innerHTML.includes('could not look up your EIN just now') &&
     !pg.el('einSuggest').innerHTML.includes('useEin') && !pg.el('scanNote').textContent.includes('EIN'),
     'a failed lookup says the EIN could not be looked up, with nothing to click');
  pg = page({'/api/nonprofit/scan-website': {proposals: {}, ein_suggestion: SITE}});
  pg.el('orgType').value = 'individual';
  await pg.ctx.scanSite(); await tick();
  ok(pg.el('einSuggest').hidden && pg.el('einSuggest').innerHTML === '' && pg.calls[0].body.org_type === 'individual',
     'an individual never sees an EIN suggestion');
  ok(pg.ctx.einSuggestionHtml({source: 'site', choices: [{ein: '<script>', name: 'X'}]}, '', false) === '',
     'a candidate whose EIN is not nine digits is never offered');
  ok(pg.ctx.einSuggestionHtml({source: 'search', choices: [], note: 'A <i>note</i>'}, '', false) === '<p>A &lt;i&gt;note&lt;/i&gt;</p>',
     'the note is escaped');
  process.exit(fails ? 1 : 0);
})();
