// The Funding Map on the Funding Landscape page (Nov 18 2026; backend nonprofit/np_funding_map). Run: node nonprofit-funding-map.test.js
const fs = require('fs'), vm = require('vm');
const js = fs.readFileSync(__dirname + '/nonprofit-landscape.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = js.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/const FMAP_COLORS = .*/), grab(/function fmapMiles\([\s\S]*?\n\}/), grab(/function fmapTowns\([\s\S]*?\n\}/),
  grab(/function fmapBreaks\([\s\S]*?\n\}/), grab(/function fmapShade\([\s\S]*?\n\}/), grab(/function fmapValue\(.*/),
  'globalThis.T = {fmapMiles, fmapTowns, fmapBreaks, fmapShade, fmapValue, FMAP_COLORS};'].join('\n'), ctx);
const T = ctx.T;
const pitt = {fips: 'p', lat: 42.45, lon: -73.25}, lenox = {fips: 'l', lat: 42.36, lon: -73.28}, spring = {fips: 's', lat: 42.10, lon: -72.59};
ok(Math.abs(T.fmapMiles(pitt, spring) - 41) < 3, 'miles between towns (Pittsfield to Springfield about 41)');
const M = {home_town: 'p', towns: [pitt, lenox, spring]};
ok(T.fmapTowns(M, '').length === 3 && T.fmapTowns(M, '10').map(t => t.fips).join() === 'p,l', 'a distance keeps only the towns within it');
ok(T.fmapTowns({home_town: null, towns: [pitt, spring]}, '10').length === 2, 'no home town: every town');
const br = T.fmapBreaks([0, 62367, 197533, 647678, 3188871, 42511538]);
ok(br.every(x => String(x).replace(/0+$/, '').length <= 2), 'legend breaks are rounded to two figures: ' + br.join(', '));
ok(T.fmapShade(0, br) === '#f0ede6' && T.fmapShade(1e9, br) === T.FMAP_COLORS[T.FMAP_COLORS.length - 1], 'none is the palest, the most the darkest');
ok(T.fmapValue({dollars: 9, by_subject: {A: 4}}, 'A') === 4 && T.fmapValue({dollars: 9}, '') === 9 && T.fmapValue({dollars: 9}, 'B') === 0, 'a subject shades by its dollars');
ok(js.includes("'/api/nonprofit/landscape/map?view=' + LAND_VIEW") && js.includes('/api/nonprofit/preview/landscape/map?'), 'it asks the backend for the account, and for the preview');
ok(js.includes("no funder or person is placed on the map") && !/based_in|address/.test(grab(/function drawFundingMap\(\) \{[\s\S]*?\n\}/)), 'it never places a funder: no address, no based-in');
ok(js.includes('if (LMAP_LOADING) return;'), 'one load at a time');
ok(js.includes('drawFundingMap();\n}') && js.includes('<div class="card fmap-card"><h2>Funding Map</h2>'), 'the Landscape page carries the map card');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
