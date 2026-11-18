// The Funding Landscape page of the nonprofit portal (Oct 16 2026): who funds the organizations of the account's
// county, from foundations' and grantmaking charities' IRS filings, built ahead by the backend's
// nonprofit/np_landscape.py (no model call). nonprofit-portal.html and the advisor portal (np-side.js) load it and
// supply apiFetch, escHtml, money, MODE, showPage and openListing, and nothing else (nonprofit-landscape-host.test.js).

let LAND = null, LAND_VIEW = 'community', LAND_SUBJECT = '', LAND_SHOWN = 25;
let LMAP = null, LMAP_VIEW = '', LMAP_RADIUS = '', LMAP_TOWN = '', LMAP_ERR = '', LMAP_LOADING = false;

async function openLandscape() {
  showPage('landscape');
  if (!LAND) await loadLandscape();
}
async function loadLandscape() {
  const box = document.getElementById('lBody');
  box.innerHTML = '<div class="empty">Loading…</div>';
  try {
    LAND = MODE === 'account'
      ? await apiFetch('/api/nonprofit/landscape?view=' + LAND_VIEW)
      : await apiFetch('/api/nonprofit/preview/landscape?state=MA&county=25003&view=' + LAND_VIEW);
  } catch (e) {
    LAND = null;
    box.innerHTML = `<div class="empty">${escHtml(e.status === 404 ? e.message : 'Could not load the landscape: ' + e.message)}</div>`;
    return;
  }
  LAND_SHOWN = 25;
  drawLandscape();
}
function setLandView(v) { if (v === LAND_VIEW) return; LAND_VIEW = v; LAND = null; loadLandscape(); }
function setLandSubject(code) { LAND_SUBJECT = code; LAND_SHOWN = 25; drawLandscape(); }
function pct(n, d) { return d ? Math.round(100 * n / d) + '%' : ''; }
// A funder whose open programs do not cover the county (Oct 20 2026): the backend's elsewhere_note (np_landscape
// .elsewhere_note), shown as a badge under its name like "Does not accept unsolicited applications".
// The funder's name to show (Oct 19 2026): the backend's display_name (its Funder listing's title, else the filed
// name cleaned: nonprofit/np_landscape.display_name), the filed name for a file built before it.
function landName(f) { return f.display_name || f.name || ''; }
// A funder's Giving Change (Oct 28 2026; moved here from nonprofit-portal.html Nov 10 2026, so the advisor portal, which
// loads this file without that page, has them too).
const changeWords = g => `${g.pct > 0 ? 'Up' : g.pct < 0 ? 'Down' : 'About the same as'} ${g.pct ? Math.abs(g.pct).toLocaleString('en-US') + '% from ' : ''}${g.prior_year}: ${money(g.dollars)} in its ${g.year} filing, ${money(g.prior_dollars)} in ${g.prior_year}`;
// The two filings a table's Giving Change mostly compares (Nov 2 2026, Will: "clearer about the time period its
// measuring"): its header names them; a funder on other years says its own in its cell.
function changePeriod(changes) {
  const n = {};
  for (const g of changes) if (g) { const k = g.prior_year + ' to ' + g.year; n[k] = (n[k] || 0) + 1; }
  return Object.keys(n).sort((a, b) => n[b] - n[a] || b.localeCompare(a))[0] || '';
}
function givingChangeHtml(g, period) {
  if (!g) return '';
  const mark = g.pct > 0 ? '▲ ' : g.pct < 0 ? '▼ ' : '';
  const own = g.prior_year + ' to ' + g.year;
  return `<span title="${escHtml(changeWords(g))}" data-tip="${escHtml(changeWords(g))}" style="white-space:nowrap">${mark}${Math.abs(g.pct).toLocaleString('en-US')}%</span>${own !== period ? ` <span style="white-space:nowrap">(${own})</span>` : ''}`;
}

function drawLandscape() {
  const L = LAND; if (!L) return;
  const t = L.totals, subj = LAND_SUBJECT;
  const subjLabel = subj ? ((L.subjects.find(s => s.code === subj) || {}).label || subj) : '';
  document.getElementById('lTitle').textContent = 'Who Funds ' + L.county;
  document.getElementById('lSub').textContent = `Every foundation and grantmaking charity that gave to organizations in ${L.county}, tax years ${L.years[0]} to ${L.years[L.years.length - 1]}, from their IRS filings.`;
  const w = L.by_where_funders_are, all = t.dollars;
  const funders = L.funders
    .map(f => ({...f, shown: subj ? (f.by_subject[subj] || 0) : f.dollars}))
    .filter(f => f.shown > 0)
    .sort((a, b) => b.shown - a.shown);
  const list = funders;
  const grantees = L.grantees.filter(g => !subj || g.subject === subj).slice(0, 25);
  const period = changePeriod(list.map(f => f.giving_change));
  const maxSubj = Math.max(1, ...L.subjects.map(s => s.dollars));
  const h = [];
  h.push(`<div class="toolbar">
      <div class="dr-seg" role="group" aria-label="Which organizations">
        <button type="button" aria-pressed="${LAND_VIEW === 'community'}" onclick="setLandView('community')">Community Organizations</button>
        <button type="button" aria-pressed="${LAND_VIEW === 'all'}" onclick="setLandView('all')">Including Colleges, Hospitals And Grantmakers</button>
      </div>
      <select id="lSubject" onchange="setLandSubject(this.value)" aria-label="Subject">
        <option value="">All Subjects</option>${L.subjects.map(s => `<option value="${s.code}" ${s.code === subj ? 'selected' : ''}>${escHtml(s.label)}</option>`).join('')}
      </select>
    </div>`);
  h.push(`<div class="gp-tiles">
      <div class="gp-tile"><b>${money(all)}</b><span>given in ${L.years.length} years</span></div>
      <div class="gp-tile"><b>${t.grants.toLocaleString()}</b><span>grants</span></div>
      <div class="gp-tile"><b>${t.funders.toLocaleString()}</b><span>funders</span></div>
      <div class="gp-tile"><b>${t.grantees.toLocaleString()}</b><span>organizations funded</span></div>
    </div>
    <p class="lead">Where the money comes from: <b>${pct(w.county, all)}</b> from funders based in ${escHtml(L.county)},
      <b>${pct(w.state, all)}</b> from elsewhere in ${escHtml(L.state)}, and <b>${pct(w.out_of_state, all)}</b> from out of state.</p>`);
  h.push(`<div class="card fmap-card"><h2>Funding Map</h2><div id="lMap">${LMAP && LMAP_VIEW === LAND_VIEW ? '' : '<div class="empty">Loading the map…</div>'}</div></div>`);
  h.push(`<div class="card"><h2>${subj ? 'Funders Of ' + escHtml(subjLabel) : 'Top Funders'}</h2>
      <p class="lead">${subj ? 'Dollars to ' + escHtml(subjLabel.toLowerCase()) + ' organizations here. ' : ''}Open a funder FundBug lists to see its giving profile and how to apply. Giving Change compares all of a funder's giving, wherever it went, in its latest tax filing with the one before (the years in the heading, or in the cell when a funder's differ); hover it for the amounts.</p>
      <p class="lead">The ${Math.min(funders.length, 50)} largest funders here. To find any other foundation, <a onclick="showPage('matches')" style="cursor:pointer">Search The Library</a>.</p>
      <div class="gp-table"><table><thead><tr><th>Funder</th><th>Based In</th><th class="num">Dollars Here</th><th class="num">${subj ? 'Grants (All Subjects)' : 'Grants'}</th><th class="num">${subj ? 'Typical Grant (All Subjects)' : 'Typical Grant'}</th><th class="num">Giving Change${period ? ', ' + period : ''}</th><th>Years</th></tr></thead><tbody>
      ${list.slice(0, LAND_SHOWN).map(f => `<tr>
        <td>${f.listing_id ? `<a onclick="openListing('${f.listing_id}')" style="cursor:pointer">${escHtml(landName(f))}</a>` : escHtml(landName(f))}
          ${f.donor_advised ? '<br><span class="badge">Gives here from donors&#39; funds: no applications</span>' : ''}
          ${f.accepts_unsolicited === false || f.by_invitation ? '<br><span class="badge">Does not accept unsolicited applications</span>' : ''}
          ${f.elsewhere_note ? '<br><span class="badge">' + escHtml(f.elsewhere_note) + '</span>' : ''}</td>
        <td>${escHtml(f.based_in || '')}</td><td class="num">${money(f.shown)}</td><td class="num">${f.grants}</td>
        <td class="num">${money(f.median)}</td><td class="num">${givingChangeHtml(f.giving_change, period)}</td><td>${f.years[0]}${f.years.length > 1 ? ' to ' + f.years[f.years.length - 1] : ''}</td></tr>`).join('')}
      </tbody></table></div>
      ${list.length > LAND_SHOWN ? `<div style="text-align:center;margin-top:10px"><button class="btn ghost sm" onclick="LAND_SHOWN+=50;drawLandscape()">Show More (${list.length - LAND_SHOWN} more)</button></div>` : ''}
    </div>`);
  // Funders based here whose filings give their own address for every grantee (Oct 19 2026, Will: yes): their grants
  // are not in this county's figures, so they are listed apart, with all their giving, never added to the totals.
  const unplaced = L.unplaced_here || [];
  const uPeriod = changePeriod(unplaced.map(f => f.giving_change));
  if (!subj && unplaced.length) {
    h.push(`<div class="card"><h2>Based Here, Giving Not Placed</h2>
      <p class="lead">These funders are based in ${escHtml(L.county)}, but their tax filings give the funder's own address for every grantee, so FundBug cannot tell how much of their giving stays here. The figures are all their grants, wherever they went, and are not part of the totals above.</p>
      <div class="gp-table"><table><thead><tr><th>Funder</th><th>Based In</th><th class="num">All Their Grants</th><th class="num">Dollars, All Places</th><th class="num">Giving Change${uPeriod ? ', ' + uPeriod : ''}</th><th>Years</th></tr></thead><tbody>
      ${unplaced.map(f => `<tr>
        <td>${f.listing_id ? `<a onclick="openListing('${f.listing_id}')" style="cursor:pointer">${escHtml(landName(f))}</a>` : escHtml(landName(f))}
          ${f.accepts_unsolicited === false || f.by_invitation ? '<br><span class="badge">Does not accept unsolicited applications</span>' : ''}</td>
        <td>${escHtml(f.based_in || '')}</td><td class="num">${(f.grants || 0).toLocaleString()}</td><td class="num">${money(f.dollars)}</td><td class="num">${givingChangeHtml(f.giving_change, uPeriod)}</td>
        <td>${f.years && f.years.length ? f.years[0] + (f.years.length > 1 ? ' to ' + f.years[f.years.length - 1] : '') : ''}</td></tr>`).join('')}
      </tbody></table></div></div>`);
  }
  if (!subj) {
    h.push(`<div class="card"><h2>By Subject</h2><p class="lead">The subjects of the organizations funded, from their IRS records. ${Math.round(L.subjects_matched_dollars * 100)}% of the dollars went to organizations whose subject is on record.</p>
      <div class="gp-table"><table><thead><tr><th>Subject</th><th class="num">Dollars</th><th class="num">Funders</th><th class="num">Organizations</th></tr></thead><tbody>
      ${L.subjects.map(s => `<tr><td><a onclick="setLandSubject('${s.code}');window.scrollTo(0,0)" style="cursor:pointer">${escHtml(s.label)}</a>
        <div class="l-bar"><i style="width:${Math.max(2, Math.round(100 * s.dollars / maxSubj))}%"></i></div></td>
        <td class="num">${money(s.dollars)}</td><td class="num">${s.funders}</td><td class="num">${s.grantees}</td></tr>`).join('')}
      </tbody></table></div></div>`);
    h.push(`<div class="card"><h2>By Town</h2><div class="gp-table"><table><thead><tr><th>Town</th><th class="num">Dollars</th><th class="num">Grants</th><th class="num">Organizations</th></tr></thead><tbody>
      ${L.towns.map(x => `<tr><td>${escHtml(x.town)}</td><td class="num">${money(x.dollars)}</td><td class="num">${x.grants}</td><td class="num">${x.grantees}</td></tr>`).join('')}
      </tbody></table></div></div>`);
  }
  h.push(`<div class="card"><h2>Largest Grantees${subj ? ': ' + escHtml(subjLabel) : ''}</h2><div class="gp-table"><table><thead><tr><th>Organization</th><th>Town</th><th class="num">Dollars</th><th class="num">Funders</th></tr></thead><tbody>
      ${grantees.map(g => `<tr><td>${escHtml(g.name)}</td><td>${escHtml(g.town)}</td><td class="num">${money(g.dollars)}</td><td class="num">${g.funders}</td></tr>`).join('')}
      </tbody></table></div></div>`);
  h.push(`<div class="card"><h2>By Year</h2><div class="gp-table"><table><thead><tr><th>Tax Year</th><th class="num">Dollars</th><th class="num">Grants</th><th class="num">Funders</th></tr></thead><tbody>
      ${t.by_year.map(y => `<tr><td>${y.year}</td><td class="num">${money(y.dollars)}</td><td class="num">${y.grants}</td><td class="num">${y.funders}</td></tr>`).join('')}
      </tbody></table></div><p class="gp-method">The latest years are incomplete: foundations' filings are published one to two years after the year they cover.</p></div>`);
  h.push(`<p class="gp-method"><b>How this is built.</b> ${escHtml(L.method)}</p>`);
  document.getElementById('lBody').innerHTML = h.join('');
  drawFundingMap();
}

// ── The Funding Map (Nov 18 2026; backend nonprofit/np_funding_map) ─────────────────────────────────────────────────
// Where grant money went, town by town, in the organization's county and its neighbors: each town shaded by the dollars
// foundations gave to organizations there (or to the chosen subject), and opened to its funders. Town level only: no
// funder and no person is ever placed on the map. Its own styles, so the advisor portal (np-side.js) shows it too.
const FMAP_COLORS = ['#e3eedc', '#b9d6ac', '#86b977', '#4f8f43', '#2f5c28'];
const FMAP_RADII = [['', 'Your County And Its Neighbors'], ['10', 'Within 10 Miles'], ['25', 'Within 25 Miles'], ['50', 'Within 50 Miles']];
function fmapStyle() {
  if (document.getElementById('fmapStyle')) return;
  const st = document.createElement('style'); st.id = 'fmapStyle';
  st.textContent = `.fmap-wrap{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:start}
.fmap-svg{width:100%;height:auto;display:block;background:#f7f5f0;border-radius:10px}
.fmap-svg path{stroke:#fff;stroke-width:.9;cursor:pointer;vector-effect:non-scaling-stroke}
.fmap-svg path:hover{stroke:#1a1a14;stroke-width:1.6}
.fmap-svg path.home{stroke:#1a1a14;stroke-width:2.6}
.fmap-svg path.sel{stroke:#c44b2a;stroke-width:2.6}
.fmap-svg text{font-family:Jost,sans-serif;font-weight:600;fill:#1a1a14;pointer-events:none;paint-order:stroke;stroke:#f7f5f0;stroke-width:3px}
.fmap-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:10px 0 0;font-size:14px;color:#1a1a14}
.fmap-legend i{display:inline-block;width:14px;height:14px;border-radius:3px;margin-right:5px;vertical-align:-2px}
.fmap-town h3{margin:0 0 4px}.fmap-town p{font-size:15px;color:#1a1a14;margin:0 0 10px}
.fmap-town ol{margin:0;padding-left:20px;font-size:15px}.fmap-town li{margin:0 0 6px}
.fmap-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}
@media (max-width:800px){.fmap-wrap{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
}
async function loadFundingMap() {
  if (LMAP_LOADING) return;
  LMAP_LOADING = true; LMAP_ERR = '';
  try {
    LMAP = MODE === 'account'
      ? await apiFetch('/api/nonprofit/landscape/map?view=' + LAND_VIEW)
      : await apiFetch('/api/nonprofit/preview/landscape/map?state=MA&county=25003&city=Pittsfield&view=' + LAND_VIEW);
    LMAP_VIEW = LAND_VIEW;
    if (!LMAP_TOWN) LMAP_TOWN = LMAP.home_town || '';
  } catch (e) { LMAP = null; LMAP_ERR = e.status === 404 ? e.message : 'Could not load the map: ' + e.message; }
  LMAP_LOADING = false;
  drawFundingMap();
}
function fmapMiles(a, b) {
  const r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
// The towns shown: all of them, or those whose center is within the chosen miles of the organization's own town.
function fmapTowns(M, radius) {
  const home = M.towns.find(t => t.fips === M.home_town);
  if (!radius || !home) return M.towns;
  return M.towns.filter(t => fmapMiles(home, t) <= +radius);
}
// Five shades by the towns' dollars (quantiles of the towns with any); none is the palest.
function fmapBreaks(values) {
  const v = values.filter(x => x > 0).sort((a, b) => a - b);
  if (!v.length) return [];
  // Rounded to two figures, so the legend reads $60,000, not $62,367.
  const nice = x => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1)); return Math.round(x / p) * p; };
  return [...new Set([0.2, 0.4, 0.6, 0.8].map(q => nice(v[Math.min(v.length - 1, Math.floor(q * v.length))])))];
}
function fmapShade(x, breaks) {
  if (!x) return '#f0ede6';
  let i = 0; while (i < breaks.length && x > breaks[i]) i++;
  return FMAP_COLORS[i];
}
function fmapValue(t, subj) { return subj ? ((t.by_subject || {})[subj] || 0) : t.dollars; }
function setFmapRadius(v) { LMAP_RADIUS = v; drawFundingMap(); }
function setFmapTown(f) { LMAP_TOWN = f; drawFundingMap(); }
function drawFundingMap() {
  const box = document.getElementById('lMap'); if (!box) return;
  fmapStyle();
  if (LMAP_ERR) { box.innerHTML = `<div class="empty">${escHtml(LMAP_ERR)}</div>`; return; }
  if (!LMAP || LMAP_VIEW !== LAND_VIEW) { box.innerHTML = '<div class="empty">Loading the map…</div>'; loadFundingMap(); return; }
  const M = LMAP, subj = LAND_SUBJECT;
  const towns = fmapTowns(M, LMAP_RADIUS);
  const vals = towns.map(t => fmapValue(t, subj)), breaks = fmapBreaks(vals);
  const b = towns.reduce((a, t) => [Math.min(a[0], t.b[0]), Math.min(a[1], t.b[1]), Math.max(a[2], t.b[2]), Math.max(a[3], t.b[3])], [1e9, 1e9, -1e9, -1e9]);
  const pad = 8, vb = `${b[0] - pad} ${b[1] - pad} ${b[2] - b[0] + 2 * pad} ${b[3] - b[1] + 2 * pad}`;
  const top = [...towns].sort((x, y) => fmapValue(y, subj) - fmapValue(x, subj)).slice(0, 6).map(t => t.fips);
  const sel = towns.find(t => t.fips === LMAP_TOWN) || towns.find(t => t.fips === M.home_town) || null;
  const svg = `<svg class="fmap-svg" viewBox="${vb}" role="img" aria-label="Map of towns shaded by grant dollars">
    ${towns.map(t => `<path d="${t.d}" fill="${t.built ? fmapShade(fmapValue(t, subj), breaks) : '#e4e1d8'}" class="${t.fips === M.home_town ? 'home' : ''}${sel && t.fips === sel.fips ? ' sel' : ''}" onclick="setFmapTown('${t.fips}')"><title>${escHtml(t.name)}: ${money(fmapValue(t, subj))}</title></path>`).join('')}
    ${towns.filter(t => top.includes(t.fips) || t.fips === M.home_town).map(t => `<text x="${t.cx}" y="${t.cy}" text-anchor="middle" font-size="${Math.max(10, (b[2] - b[0]) / 38)}">${escHtml(t.name)}</text>`).join('')}
  </svg>`;
  const fmt = n => money(n).replace(/\.00$/, '');
  const legend = breaks.length ? `<div class="fmap-legend"><span><i style="background:#f0ede6"></i>None on file</span>${FMAP_COLORS.map((c, i) =>
    `<span><i style="background:${c}"></i>${i === 0 ? 'Up to ' + fmt(breaks[0]) : i === FMAP_COLORS.length - 1 ? 'Over ' + fmt(breaks[breaks.length - 1]) : fmt(breaks[i - 1]) + ' to ' + fmt(breaks[i])}</span>`).join('')}</div>` : '';
  const subjLabel = subj ? ((LAND && LAND.subjects.find(s => s.code === subj)) || {}).label || '' : '';
  let side = '<div class="fmap-town"><p>Click a town to see who gave there.</p></div>';
  if (sel) {
    const fs = (sel.funders || []).map(f => ({...f, shown: subj ? ((f.s || {})[subj] || 0) : f.dollars})).filter(f => f.shown > 0).sort((x, y) => y.shown - x.shown);
    const county = (M.counties.find(c => c.fips === sel.county) || {}).name || '';
    side = `<div class="fmap-town"><h3>${escHtml(sel.name)}</h3>
      <p>${escHtml(county)}. ${money(fmapValue(sel, subj))}${subj ? ' to ' + escHtml(subjLabel.toLowerCase()) + ' organizations' : ''} in ${sel.grants.toLocaleString()} grants${subj ? ' (all subjects)' : ''}, tax years ${M.counties[0].years[0]} to ${M.counties[0].years[M.counties[0].years.length - 1]}.</p>
      ${!sel.built ? `<p>The funders for ${escHtml(county)} are not on the map yet.</p>` : fs.length
        ? `<p><b>Its largest funders</b> (those an organization can approach):</p><ol>${fs.map(f => `<li>${f.listing_id ? `<a onclick="openListing('${f.listing_id}')" style="cursor:pointer">${escHtml(f.name)}</a>` : escHtml(f.name)}: ${money(f.shown)}${subj ? '' : ` in ${f.grants} grant${f.grants === 1 ? '' : 's'}`}${f.by_invitation ? ' <span class="badge">By invitation</span>' : ''}</li>`).join('')}</ol>`
        : '<p>No funder an organization can approach gave here in these years.</p>'}</div>`;
  }
  const radiusSel = M.home_town ? `<select onchange="setFmapRadius(this.value)" aria-label="How far">${FMAP_RADII.map(([v, l]) => `<option value="${v}" ${v === LMAP_RADIUS ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '';
  const unplaced = Object.values(M.unplaced || {}).reduce((a, u) => a + u.grants, 0);
  box.innerHTML = `<p class="lead">Where foundations' grants went, town by town${subj ? ', to ' + escHtml(subjLabel.toLowerCase()) + ' organizations' : ''}: the darker the town, the more it received. Your town is outlined. Funders are listed under the towns their grants went to; no funder or person is placed on the map.</p>
    <div class="fmap-tools">${radiusSel}</div>
    <div class="fmap-wrap"><div>${svg}${legend}</div>${side}</div>
    <p class="gp-method">Town outlines from the US Census Bureau. Grants from foundations' IRS filings, by the town each filing gives for its grantee; a village is counted in its town.${unplaced ? ` ${unplaced.toLocaleString()} grants to places the map cannot put on a town are in the totals but not on the map.` : ''}</p>`;
}
