// Based In (Nov 27 2026, Will: "you can choose any of the 50 states, and then you select a town"): the ZIP's place
// shown as the geocoder will save it, Change to a state and a town, the picked town sent as home_town, every state's
// counties from its towns, and the county list opening on the home state, not always Massachusetts (the Hildene
// signup). Runs without a browser:  node nonprofit-based-in.test.js
const fs = require('fs');
const vm = require('vm');
const shared = fs.readFileSync(__dirname + '/nonprofit-choices.js', 'utf8');
const signup = fs.readFileSync(__dirname + '/nonprofit-signup.html', 'utf8');
const portal = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)})`));

const VT = [['Bennington', 'Bennington County', '50003'], ['Dorset', 'Bennington County', '50003'],
            ['Manchester', 'Bennington County', '50003'], ['North Bennington', 'Bennington County', '50003'],
            ['Burlington', 'Chittenden County', '50007']];
const OH = [['Akron', 'Summit County', '39153'], ['Union', 'Clermont County', '39025'], ['Union', 'Miami County', '39109']];

// A page stand-in: elements by id, fetch answering the ZIP route and the town files.
const els = {};
const el = id => (els[id] = els[id] || {id, innerHTML: '', value: '', textContent: ''});
const fetched = [];
const ctx = {
  console, release: null, escHtml: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])),
  document: {getElementById: id => (id === 'basedIn' || id in els ? el(id) : null)},
  PLACES: {counties: {VT: [{fips: '50003', name: 'Bennington County'}]}},
  fetch: async url => {
    fetched.push(url);
    const z = url.match(/\/zip\/(\d+)$/), t = url.match(/\/towns\/([A-Z]{2})\.json$/);
    if (z && z[1] === '01299') { await new Promise(r => { ctx.release = r; }); throw new Error('network'); }
    if (z) return {ok: true, json: async () => z[1] === '05255'
      ? {zip: '05255', resolved: true, state: 'VT', city: 'Manchester Center', county: 'Bennington County', county_fips: '50003'}
      : {zip: z[1], resolved: false}};
    if (t) return {ok: !!{VT, OH}[t[1]], json: async () => ({state: t[1], towns: {VT, OH}[t[1]] || []})};
    return {ok: false, json: async () => ({})};
  },
};
vm.createContext(ctx);
vm.runInContext(shared + '\n;globalThis.__t = {townMatches, townLabel, townFromLabel, countiesFromTowns, basedInText, ' +
  'initBasedIn, zipChanged, openBasedIn, basedStatePicked, basedTownTyped, countiesFor, setBasedFound, B: () => BASED};', ctx);
const t = ctx.__t;
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  // The pure helpers.
  eq(t.townMatches(VT, 'benn').map(x => x[0]), ['Bennington', 'North Bennington'], 'towns that start with it first, then those that contain it');
  eq(t.townMatches(VT, ''), [], 'nothing typed, nothing offered');
  eq(t.townFromLabel(OH, 'union, miami county'), ['Union', 'Miami County', '39109'], 'a town name shared by counties is told apart by its county');
  eq(t.countiesFromTowns(VT), [{fips: '50003', name: 'Bennington County'}, {fips: '50007', name: 'Chittenden County'}], "a state's counties from its towns");
  eq(t.basedInText({state: 'VT', city: 'Manchester Center', county: 'Bennington County'}, c => ({VT: 'Vermont'})[c]),
     'Manchester Center, Vermont (Bennington County)', 'Based In reads town, state (county)');

  // The ZIP places the organization, and the county list follows its state.
  const placed = [];
  t.initBasedIn({api: 'https://api', box: 'basedIn', states: [['MA', 'Massachusetts'], ['VT', 'Vermont'], ['OH', 'Ohio']],
                 onPlace: st => placed.push(st)});
  await t.zipChanged('05255'); await tick();
  ok(/Based In:<\/strong> Manchester Center, Vermont \(Bennington County\)/.test(el('basedIn').innerHTML) && /Change/.test(el('basedIn').innerHTML),
     'a Vermont ZIP shows Based In: Manchester Center, Vermont (Bennington County), with Change');
  eq(placed, ['VT'], 'and tells the page its state (the county list opens on Vermont)');
  ok(fetched.includes('https://api/api/nonprofit/zip/05255'), 'from the ZIP route the geocoder shares');

  // Change: a state, then a town; the picked town is what the page sends.
  t.openBasedIn(); await tick();
  ok(/id="biState"/.test(el('basedIn').innerHTML) && /<option value="VT" selected>/.test(el('basedIn').innerHTML), 'Change opens on the same state');
  el('biState').value = 'VT'; el('biTowns'); el('biNote');
  await t.basedTownTyped('Dor');
  ok(/Dorset, Bennington County/.test(el('biTowns').innerHTML), 'typing offers matching towns with their county');
  await t.basedTownTyped('Dorset, Bennington County');
  eq(t.B().picked, {state: 'VT', city: 'Dorset', county: 'Bennington County', county_fips: '50003'}, 'picking one sets the town to send');
  ok(/Dorset, Vermont \(Bennington County\), as you chose/.test(el('basedIn').innerHTML), 'and Based In says it was chosen');
  await t.basedTownTyped('Nowhere'); await t.basedTownTyped('Nowhere', true);
  eq(t.B().picked.city, 'Dorset', 'typing something not on the list picks nothing');

  // A new ZIP starts over; one that cannot be placed offers Choose Your Town.
  await t.zipChanged('00000'); await tick();
  ok(t.B().picked === null && /Choose Your Town/.test(el('basedIn').innerHTML), 'an unplaceable ZIP offers Choose Your Town and drops the old pick');

  // Every state gets counties: its own list, or one from its towns.
  eq((await t.countiesFor('VT')).map(c => c.fips), ['50003'], "a state's own county list is used when there is one");
  eq((await t.countiesFor('OH')).map(c => c.name), ['Clermont County', 'Miami County', 'Summit County'], 'Ohio, with no list of its own, gets one from its towns');

  // A slow or failed older lookup never shows over a newer ZIP, and a shortened ZIP never leaves "Finding" up.
  const slow = t.zipChanged('01299'); await tick();
  ok(/Finding your ZIP code/.test(el('basedIn').innerHTML), 'a lookup in flight says Finding your ZIP code');
  await t.zipChanged('0129');
  ok(!/Finding/.test(el('basedIn').innerHTML), 'deleting a digit takes Finding away');
  await t.zipChanged('05255'); await tick();
  ctx.release(); await slow; await tick();
  ok(/Manchester Center/.test(el('basedIn').innerHTML) && t.B().found && t.B().found.state === 'VT', 'the older lookup failing later leaves the newer ZIP\'s place');

  // Town-built counties are kept where the page names counties (the "Serving:" summary).
  await t.countiesFor('OH');
  eq((ctx.PLACES.counties.OH || []).length, 3, "Ohio's counties from its towns are kept on PLACES.counties");
  const before = fetched.filter(u => /towns\/OH/.test(u)).length;
  await Promise.all([t.countiesFor('OH'), t.basedTownTyped('A')]);
  eq(fetched.filter(u => /towns\/OH/.test(u)).length, before, 'a state\'s town list is fetched once');

  // The pages: the ZIP drives Based In, the picked town is sent, the county list is no longer fixed on Massachusetts.
  ok(/id="zip"[^>]*oninput="zipChanged\(this.value\)"/.test(signup) && /home_town: BASED.picked/.test(signup), 'the signup looks the ZIP up and sends the picked town');
  ok(/onPlace: st =>[\s\S]{0,200}areaState/.test(signup) && /countiesFor\(st\)/.test(signup), "the signup's county list follows the ZIP's state, for any state");
  ok((signup.match(/fillEmpty\('zip', p.zip_code\)\) \{[^}]*zipChanged/g) || []).length === 2, 'a ZIP filled from the website or the EIN is looked up too');
  ok(/id="fZip"[^>]*oninput="zipChanged\(this.value\)"/.test(portal) && /changes.home_town = BASED.picked/.test(portal), 'the Organization Profile looks the ZIP up and saves the picked town');
  ok(/setBasedFound\(\{state: sub.state, city: sub.city/.test(portal) && /countiesFor\(st\)/.test(portal), 'an account shows where it is saved as being, and gets counties for any state');
  ok(/sel.value !== st && PLACES.states.some\(\(\[c\]\) => c === st\)/.test(signup) && /sel.value !== st && PLACES.states.some\(\(\[c\]\) => c === st\)/.test(portal),
     'a ZIP in a place not on the state list (DC, a military ZIP) never blanks the county list');
  ok(signup.includes('nonprofit-choices.js?v=2026-11-27') && portal.includes('nonprofit-choices.js?v=2026-11-27'),
     'both pages ask for the new shared script, not a cached old one');
  process.exit(fails ? 1 : 0);
})();
