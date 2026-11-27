// The nonprofit choice helpers and pickers, shared by nonprofit-signup.html and nonprofit-portal.html (Oct 19 2026,
// Will: the Organization Profile's pickers work like the new signup's). Each page loads this before its own script.
// The helpers between the markers keep no page state and run in node (nonprofit-signup.test.js,
// nonprofit-portal.test.js); the pickers below them use the page's TERMS, picks and escHtml.
// ── CHOICE HELPERS START (no page state; nonprofit-signup.test.js and nonprofit-portal.test.js run them in node) ──
// Subjects in plain words (Oct 16 2026; Will, Oct 8: a plain-language picker in our own wording, each category
// standing for subject codes, with the IRS record's subject as a first guess). The first SHOWN_CATS are shown
// by default (Will, Oct 19: about 12 broad choices); every one is under Narrow It Down and in the search.
const CATS = [
  {label: 'Arts And Culture', codes: ['SA000000']},
  {label: 'Education', codes: ['SB000000']},
  {label: 'Youth And Families', codes: ['SS050000', 'SS040000', 'SB100000']},
  {label: 'Human Services And Basic Needs', codes: ['SS000000']},
  {label: 'Health And Mental Health', codes: ['SE000000']},
  {label: 'Housing', codes: ['SN040000', 'SS070000']},
  {label: 'Food And Farming', codes: ['SM000000']},
  {label: 'Environment And Animals', codes: ['SC000000']},
  {label: 'Community And Economic Development', codes: ['SN000000']},
  {label: 'Civic Life, Rights And Justice', codes: ['SR000000', 'SK000000', 'SJ040000']},
  {label: 'Public Safety And Disaster Relief', codes: ['SJ000000']},
  {label: 'Sports And Recreation', codes: ['SQ000000']},
  {label: 'Media, News And Libraries', codes: ['SH000000']},
  {label: 'Science And Technology', codes: ['SF000000']},
  {label: 'Religion', codes: ['SP000000']},
  {label: 'International', codes: ['ST000000']},
  {label: 'Philanthropy And Nonprofit Support', codes: ['SD000000']},
  {label: 'Social Sciences', codes: ['SG000000']},
];
const SHOWN_CATS = 12;
// The broad choices shown by default for the other two (the same codes as always; the rest behind Narrow It Down).
const BROAD = {
  populations: ['PA010000', 'PA020300', 'PD010000', 'PG030000', 'PH010000', 'PC040000', 'PG010000', 'PE030000',
                'PE050000', 'PC010000', 'PJ070000', 'PG090000', 'PJ100000'],
  funding_purposes: ['UA000000', 'UN000000', 'UD000000', 'UF000000', 'UF020000', 'UD020000', 'UE000000', 'UH000000',
                     'UP000000', 'UM000000', 'UK000000', 'UR000000'],
};
function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim().split(' ').filter(Boolean); }
function labelMatches(label, query) {
  const q = words(query), w = words(label), whole = String(query || '').trim().toLowerCase();
  if (!q.length) return false;
  return q.every(x => w.some(y => y.startsWith(x))) || String(label || '').toLowerCase().includes(whole);
}
// Everyday words for terms whose labels use others (a musician searching "music" finds Performing arts).
const ALSO = {music: 'performing arts', musician: 'performing arts', dance: 'performing arts', theatre: 'theater',
              theater: 'performing arts', writer: 'humanities', writing: 'humanities', poetry: 'humanities',
              literature: 'humanities', books: 'humanities', painting: 'visual arts', sculpture: 'visual arts',
              photography: 'visual arts', film: 'communication media', kids: 'children', seniors: 'older adults',
              elderly: 'older adults', aging: 'older adults', hunger: 'food security', homelessness: 'homeless'};
function alsoFor(query) {
  const out = [];
  for (const x of words(query).filter(w => w.length >= 3))
    for (const k of Object.keys(ALSO)) if ((k.startsWith(x) || x.startsWith(k)) && !out.includes(ALSO[k])) out.push(ALSO[k]);
  return out;
}
// What the search shows: labels that match first (those starting with the words first), then labels for the
// everyday words above, then, when few match, terms whose definition does. Never more than limit.
function searchTerms(terms, query, limit = 40) {
  const whole = String(query || '').trim().toLowerCase();
  if (!whole) return [];
  const hits = terms.filter(t => labelMatches(t.label, whole));
  const rank = t => t.label.toLowerCase().startsWith(whole) ? 0 : 1;
  hits.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  const also = alsoFor(whole);
  const alike = terms.filter(t => !hits.includes(t) && also.some(a => labelMatches(t.label, a)));
  const found = hits.concat(alike);
  const more = found.length >= 5 ? [] : terms.filter(t => !found.includes(t) && labelMatches(plainDefinition(t.definition), whole));
  return found.concat(more).slice(0, limit);
}
// A term's definition without any sentence naming the taxonomy's publisher (Will, Oct 19 2026: no mention of it on
// this page; one definition says how the publisher uses the term).
function plainDefinition(d) { return String(d || '').split(/(?<=[.!?])\s+/).filter(x => !/c[a]ndid/i.test(x)).join(' '); }
function searchCats(query) { return CATS.map((c, i) => i).filter(i => labelMatches(CATS[i].label, query)); }
// Suggested For You: codes a prefill proposed, once each, in the order they came, only codes the page offers.
function addSuggestions(current, items, offered) {
  const out = current.slice();
  for (const x of items || []) {
    const code = x && typeof x === 'object' ? x.code : x;
    if (code && offered.has(code) && !out.includes(code)) out.push(code);
  }
  return out;
}
// Narrow It Down: each broad choice with the narrower terms inside it.
function narrowGroups(field, terms) {
  if (field === 'subjects')
    return CATS.map((c, i) => ({cat: i, label: c.label, kids: terms.filter(t => t.tier === 2 && (c.codes.includes(t.parent) || c.codes.includes(t.code)))}));
  const tops = terms.filter(t => t.tier === 1), topCodes = new Set(tops.map(t => t.code));
  const all = tops.map(t => ({code: t.code, label: t.label, kids: terms.filter(k => k.tier === 2 && k.parent === t.code)}));
  // A broad choice with nothing narrower inside it goes in one box at the end, not a box of its own.
  const groups = all.filter(g => g.kids.length), alone = all.filter(g => !g.kids.length);
  const loose = terms.filter(k => k.tier === 2 && !topCodes.has(k.parent));
  const rest = alone.map(g => tops.find(t => t.code === g.code)).concat(loose);
  if (rest.length) groups.push({code: null, label: 'More Choices', kids: rest});
  return groups;
}
// Where You Work as the service_regions the matcher reads (nonprofit/np_match.places): counties, states, and
// {"type": "national"} for Nationwide (national programs, plus the home state's and the states added).
function regionsFor(w) {
  if (w.mode === 'county') return w.counties.map(c => ({type: 'county', state: c.state, fips: c.fips}));
  if (w.mode === 'statewide') return w.statewide.map(s => ({type: 'state', value: s}));
  if (w.mode === 'several') return w.several.map(s => ({type: 'state', value: s}));
  if (w.mode === 'national') return [{type: 'national'}].concat(w.national.map(s => ({type: 'state', value: s})));
  return [];
}
function regionsProblem(w) {
  if ((w.mode === 'statewide' && !w.statewide.length) || (w.mode === 'several' && !w.several.length))
    return 'Pick at least one state you work in, or choose another option under Where You Work.';
  return '';
}
// One service region in words, for the profile's summary line ({"type": "national"} is Nationwide; Oct 19 2026: it
// read "undefined, undefined"). countyName(fips) names a county, stateName(code) a state.
function regionLabel(r, countyName, stateName) {
  if (!r || typeof r !== 'object') return '';
  if (r.type === 'national') return 'Nationwide';
  if (r.type === 'state') return 'All of ' + (stateName ? stateName(r.value) : r.value);
  if (r.type === 'county') return (countyName ? countyName(r.fips) : r.fips) + ', ' + r.state;
  return '';
}
// Where You Work from stored service_regions, for a page that shows them again (the Organization Profile): the mode
// the regions fit, and every entry kept. Counties mixed with whole states (the old profile allowed both) open as My
// County Or Towns with the states kept as extra whole states, so a save never drops one.
function whereFrom(regions) {
  const rs = (Array.isArray(regions) ? regions : []).filter(r => r && typeof r === 'object');
  const counties = rs.filter(r => r.type === 'county' && r.fips).map(r => ({state: r.state, fips: r.fips}));
  const states = rs.filter(r => r.type === 'state' && r.value).map(r => r.value);
  const w = {mode: 'county', counties, statewide: [], several: [], national: [], extraStates: []};
  if (rs.some(r => r.type === 'national')) { w.mode = 'national'; w.national = states; w.extraCounties = counties; }
  else if (counties.length) w.extraStates = states;
  else if (states.length > 1) { w.mode = 'several'; w.several = states; }
  else if (states.length === 1) { w.mode = 'statewide'; w.statewide = states; }
  return w;
}
// whereFrom's opposite: regionsFor plus what the mode keeps beside its own choices (extra whole states in county
// mode, counties a nationwide organization had).
function regionsForProfile(w) {
  const out = regionsFor(w);
  if (w.mode === 'county') (w.extraStates || []).forEach(s => out.push({type: 'state', value: s}));
  if (w.mode === 'national') (w.extraCounties || []).forEach(c => out.push({type: 'county', state: c.state, fips: c.fips}));
  return out;
}
// Based In (Nov 27 2026, Will: "you can choose any of the 50 states, and then you select a town"). A town list is
// [[town, county, county FIPS], ...] from /towns/<ST>.json (nonprofit/np_town_files.py).
// The towns that start with what was typed first, then those that contain it; at most n.
function townMatches(towns, q, n) {
  const want = String(q || '').trim().toLowerCase();
  if (!want) return [];
  const starts = [], has = [];
  for (const t of towns || []) {
    const name = String(t[0]).toLowerCase();
    if (name.startsWith(want)) starts.push(t); else if (name.includes(want)) has.push(t);
    if (starts.length >= (n || 12)) break;
  }
  return starts.concat(has).slice(0, n || 12);
}
// What the town box shows for a town, and back: "Bennington, Bennington County".
function townLabel(t) { return `${t[0]}, ${t[1]}`; }
function townFromLabel(towns, label) {
  const want = String(label || '').trim().toLowerCase();
  return (towns || []).find(t => townLabel(t).toLowerCase() === want) || null;
}
// A state's counties from its towns, for a state with no county list of its own: [{fips, name}] by name.
function countiesFromTowns(towns) {
  const seen = new Map();
  for (const t of towns || []) if (t[2] && !seen.has(t[2])) seen.set(t[2], {fips: t[2], name: t[1]});
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
// "Manchester Center, Vermont (Bennington County)"
function basedInText(place, nameOf) {
  if (!place || !place.state) return '';
  const town = place.city ? place.city + ', ' : '';
  return `${town}${nameOf ? nameOf(place.state) : place.state}${place.county ? ' (' + place.county + ')' : ''}`;
}
// ── CHOICE HELPERS END ──

// ── THE PICKERS (Oct 19 2026): Subjects, Who You Serve and What You Need Funding For, a search, Suggested For You,
// the broad choices, and the narrower ones behind Narrow It Down; the same codes stored. The page supplies TERMS
// (/api/nonprofit/terms), picks ({field: Set of codes}), escHtml, a box <div id="pk-FIELD">, and may define
// onPicksChanged(field), called after every change the person makes. suggested and narrowOpen live here.
let suggested = {subjects: [], populations: [], funding_purposes: []}, narrowOpen = {};
const SEARCH_HINT = {subjects: 'Search, for example theater or food', populations: 'Search, for example veterans or seniors',
                     funding_purposes: 'Search, for example equipment or staff'};
const FIELD_TITLE = {subjects: 'Subjects', populations: 'Who You Serve', funding_purposes: 'What You Need Funding For'};
function termsOf(field) { return (TERMS && TERMS[field]) || []; }
function termOf(field, code) { return termsOf(field).find(t => t.code === code); }
function subjectTerm(code) { return termOf('subjects', code); }
function inCat(code, cat) {
  if (cat.codes.includes(code)) return true;
  const t = subjectTerm(code);
  // A subject another category names itself belongs there only (youth services light Youth And Families, not Human Services).
  return !!(t && cat.codes.includes(t.parent) && !CATS.some(o => o !== cat && o.codes.includes(code)));
}
function catOn(cat) { return [...picks.subjects].some(c => inCat(c, cat)); }
function picksChanged(field) { drawPicker(field); if (typeof onPicksChanged === 'function') onPicksChanged(field); }
function togglePick(field, code) {
  const set = picks[field];
  set.has(code) ? set.delete(code) : set.add(code);
  picksChanged(field);
}
function toggleCat(i) {
  const cat = CATS[i];
  if (catOn(cat)) [...picks.subjects].forEach(c => { if (inCat(c, cat)) picks.subjects.delete(c); });
  else cat.codes.forEach(c => picks.subjects.add(c));
  picksChanged('subjects');
}
function pill(field, t, cls = '', label = '') {
  return `<button type="button" class="pill ${cls}" data-code="${t.code}" aria-pressed="${picks[field].has(t.code)}" title="${escHtml(plainDefinition(t.definition))}">${escHtml(label || t.label)}</button>`;
}
function catPill(i, label = '') { return `<button type="button" class="pill cat" data-cat="${i}" aria-pressed="${catOn(CATS[i])}">${escHtml(label || CATS[i].label)}</button>`; }
// A group's heading in Narrow It Down, in Title Case (Will, Oct 20 2026: "the categories should be labelled"; a
// heading that looked like one more choice did not read as a label). Capitals already in a word are kept (LGBTQIA+).
// Named for this file (Oct 22 2026): the portal page has its own titleCase, and two scripts declaring one name stop
// the page's whole script (the nonprofit portal was blank from Oct 20).
function choiceTitle(s) { return String(s || '').replace(/(^|[\s\/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
// One Narrow It Down group: its heading, then "All Of <the area>" (the broad choice itself), then the narrower ones.
function groupHtml(field, g) {
  const head = choiceTitle(g.label);
  const broad = g.cat !== undefined ? catPill(g.cat, 'All Of ' + head) : g.code ? pill(field, termOf(field, g.code), 'cat', 'All Of ' + head) : '';
  return `<div class="group"><p class="group-label">${escHtml(head)}</p><div class="pills">${broad}${g.kids.map(t => pill(field, t)).join('')}</div></div>`;
}
function buildPicker(field) {
  const box = document.getElementById('pk-' + field);
  box.innerHTML = `<input type="search" class="search" id="q-${field}" placeholder="${SEARCH_HINT[field]}" aria-label="Search ${FIELD_TITLE[field]}" autocomplete="off">
    <div id="sg-${field}" hidden></div><div id="rs-${field}" hidden></div><div id="bd-${field}"></div>
    <button type="button" class="linkbtn" data-narrow="1" id="nb-${field}" aria-expanded="false">Narrow It Down</button>
    <div id="fl-${field}" hidden></div><p class="picked" id="pp-${field}"></p>`;
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cat !== undefined) toggleCat(+b.dataset.cat);
    else if (b.dataset.code) togglePick(field, b.dataset.code);
    else if (b.dataset.narrow) { narrowOpen[field] = !narrowOpen[field]; drawPicker(field); }
  });
  const q = document.getElementById('q-' + field);
  q.addEventListener('input', () => drawPicker(field));
  q.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
}
function drawPicker(field) {
  if (!TERMS) return;
  const terms = termsOf(field), q = document.getElementById('q-' + field).value.trim();
  const sg = document.getElementById('sg-' + field), rs = document.getElementById('rs-' + field), bd = document.getElementById('bd-' + field);
  const nb = document.getElementById('nb-' + field), fl = document.getElementById('fl-' + field);
  const subj = field === 'subjects';
  sg.hidden = rs.hidden = bd.hidden = nb.hidden = fl.hidden = true;
  if (q) {
    const cats = subj ? searchCats(q) : [], found = searchTerms(terms, q);
    rs.innerHTML = (cats.length || found.length)
      ? `<div class="pills">${cats.map(catPill).join('')}${found.map(t => pill(field, t)).join('')}</div>`
      : `<p class="lead">Nothing matches "${escHtml(q)}". Try a shorter or broader word.</p>`;
    rs.hidden = false;
  } else {
    const sug = suggested[field].map(c => termOf(field, c)).filter(Boolean);
    sg.innerHTML = sug.length ? `<p class="sub">Suggested For You</p><div class="pills">${sug.map(t => pill(field, t)).join('')}</div><p class="sub">Main Choices</p>` : '';
    sg.hidden = !sug.length;
    bd.innerHTML = `<div class="pills">${subj ? CATS.slice(0, SHOWN_CATS).map((c, i) => catPill(i)).join('')
      : BROAD[field].map(c => termOf(field, c)).filter(Boolean).map(t => pill(field, t, 'cat')).join('')}</div>`;
    bd.hidden = false;
    nb.hidden = false;
    nb.textContent = narrowOpen[field] ? 'Hide The Narrower Choices' : 'Narrow It Down';
    nb.setAttribute('aria-expanded', narrowOpen[field] ? 'true' : 'false');
    if (narrowOpen[field]) {
      fl.innerHTML = narrowGroups(field, terms).map(g => groupHtml(field, g)).join('');
      fl.hidden = false;
    }
  }
  const chosen = [...picks[field]].map(c => termOf(field, c)).filter(Boolean);
  document.getElementById('pp-' + field).innerHTML = chosen.length
    ? `<b>You Picked:</b> ${chosen.map(t => escHtml(t.label)).join(', ')}` : '';
}

// ── BASED IN (Nov 27 2026): where the ZIP places the organization, as the geocoder will save it
// (GET /api/nonprofit/zip/<zip>), with Change: a state, then a town from /towns/<ST>.json. A town picked there is
// BASED.picked, which the page sends as home_town; the server writes it after the ZIP's geocode, so it stands.
// The page calls initBasedIn({api, box, states, onPlace}) once, and zipChanged(zip) when its ZIP box changes.
let BASED = {found: null, picked: null, open: false, zip: '', looking: false, cfg: null};
const TOWN_LISTS = {};                                   // state -> its town list, or the fetch in flight
async function townsFor(st) {
  if (!st) return [];
  if (!TOWN_LISTS[st]) {
    // The fetch itself is kept, so keystrokes share one request; a failed one is forgotten, to be tried again.
    TOWN_LISTS[st] = fetch('/towns/' + st + '.json').then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
      .then(d => d.towns || []).catch(() => { delete TOWN_LISTS[st]; return []; });
  }
  return TOWN_LISTS[st];
}
function basedInPlace() { return BASED.picked || BASED.found; }
function basedStateName(code) { const s = (BASED.cfg && BASED.cfg.states || []).find(([c]) => c === code); return s ? s[1] : code; }
function initBasedIn(cfg) { BASED.cfg = cfg; drawBasedIn(); }
function setBasedFound(place) { BASED.found = place && place.state ? place : null; drawBasedIn(); }
async function zipChanged(zip) {
  const z = String(zip || '').replace(/[^0-9]/g, '').slice(0, 5);
  if (z === BASED.zip) return;
  BASED.zip = z; BASED.picked = null; BASED.open = false;
  if (z.length !== 5) { BASED.found = null; BASED.looking = false; drawBasedIn(); return; }
  BASED.looking = true; drawBasedIn();
  let found = null;
  try {
    const r = await fetch(BASED.cfg.api + '/api/nonprofit/zip/' + z);
    const d = r.ok ? await r.json() : {};
    found = d.resolved ? {state: d.state, city: d.city, county: d.county, county_fips: d.county_fips} : null;
  } catch (e) { found = null; }
  if (z !== BASED.zip) return;                           // a newer ZIP was typed meanwhile: its own lookup answers
  BASED.found = found; BASED.looking = false; drawBasedIn();
  if (BASED.found && BASED.cfg.onPlace) BASED.cfg.onPlace(BASED.found.state);
}
function openBasedIn() { BASED.open = true; drawBasedIn(); }
function closeBasedIn() { BASED.open = false; drawBasedIn(); }
async function drawBasedIn() {
  const box = BASED.cfg && document.getElementById(BASED.cfg.box);
  if (!box) return;
  const place = basedInPlace();
  if (BASED.open) {
    const st = (place && place.state) || '';
    box.innerHTML = '<p class="based-line"><strong>Based In:</strong> choose your state, then your town.</p>'
      + `<div class="row"><div><label for="biState">State</label><select id="biState" onchange="basedStatePicked(this.value)">`
      + '<option value="">Choose a state</option>'
      + BASED.cfg.states.map(([c, n]) => `<option value="${c}" ${c === st ? 'selected' : ''}>${escHtml(n)}</option>`).join('')
      + `</select></div><div><label for="biTown">Town</label><input id="biTown" list="biTowns" autocomplete="off" `
      + `placeholder="Start typing your town" oninput="basedTownTyped(this.value)" onchange="basedTownTyped(this.value, true)">`
      + `<datalist id="biTowns"></datalist></div></div>`
      + `<p class="note based-note" id="biNote">Type your town, then pick it from the list.</p>`
      + `<div class="based-cancel"><button type="button" class="linkbtn" onclick="closeBasedIn()">Cancel</button></div>`;
    if (st) townsFor(st);
    return;
  }
  if (BASED.looking) { box.innerHTML = '<p class="based-line">Finding your ZIP code\u2026</p>'; return; }
  if (place) {
    box.innerHTML = `<p class="based-line"><strong>Based In:</strong> ${escHtml(basedInText(place, basedStateName))}`
      + `${BASED.picked ? ', as you chose' : ''} <button type="button" class="linkbtn" onclick="openBasedIn()">Change</button></p>`;
    return;
  }
  box.innerHTML = BASED.zip.length === 5
    ? '<p class="based-line">We could not place that ZIP code. <button type="button" class="linkbtn" onclick="openBasedIn()">Choose Your Town</button></p>'
    : '';
}
async function basedStatePicked(st) {
  const input = document.getElementById('biTown');
  if (input) input.value = '';
  await townsFor(st);
  const note = document.getElementById('biNote');
  if (note) note.textContent = st && !(TOWN_LISTS[st] || []).length ? 'No town list for this state yet.' : 'Type your town, then pick it from the list.';
}
async function basedTownTyped(text, done) {
  const st = (document.getElementById('biState') || {}).value;
  const towns = await townsFor(st);
  const hit = townFromLabel(towns, text);
  if (hit) {
    BASED.picked = {state: st, city: hit[0], county: hit[1], county_fips: hit[2]};
    BASED.open = false; drawBasedIn();
    if (BASED.cfg.onPlace) BASED.cfg.onPlace(st);
    if (BASED.cfg.onPick) BASED.cfg.onPick(BASED.picked);
    return;
  }
  const list = document.getElementById('biTowns');
  if (list) list.innerHTML = townMatches(towns, text, 40).map(t => `<option value="${escHtml(townLabel(t))}"></option>`).join('');
  const note = document.getElementById('biNote');
  if (note && done && text.trim()) note.textContent = 'Pick your town from the list, so we have its county.';
}
// A state's counties for the County Or Towns picker: its own list, or one made from its towns.
// Kept on PLACES.counties, so the page names them as it names the others (the "Serving:" summary).
async function countiesFor(st) {
  const has = typeof PLACES !== 'undefined' && PLACES && PLACES.counties;
  const own = (has && PLACES.counties[st]) || [];
  if (own.length) return own;
  const made = countiesFromTowns(await townsFor(st));
  if (has && made.length) PLACES.counties[st] = made;
  return made;
}
