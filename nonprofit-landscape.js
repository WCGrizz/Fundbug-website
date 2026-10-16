// The Funding Landscape page of the nonprofit portal (Oct 16 2026): who funds the organizations of the account's
// county, from foundations' and grantmaking charities' IRS filings, built ahead by the backend's
// nonprofit/np_landscape.py (no model call). nonprofit-portal.html loads this after its own script and supplies
// apiFetch, escHtml, money, MODE and openListing.

let LAND = null, LAND_VIEW = 'community', LAND_SUBJECT = '', LAND_SHOWN = 25, LAND_Q = '';

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

function drawLandscape(keepFocus) {
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
  const q = LAND_Q;
  const list = q ? funders.filter(f => f.name.toLowerCase().includes(q.toLowerCase())) : funders;
  const grantees = L.grantees.filter(g => !subj || g.subject === subj).slice(0, 25);
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
  h.push(`<div class="card"><h2>${subj ? 'Funders Of ' + escHtml(subjLabel) : 'Top Funders'}</h2>
      <p class="lead">${subj ? 'Dollars to ' + escHtml(subjLabel.toLowerCase()) + ' organizations here. ' : ''}Open a funder FundBug lists to see its giving profile and how to apply.</p>
      <input id="lSearch" class="gp-search" placeholder="Search funders" value="${escHtml(q)}" oninput="LAND_Q=this.value;LAND_SHOWN=25;drawLandscape(true)">
      <div class="gp-table"><table><thead><tr><th>Funder</th><th>Based In</th><th class="num">Dollars Here</th><th class="num">${subj ? 'Grants (All Subjects)' : 'Grants'}</th><th class="num">${subj ? 'Typical Grant (All Subjects)' : 'Typical Grant'}</th><th>Years</th></tr></thead><tbody>
      ${list.slice(0, LAND_SHOWN).map(f => `<tr>
        <td>${f.listing_id ? `<a onclick="openListing('${f.listing_id}')" style="cursor:pointer">${escHtml(f.name)}</a>` : escHtml(f.name)}
          ${f.donor_advised ? '<br><span class="badge">Gives here from donors&#39; funds: no applications</span>' : ''}
          ${f.accepts_unsolicited === false ? '<br><span class="badge">Does not accept unsolicited applications</span>' : ''}</td>
        <td>${escHtml(f.based_in || '')}</td><td class="num">${money(f.shown)}</td><td class="num">${f.grants}</td>
        <td class="num">${money(f.median)}</td><td>${f.years[0]}${f.years.length > 1 ? ' to ' + f.years[f.years.length - 1] : ''}</td></tr>`).join('')}
      </tbody></table></div>
      ${list.length > LAND_SHOWN ? `<div style="text-align:center;margin-top:10px"><button class="btn ghost sm" onclick="LAND_SHOWN+=50;drawLandscape()">Show More (${list.length - LAND_SHOWN} more)</button></div>` : ''}
    </div>`);
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
  if (keepFocus) { const el = document.getElementById('lSearch'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}
