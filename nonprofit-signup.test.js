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
process.exit(fails ? 1 : 0);
