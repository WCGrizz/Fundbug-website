// The Funding Plan page of the nonprofit portal (Oct 28 2026, Phase 1): a capital stack for the year, above the fields
// that fill it, and the organization's donor list. Will, after the BBEC call: "a fully customizable capital stack. a
// nonprofit can say i need x $ this year, and attribute different amounts to different sources"; "a large visual cap
// stack, traditionally rectangular, which is above all the other fillable fields". AJ (BBEC): track individual donors,
// not just foundations. The backend works out every figure (nonprofit/np_funding_plan.py); this page draws it and
// sends changes. nonprofit-portal.html loads this after its own script and supplies apiFetch, escHtml, money,
// shortMoney, showPage, openListing, MONTH_NAMES and the side panel.

let FP = null, FP_DONORS = null, FP_MSG = '', FP_DQ = '', FP_IMPORT = null, FP_GAP = null, FP_CF = null;
// Nov 10 2026 (Will, after demoing it: "the funding plan needs to be much more simple to change, add donors, add
// revenue"; "Funders that can close the gap should be its own page ... not expanded by default"; an Add Source button
// under each source): three pages under Funding Plan's column (This Year's Plan, Close The Gap, Donors), and on the
// first, one folded row per source holding its items.
let FP_VIEW = 'plan', FP_OPEN = new Set(), FP_ADD = null;
const FP_COLORS = {earned: '#7ab870', government: '#2f5d7c', foundation: '#3d7a38', corporate: '#7a5c99',
                   individual: '#a8643a', events: '#b8901c', other: '#8a8577'};

// "Berkshire" and "Berkshire County" both read "Berkshire County" (Nov 9 2026: the donor section said "Berkshire County
// County" for an organization whose county is stored with the word).
function fpCountyName(county) {
  const c = String(county || '').trim();
  if (!c) return 'your county';
  return /\bcounty$/i.test(c) ? c : c + ' County';
}
async function openFundingPlan(view) {
  FP_VIEW = view || 'plan';
  showPage('plan');
  if (FP) fpDraw();                                       // the page at once, then fresh figures
  await fpLoad(FP ? FP.fiscal_year : null);
}
async function fpLoad(year) {
  const box = document.getElementById('fpBody');
  if (!FP) box.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const q = year ? '?year=' + encodeURIComponent(year) : '';
    [FP, FP_DONORS] = await Promise.all([apiFetch('/api/nonprofit/funding-plan' + q), apiFetch('/api/nonprofit/donors' + q)]);
  } catch (e) {
    FP = null;
    box.innerHTML = `<div class="empty">${escHtml(e.status === 503 ? e.message : 'Could not load your Funding Plan: ' + e.message)}</div>`;
    return;
  }
  FP_GAP = null;
  fpDraw();
  fpLoadGap();
  fpLoadCf();
}
// Community foundations whose donors give near you (Nov 6 2026, Will: the community foundation route to DAF donors):
// loaded after the plan, once a visit (it does not change with the year).
async function fpLoadCf() {
  if (!FP_CF) {
    try { FP_CF = await apiFetch('/api/nonprofit/donor-fund-foundations'); }
    catch (e) { FP_CF = {error: e.message, foundations: []}; }
  }
  const el = document.getElementById('fpCf'); if (el) el.innerHTML = fpCfCard(FP_CF);
}
function fpMillions(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' billion';
  return n >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' million' : money(n);
}
function fpCfCard(c) {
  if (!c) return '<p>Looking for community foundations near you…</p>';
  if (c.error) return `<p>They could not be read just now (${escHtml(c.error)}).</p>`;
  const lead = '<p>Many donors give through donor-advised funds at a community foundation, and its staff advise them on where to give. Their names are private, and FundBug never names them; a relationship with the foundation, and its own grants, are the way onto their radar.</p>';
  if (!(c.foundations || []).length) return lead + `<p>No community foundation with donor-advised funds gives in ${escHtml(c.county ? c.county + ' County' : 'your county')} in the filings on file.</p>`;
  return lead + `<div class="fp-picks">${c.foundations.map(f => { const d = f.donor_funds || {};
    return `<div class="fp-pick"><div><div class="fp-pick-name">${f.listing_id ? `<a onclick="openListing('${f.listing_id}')">${escHtml(f.name)}</a>` : escHtml(f.name)}</div>
      <span>${d.funds ? `${Number(d.funds).toLocaleString()} donor-advised funds${d.value ? ` holding ${escHtml(fpMillions(d.value))}` : ''}` : 'Donor-advised funds'}${d.grants ? `; its donors recommended ${escHtml(fpMillions(d.grants))} in grants in ${d.year}` : ''}.</span>
      <span>${Number(f.here_grants).toLocaleString()} grants to organizations in ${escHtml(fpCountyName(c.county))} (${escHtml(fpMillions(f.here_dollars || 0))}) in its filings on file.</span>
      ${d.services_url ? `<span><a href="${escHtml(d.services_url)}" target="_blank" rel="noopener">Its page for donors</a></span>` : ''}</div></div>`; }).join('')}</div>`;
}
// Funders that could close the gap (Nov 5 2026): loaded after the plan, so the page never waits on the matcher.
async function fpLoadGap() {
  const fy = FP && FP.fiscal_year;
  try { FP_GAP = await apiFetch('/api/nonprofit/funding-plan/' + fy + '/gap-matches'); }
  catch (e) { FP_GAP = {error: e.message, gaps: []}; }
  if (FP && FP.fiscal_year === fy) { const el = document.getElementById('fpGap'); if (el) el.innerHTML = fpGapCard(FP_GAP); }
}
function fpGapCard(g) {
  if (!g) return '<p class="lead">Looking through your matches for funders that fit what is left to raise…</p>';
  if (g.error) return `<p class="lead">Your matches could not be read just now (${escHtml(g.error)}).</p>`;
  if (!g.gaps.length) return '<p class="lead">Your foundation, government and corporate sources are fully planned for: nothing left to fill from your matches.</p>';
  return g.gaps.map(x => `<h3 class="fp-h3"><i class="fp-dot" style="background:${FP_COLORS[x.key]}"></i>${escHtml(x.label)}: ${escHtml(money(x.gap))} still to find</h3>
    ${x.picks.length ? `<div class="fp-picks">${x.picks.map(c => `<div class="fp-pick"><div><a onclick="openListing('${c.id}')">${escHtml(c.title)}</a>
        <span>${escHtml([c.typical_min || c.typical_max ? 'Typical grant ' + [c.typical_min, c.typical_max].filter(Boolean).map(shortMoney).join(' to ') : c.amount, c.deadline].filter(Boolean).join(' · '))}</span></div>
        <button class="btn ghost sm" ${c.saved ? 'disabled' : ''} onclick="fpSaveGap('${c.id}', this)">${c.saved ? 'Saved ✓' : 'Save To Tracker'}</button></div>`).join('')}</div>
      ${FP_MATCH_SOURCES[x.key] ? `<p><a onclick="fpFindMatches('${x.key}')">See all ${escHtml(x.label.toLowerCase())} in your matches</a></p>` : ''}`
    : `<p class="lead">None of your current matches fits this gap; <a onclick="fpFindMatches('${x.key}')">see all ${escHtml(x.label.toLowerCase())} in your matches</a>.</p>`}`).join('');
}
async function fpSaveGap(id, btn) {
  try {
    await apiFetch('/api/nonprofit/tracker', 'POST', {group_id: id});
    (FP_GAP.gaps || []).forEach(x => x.picks.forEach(c => { if (c.id === id) c.saved = true; }));
    if (btn) { btn.textContent = 'Saved ✓'; btn.disabled = true; }
    if (typeof TRACKER !== 'undefined') TRACKER = null;
  } catch (e) { if (btn) btn.textContent = 'Could not save'; }
}

// ── figures in words ────────────────────────────────────────────────────
function fpDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${MONTH_NAMES[+m[2] - 1].slice(0, 3)} ${+m[3]}, ${m[1]}` : '';
}
function fpYearLabel(fy, end) {
  const startMonth = end % 12, startYear = end === 12 ? fy : fy - 1;
  return `FY${fy} (${MONTH_NAMES[startMonth]} ${startYear} to ${MONTH_NAMES[end - 1]} ${fy})`;
}
function fpParse(v) {
  const s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
  if (s === '') return null;
  return /^\d+(\.\d+)?$/.test(s) ? Math.round(Number(s)) : NaN;
}

// ── the stack ───────────────────────────────────────────────────────────
// Nov 5 2026, Will picked "B over A" from three options: one bar to the goal on top (each source's secured money in
// its color, then pending striped, then what is left, and what the plan does not cover yet dashed), and under it a
// bar for each source (secured of planned), its name and figures beside it, never text on color. The tower it
// replaced put labels over the colors and crowded the small sources ("That capital stack doesnt look good").
// Percentages beside the dollars (Nov 6 2026, Will: "we should show percentages in the funding plan screen, not just
// $$ amounts"): each source's secured share of what is planned, and the totals' shares of the goal.
function fpPct(part, whole) { return whole > 0 ? Math.round(100 * (part || 0) / whole) + '%' : ''; }
function fpStack(v, home) {                                      // home: Home's card, which has no Your Sources below
  const goal = v.goal || 0, bands = v.sources.filter(s => s.shown > 0);
  if (!bands.length && !goal) return `<div class="fp-empty">Set this year's goal and plan your sources below, and your capital stack appears here.</div>`;
  const max = Math.max(goal, v.totals.shown, 1), pct = n => (100 * n / max).toFixed(2) + '%';
  const tipOf = s => `${s.label}: ${money(s.secured)} secured, ${money(s.pending)} pending${s.pending_unknown ? ` (and ${s.pending_unknown} with no amount asked)` : ''}, ` +
    `${money(s.planned)} planned` + (s.planned && s.secured > s.planned ? ' (more than planned)' : '');
  const segs = [];
  for (const s of bands) {
    const sec = Math.min(s.secured, s.shown);
    if (sec > 0) segs.push(`<i class="fp-seg" style="width:${pct(sec)};background:${FP_COLORS[s.key]}" data-tip="${escHtml(tipOf(s))}"></i>`);
  }
  for (const s of bands) {
    const pen = Math.min(s.pending, s.shown - Math.min(s.secured, s.shown));
    if (pen > 0) segs.push(`<i class="fp-seg fp-pending" style="width:${pct(pen)};--c:${FP_COLORS[s.key]}" data-tip="${escHtml(tipOf(s))}"></i>`);
  }
  const unplanned = goal > v.totals.shown ? goal - v.totals.shown : 0;
  const out = [`<div class="fp-stack" role="img" aria-label="Your capital stack for FY${v.fiscal_year}: ${escHtml(money(v.totals.secured))} secured of ${escHtml(money(goal || v.totals.shown))}">`,
    `<div class="fp-top"><span>${escHtml(money(v.totals.secured))} secured${goal ? ` (${fpPct(v.totals.secured, goal)})` : ''}${v.totals.pending ? `, ${escHtml(money(v.totals.pending))} pending${goal ? ` (${fpPct(v.totals.pending, goal)})` : ''}` : ''}</span>${goal ? `<span>Goal ${escHtml(money(goal))}</span>` : ''}</div>`,
    `<div class="fp-bar">${segs.join('')}${unplanned ? `<i class="fp-seg fp-unplanned" style="margin-left:auto;width:${pct(unplanned)}" data-tip="Not yet planned: ${escHtml(money(unplanned))}"></i>` : ''}</div>`];
  if (unplanned && !home) out.push(`<p class="fp-note">Not yet planned: ${escHtml(money(unplanned))} of your goal. Plan it under Your Sources below.</p>`);
  out.push('</div>');
  return out.join('');
}
// One source's bar and figures: secured of planned, pending beside it.
function fpBandHtml(s) {
  const out = [];
  {
    const tipOf = s => `${s.label}: ${money(s.secured)} secured, ${money(s.pending)} pending, ${money(s.planned)} planned`;
    const base = Math.max(s.planned, s.shown, 1), sec = Math.min(s.secured, base), pen = Math.min(s.pending, base - sec), c = FP_COLORS[s.key];
    out.push(`<div class="fp-band" data-key="${s.key}" data-tip="${escHtml(tipOf(s))}">`,
      `<span class="fp-name"><i class="fp-dot" style="background:${c}"></i>${escHtml(s.label)}</span>`,
      `<span class="fp-rowbar"><i style="width:${(100 * sec / base).toFixed(1)}%;background:${c}"></i>${pen > 0 ? `<i class="fp-pending" style="width:${(100 * pen / base).toFixed(1)}%;--c:${c}"></i>` : ''}</span>`,
      `<span class="fp-fig">${escHtml(shortMoney(s.secured))} of ${escHtml(shortMoney(s.planned || s.shown))} <b>${fpPct(s.secured, s.planned || s.shown)}</b>${s.pending ? ` <small>+${escHtml(shortMoney(s.pending))} pending</small>` : ''}${s.restricted ? ` <small>${escHtml(shortMoney(s.restricted))} restricted</small>` : ''}${s.planned && s.secured > s.planned ? ' <small>(more than planned)</small>' : ''}</span></div>`);
  }
  return out.join('');
}
function fpTotalsLine(v) {
  const t = v.totals, g = v.goal || 0;
  const pct = g ? Math.round(100 * t.secured / g) : null;
  return `<div class="gp-tiles">
      <div class="gp-tile"><b>${g ? money(g) : 'Not set'}</b><span>goal for FY${v.fiscal_year}</span></div>
      <div class="gp-tile"><b>${money(t.secured)}</b><span>secured${pct != null ? ` (${pct}% of goal)` : ''}</span>${t.restricted ? `<span>${money(t.unrestricted)} unrestricted, ${money(t.restricted)} restricted</span>` : ''}</div>
      <div class="gp-tile"><b>${money(t.pending)}</b><span>pending${g ? ` (${fpPct(t.pending, g)} of goal)` : ''}</span></div>
      <div class="gp-tile"><b>${g ? money(t.to_raise) : '—'}</b><span>still to raise${g ? ` (${fpPct(t.to_raise, g)} of goal)` : ''}</span></div>
    </div>`;
}

// How the page works (Nov 5 2026, Will: "add a bit more instruction on how to use the funding plan tab"): open while
// the plan has nothing in it, folded to its title once it has figures.
function fpGuide(v) {
  const empty = !(v.totals && (v.totals.planned || v.totals.secured || v.totals.pending));
  return `<details class="card fp-guide"${empty ? ' open' : ''}><summary>How This Page Works</summary>
      <ol>
        <li><b>Set your goal for the year</b> at the top. It starts as the annual budget in your Organization Profile.</li>
        <li><b>Add what you expect under each source.</b> Open a source and press Add Source: a name, an amount and a date are enough (a bake sale, a gala, a grant you plan to apply for). Grants can come from your Tracker or the Library.</li>
        <li><b>Mark each one Planned, Pending or Secured</b> as it moves along. A grant you mark Submitted or Awarded in your Tracker, and the gifts in your donor list, count by themselves.</li>
      </ol>
      <p class="lead">Each source's planned amount is the sum of what is in it, or an amount you enter instead. Everyone on your team sees and can change the same plan.</p>
    </details>`;
}

// ── the page ────────────────────────────────────────────────────────────
function fpDraw() {
  const v = FP; if (!v) return;
  const h = [];
  if (FP_MSG) h.push(`<div class="fp-msg">${FP_MSG}</div>`);
  if (FP_VIEW === 'gap') {
    h.push(`<div class="card"><h2>Close The Gap</h2><p class="lead">From your own matches: funders and programs open to you whose typical grant fits what each grant source still needs for FY${v.fiscal_year}.</p><div id="fpGap">${fpGapCard(FP_GAP)}</div></div>`);
  } else if (FP_VIEW === 'donors') {
    h.push(fpDonorsCard());
  } else {
    h.push(fpGuide(v));
    const years = v.years.includes(v.fiscal_year) ? v.years : v.years.concat([v.fiscal_year]).sort();
    h.push(`<div class="card fp-stack-card"><div class="fp-head">
        <div><label for="fpYear">Fiscal Year</label><select id="fpYear" onchange="fpLoad(this.value)">${years.map(y => `<option value="${y}" ${y === v.fiscal_year ? 'selected' : ''}>${escHtml(fpYearLabel(y, v.end_month))}</option>`).join('')}</select></div>
        <div><label for="fpGoal">Goal For The Year</label><input id="fpGoal" inputmode="numeric" value="${v.goal != null ? money(v.goal) : ''}" placeholder="$" onchange="fpSaveGoal(this.value)"></div>
      </div>
      ${fpTotalsLine(v)}
      ${fpStack(v)}
      <div class="fp-key"><span><i class="fp-k solid"></i>Secured</span><span><i class="fp-k striped"></i>Pending</span><span><i class="fp-k light"></i>Still to raise</span><span><i class="fp-k dashed"></i>Not yet planned</span></div>
      <p class="lead">${v.goal_from === 'budget' ? "The goal is your profile's annual budget until you set one here. " : ''}Your fiscal year ends in ${MONTH_NAMES[v.end_month - 1]} (Fiscal Year Ends in your <a onclick="showPage('profile')">Organization Profile</a>).${v.updated_by_name ? ` Last changed by ${escHtml(v.updated_by_name)}.` : ''}</p>
      <div class="fp-actions"><button class="btn sm" onclick="go('plan/gap')">Find Funders To Close The Gap</button><button class="btn ghost sm" onclick="go('plan/donors')">Your Donors</button></div></div>`);
    h.push(`<div class="card"><h2>Your Sources</h2><p class="lead">Open a source to see what is in it and add to it.</p>
      <div class="fp-srcs">${v.sources.map(fpSourceRow).join('')}</div>${fpTotalsFoot(v)}</div>`);
  }
  document.getElementById('fpBody').innerHTML = h.join('');
}
function fpTotalsFoot(v) {
  const t = v.totals;
  return `<p class="fp-foot"><b>All sources:</b> ${money(t.planned)} planned${v.goal ? ` (${fpPct(t.planned, v.goal)} of your goal)` : ''}, ${money(t.secured)} secured, ${money(t.pending)} pending, ${money(t.still_to_raise != null ? t.still_to_raise : Math.max(0, t.planned - t.secured))} still to raise.</p>`;
}
// A source, folded to its bar and figures; open, its planned amount, everything in it and Add Source.
function fpSourceRow(s) {
  const open = FP_OPEN.has(s.key);
  return `<div class="fp-src${open ? ' open' : ''}">
    <div class="fp-src-head" role="button" tabindex="0" aria-expanded="${open}" onclick="fpToggle('${s.key}')"
      onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fpToggle('${s.key}'); }"><span class="fp-chev" aria-hidden="true">${open ? '▾' : '▸'}</span>${fpBandHtml(s)}</div>
    ${open ? `<div class="fp-src-body">${fpPlannedLine(s)}${fpItemsHtml(s)}
      <div class="fp-actions"><button class="btn sm" onclick="fpAddPanel('${s.key}')">Add Source</button>${FP_MATCH_SOURCES[s.key] && s.planned > s.secured ? `<button class="btn ghost sm" onclick="fpFindMatches('${s.key}')">${FP_MATCH_SOURCES[s.key]}</button>` : ''}</div></div>` : ''}
  </div>`;
}
function fpToggle(key) { if (FP_OPEN.has(key)) FP_OPEN.delete(key); else FP_OPEN.add(key); fpDraw(); }
// Planned: the sum of what is in the source, or an amount entered (Will, Nov 10 2026: "a toggle ... between sum of
// items and manual entry").
function fpPlannedLine(s) {
  const manual = s.planned_mode === 'manual';
  return `<div class="fp-planned"><span><b>Planned:</b></span>
    <span class="fp-toggle" role="group" aria-label="${escHtml(s.label)}: how planned is counted">
      <button class="${manual ? '' : 'on'}" aria-pressed="${!manual}" onclick="fpSetMode('${s.key}', 'items')">Sum Of Items</button>
      <button class="${manual ? 'on' : ''}" aria-pressed="${manual}" onclick="fpSetMode('${s.key}', 'manual')">Enter An Amount</button></span>
    ${manual ? `<input class="fp-amt" inputmode="numeric" aria-label="${escHtml(s.label)} planned" value="${s.planned_manual ? money(s.planned_manual) : ''}" placeholder="$" onchange="fpSaveSource('${s.key}', 'planned', this.value)">
      <span class="fp-sub">${money(s.items_total)} in the items below</span>` : `<b>${money(s.items_total)}</b>`}</div>`;
}
const FP_STATUS = {planned: 'Planned', pending: 'Pending', secured: 'Secured'};
// Everything in a source: its own items, the Tracker's awards and applications counted toward it, its donors, and an
// amount entered the earlier way (one figure for the source).
function fpItemsHtml(s) {
  const v = FP, rows = [];
  for (const it of s.items || []) {
    rows.push(`<div class="fp-item"><div class="fp-item-main"><b>${escHtml(it.name)}</b>
        <span class="fp-pill ${it.counted_by_tracker ? 'tracker' : it.status}">${it.counted_by_tracker ? 'Counted From Your Tracker' : FP_STATUS[it.status]}</span>${it.restricted ? '<span class="fp-pill">Restricted</span>' : ''}
        <div class="fp-sub">${[it.amount ? money(it.amount) : '', it.date ? fpDay(it.date) : '', it.notes || ''].filter(Boolean).map(escHtml).join(' · ')}</div></div>
      <div class="fp-item-acts"><button class="btn ghost sm" onclick="fpAddPanel('${s.key}', '${it.id}')">Edit</button><button class="btn ghost sm" onclick="fpRemoveItem('${s.key}', '${it.id}')">Remove</button></div></div>`);
  }
  for (const a of (v.awards || []).filter(a => a.source === s.key)) {
    rows.push(fpTrackerLine(a, `${money(a.counted)} awarded${a.counted !== a.amount ? ` (of ${money(a.amount)})` : ''}${a.decided_on ? ', ' + fpDay(a.decided_on) : ''}`, 'secured', true));
  }
  for (const a of (v.pending || []).filter(a => a.source === s.key)) {
    rows.push(fpTrackerLine(a, a.amount_requested ? `${money(a.amount_requested)} asked` : 'No amount asked in your Tracker', 'pending', false));
  }
  if (s.key === 'individual' && (s.secured_donors || s.pending_pledges)) {
    rows.push(`<div class="fp-item"><div class="fp-item-main"><b>Your donor list</b><span class="fp-pill secured">From Your Donors</span>
      <div class="fp-sub">${money(s.secured_donors)} given this year${s.through_daf ? ` (${money(s.through_daf)} through donor-advised funds)` : ''}${s.pending_pledges ? `, ${money(s.pending_pledges)} pledged and still to come` : ''}</div></div>
      <div class="fp-item-acts"><button class="btn ghost sm" onclick="go('plan/donors')">Open Your Donors</button></div></div>`);
  }
  if (s.secured_other || s.pending_entered) {
    rows.push(`<div class="fp-item"><div class="fp-item-main"><b>Entered as one amount</b>
      <div class="fp-sub">${[s.secured_other ? money(s.secured_other) + ' secured' + (s.restricted_entered ? ` (${money(s.restricted_entered)} restricted)` : '') : '', s.pending_entered ? money(s.pending_entered) + ' pending' : ''].filter(Boolean).join(', ')}</div></div>
      <div class="fp-item-acts"><button class="btn ghost sm" onclick="fpOneAmountPanel('${s.key}')">Edit</button></div></div>`);
  }
  return rows.length ? `<div class="fp-items">${rows.join('')}</div>` : `<p class="fp-sub">Nothing here yet. Add what you expect from ${escHtml(s.label.toLowerCase())}.</p>`;
}
// A Tracker row counted toward this source, with its choices behind More Detail (counts toward, this year's share,
// restricted, leave out): what the Awards card held before Nov 10 2026.
function fpTrackerLine(a, what, status, awarded) {
  const id = 'fpd_' + a.tracking_id;
  return `<div class="fp-item"><div class="fp-item-main"><b>${fpTitle(a)}</b><span class="fp-pill ${status}">${awarded ? 'Awarded' : 'Submitted'} In Your Tracker</span>${a.restricted ? '<span class="fp-pill">Restricted</span>' : ''}${a.left_out ? '<span class="fp-pill">Left Out</span>' : ''}
      <div class="fp-sub">${escHtml(what)}</div>
      <details class="fp-more" id="${id}"><summary>More Detail</summary>
        <div class="fp-more-grid"><label>Counts Toward ${fpSourceSelect(a.tracking_id, a.source)}</label>
        ${awarded ? `<label>This Year's Share <input class="fp-amt" inputmode="numeric" value="${a.share != null ? money(a.share) : ''}" placeholder="${escHtml(money(a.amount))}" onchange="fpSaveAward('${a.tracking_id}', {share: this.value})"></label>
        <label class="chk"><input type="checkbox" ${a.restricted ? 'checked' : ''} onchange="fpSaveAward('${a.tracking_id}', {restricted: this.checked})"> Restricted To A Purpose</label>` : ''}
        <label class="chk"><input type="checkbox" ${a.left_out ? 'checked' : ''} onchange="fpSaveAward('${a.tracking_id}', {left_out: this.checked})"> Leave Out Of The Plan</label></div>
      </details></div></div>`;
}
function fpSourceSelect(tid, cur) {
  return `<select class="fp-sel" aria-label="Counts toward" onchange="fpSaveAward('${tid}', {source: this.value})">${['foundation', 'government', 'corporate', 'individual', 'events', 'earned', 'other']
    .map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${escHtml((FP.sources.find(s => s.key === k) || {}).label || k)}</option>`).join('')}</select>`;
}
function fpTitle(a) { return a.group_id ? `<a onclick="openListing('${a.group_id}')">${escHtml(a.title || '')}</a>` : escHtml(a.title || ''); }

// ── Add Source ─────────────────────────────────────────────────────────
// Type it in (a name, an amount, a date, its status; more detail if wanted), or for a grant source pick it from the
// Tracker or find it in the Library (saved to the Tracker first, so it follows its stage). The panel closes only by
// its own buttons (the side panel's X, or Cancel).
const FP_GRANT_SOURCES = ['foundation', 'government', 'corporate'];
function fpSrc(key) { return FP.sources.find(s => s.key === key); }
function fpAddPanel(key, itemId, tab) {
  const s = fpSrc(key), it = itemId ? (s.items || []).find(x => x.id === itemId) : null;
  FP_ADD = {key, itemId: it ? it.id : null, tab: it ? 'type' : (tab || 'type'), q: ''};
  const tabs = !it && FP_GRANT_SOURCES.includes(key) ? [['type', 'Type It In'], ['tracker', 'From Your Tracker'], ['find', 'Find A Program Or Funder']]
    : !it && key === 'individual' ? [['type', 'Type It In'], ['donor', 'From Your Donors']] : [];
  fpPanel(it ? 'Edit ' + it.name : 'Add To ' + s.label, `
    ${tabs.length ? `<div class="fp-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${k === FP_ADD.tab ? 'on' : ''}" onclick="fpAddTab('${k}')">${l}</button>`).join('')}</div>` : ''}
    <div id="fpAddBody"></div>`);
  fpAddDraw();
}
function fpAddTab(tab) { FP_ADD.tab = tab; document.querySelectorAll('.fp-tabs button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(`'${tab}'`))); fpAddDraw(); }
function fpAddDraw() {
  const box = document.getElementById('fpAddBody'); if (!box) return;
  const key = FP_ADD.key, s = fpSrc(key), it = FP_ADD.itemId ? (s.items || []).find(x => x.id === FP_ADD.itemId) : {};
  if (FP_ADD.tab === 'tracker') return fpAddFromTracker(box);
  if (FP_ADD.tab === 'find') return fpAddFind(box);
  if (FP_ADD.tab === 'donor') {
    box.innerHTML = `<p class="lead">Each donor's gifts this year count toward Individual Donors by themselves, and their pledges count as pending.</p>
      <div class="fp-actions"><button class="btn sm" onclick="closePanel(); fpDonorPanel(null)">Add A Donor</button><button class="btn ghost sm" onclick="closePanel(); go('plan/donors')">Open Your Donors</button></div>`;
    return;
  }
  const statuses = key === 'individual' ? ['planned', 'secured'] : ['planned', 'pending', 'secured'];
  const more = !!(it.restricted || it.notes);
  box.innerHTML = `
    <label for="fiName">Name</label><input id="fiName" value="${escHtml(it.name || '')}" placeholder="${key === 'events' ? 'e.g. Bake Sale Fundraiser' : key === 'earned' ? 'e.g. Summer Program Fees' : 'e.g. Spring Appeal'}">
    <div class="row"><div><label for="fiAmount">Amount</label><input id="fiAmount" inputmode="numeric" value="${it.amount ? money(it.amount) : ''}" placeholder="$"></div>
      <div><label for="fiDate">Date (If Any)</label><input id="fiDate" type="date" value="${escHtml(it.date || '')}"></div></div>
    <label for="fiStatus">Status</label><select id="fiStatus">${statuses.map(x => `<option value="${x}" ${x === (it.status || 'planned') ? 'selected' : ''}>${FP_STATUS[x]}</option>`).join('')}</select>
    <details class="fp-more"${more ? ' open' : ''}><summary>More Detail</summary>
      <label class="chk"><input type="checkbox" id="fiRestricted" ${it.restricted ? 'checked' : ''}> Restricted To A Purpose</label>
      <label for="fiNotes">Notes</label><textarea class="t-notes" id="fiNotes">${escHtml(it.notes || '')}</textarea></details>
    <div class="err" id="fiErr"></div>
    <div class="fp-actions"><button class="btn" onclick="fpSaveItem()">${FP_ADD.itemId ? 'Save' : 'Add It'}</button><button class="btn ghost" onclick="closePanel()">Cancel</button></div>`;
}
// The stored form of a source's items (what the backend keeps), without the figures the page is given.
function fpStoredItems(key) {
  return (fpSrc(key).items || []).map(({id, name, amount, date, status, restricted, notes, tracking_id, group_id}) =>
    ({id, name, amount, date, status, restricted, notes, tracking_id, group_id}));
}
async function fpSaveItem() {
  const v = id => document.getElementById(id).value, err = document.getElementById('fiErr');
  const amount = fpParse(v('fiAmount'));
  if (!v('fiName').trim()) { err.textContent = 'Give it a name.'; return; }
  if (Number.isNaN(amount)) { err.textContent = 'The amount must be in dollars, like 2,500.'; return; }
  const key = FP_ADD.key, items = fpStoredItems(key);
  const fields = {name: v('fiName').trim(), amount: amount || 0, date: v('fiDate') || null, status: v('fiStatus'),
                  restricted: document.getElementById('fiRestricted').checked, notes: v('fiNotes').trim() || null};
  if (FP_ADD.itemId) { const i = items.findIndex(x => x.id === FP_ADD.itemId); items[i] = {...items[i], ...fields}; }
  else items.push(fields);
  await fpSaveItems(key, items, err);
}
async function fpSaveItems(key, items, errEl) {
  try {
    FP = await apiFetch('/api/nonprofit/funding-plan/' + FP.fiscal_year, 'POST', {sources: {[key]: {items}}, updated_at: FP.updated_at});
  } catch (e) {
    if (errEl) { errEl.innerHTML = escHtml(e.message) + (e.status === 409 ? ` <button class="btn ghost sm" onclick="closePanel();fpLoad(${FP.fiscal_year})">Reload</button>` : ''); return false; }
    FP_MSG = escHtml(e.message); fpDraw(); return false;
  }
  FP_MSG = ''; FP_OPEN.add(key); closePanel(); fpDraw();
  return true;
}
function fpRemoveItem(key, id) {
  const it = (fpSrc(key).items || []).find(x => x.id === id);
  if (!it || !confirm(`Remove ${it.name} from your plan?`)) return;
  fpSaveItems(key, fpStoredItems(key).filter(x => x.id !== id));
}
function fpSetMode(key, mode) { fpSave({sources: {[key]: {planned_mode: mode}}}); }
// The earlier one-figure entries (secured, its restricted part, pending), still editable.
function fpOneAmountPanel(key) {
  const s = fpSrc(key);
  fpPanel(s.label + ': Entered As One Amount', `
    <p class="lead">An amount entered for the whole source before items. Set any of these to 0 to clear it, and add the money as items instead.</p>
    <div class="row"><div><label for="foSec">Secured</label><input id="foSec" inputmode="numeric" value="${s.secured_other ? money(s.secured_other) : ''}" placeholder="$"></div>
      <div><label for="foRes">Of It Restricted</label><input id="foRes" inputmode="numeric" value="${s.restricted_entered ? money(s.restricted_entered) : ''}" placeholder="$"></div></div>
    ${key === 'individual' ? '' : `<label for="foPen">Pending</label><input id="foPen" inputmode="numeric" value="${s.pending_entered ? money(s.pending_entered) : ''}" placeholder="$">`}
    <div class="err" id="foErr"></div>
    <div class="fp-actions"><button class="btn" onclick="fpSaveOneAmount('${key}')">Save</button><button class="btn ghost" onclick="closePanel()">Cancel</button></div>`);
}
async function fpSaveOneAmount(key) {
  const g = id => { const el = document.getElementById(id); return el ? fpParse(el.value) : undefined; };
  const ch = {secured: g('foSec'), restricted: g('foRes')};
  if (key !== 'individual') ch.pending = g('foPen');
  if (Object.values(ch).some(n => Number.isNaN(n))) { document.getElementById('foErr').textContent = 'Each amount must be in dollars, like 2,500.'; return; }
  Object.keys(ch).forEach(k => { ch[k] = ch[k] || 0; });
  closePanel();
  await fpSave({sources: {[key]: ch}});
}
// From the Tracker: a funder or program saved there and not yet submitted (one Submitted or Awarded counts by itself),
// added with the amount expected. Awards from another year can be counted this year with their share.
async function fpAddFromTracker(box) {
  box.innerHTML = '<div class="empty">Loading your Tracker…</div>';
  if (typeof TRACKER === 'undefined' || !TRACKER) {
    try { TRACKER = await apiFetch('/api/nonprofit/tracker'); }
    catch (e) { box.innerHTML = `<div class="empty">Could not load your Tracker: ${escHtml(e.message)}</div>`; return; }
  }
  if (FP_ADD.tab !== 'tracker') return;
  const inPlan = new Set(FP.sources.flatMap(s => (s.items || []).map(i => i.tracking_id)).filter(Boolean));
  const rows = (TRACKER.items || []).filter(i => !i.seen_in_digest && i.tracking_id && !inPlan.has(String(i.tracking_id))
                                             && !['submitted', 'awarded', 'not_awarded', 'passed'].includes(i.status));
  const others = FP.other_year_awards || [];
  box.innerHTML = `<p class="lead">Grants you mark Submitted or Awarded in your Tracker count here by themselves. Add one you plan to apply for, with the amount you expect.</p>
    ${rows.length ? `<div class="fp-picks">${rows.map(i => `<div class="fp-pick"><div><b>${escHtml(i.title)}</b><span>${escHtml([i.amount, i.deadline].filter(Boolean).join(' · '))}</span></div>
      <span class="fp-pick-add"><input class="fp-amt" inputmode="numeric" id="fta_${i.tracking_id}" aria-label="Amount you expect from ${escHtml(i.title)}" placeholder="$ expected">
      <button class="btn ghost sm" onclick="fpAddTracked('${i.tracking_id}')">Add</button></span></div>`).join('')}</div>`
      : '<p class="fp-sub">Nothing in your Tracker to add: everything there is already in your plan, submitted or decided.</p>'}
    ${others.length ? `<h3 class="fp-h3">Count An Award From Another Year</h3><div class="row">
        <div><label for="fpOther">Award</label><select id="fpOther">${others.map(a => `<option value="${a.tracking_id}">${escHtml(a.title || '')}: ${escHtml(money(a.amount))}${a.decided_on ? ', ' + escHtml(fpDay(a.decided_on)) : ''}</option>`).join('')}</select></div>
        <div><label for="fpOtherShare">This Year's Share</label><input id="fpOtherShare" inputmode="numeric" placeholder="$"></div>
      </div><button class="btn ghost sm" onclick="closePanel(); fpAddOther()">Count It This Year</button>` : ''}
    <div class="err" id="fiErr"></div>`;
}
async function fpAddTracked(tid) {
  const i = (TRACKER.items || []).find(x => String(x.tracking_id) === String(tid)), err = document.getElementById('fiErr');
  const amount = fpParse(document.getElementById('fta_' + tid).value);
  if (amount === null || Number.isNaN(amount)) { err.textContent = 'Enter the amount you expect, in dollars.'; return; }
  const items = fpStoredItems(FP_ADD.key);
  items.push({name: i.title, amount, status: 'planned', tracking_id: String(tid), group_id: i.group_id || null});
  await fpSaveItems(FP_ADD.key, items, err);
}
// Find it in the Library: saved to the Tracker, then added (Will: "search for a program/funder").
function fpAddFind(box) {
  box.innerHTML = `<label for="fpFindQ">Program Or Funder</label><input id="fpFindQ" placeholder="Start typing a name" value="${escHtml(FP_ADD.q)}" oninput="FP_ADD.q=this.value;fpFindDraw()">
    <div id="fpFindList"></div><div class="err" id="fiErr"></div>`;
  fpFindDraw();
  const q = document.getElementById('fpFindQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length);
}
function fpFindDraw() {
  const el = document.getElementById('fpFindList'); if (!el) return;
  const all = (typeof RESULT !== 'undefined' && RESULT && RESULT.shown) || [];
  if (!all.length) { el.innerHTML = '<p class="fp-sub">Your Library is still loading. Try again in a moment.</p>'; return; }
  const words = FP_ADD.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) { el.innerHTML = '<p class="fp-sub">Every funder and program in your Library can be found here.</p>'; return; }
  const hits = all.filter(m => words.every(w => (m.title + ' ' + (m.provided_by || '')).toLowerCase().includes(w))).slice(0, 12);
  el.innerHTML = hits.length ? `<div class="fp-picks">${hits.map(m => `<div class="fp-pick"><div><b>${escHtml(m.title)}</b><span>${escHtml([m.kind === 'funder' ? 'Funder' : 'Opportunity',
      m.typical_min || m.typical_max ? 'Typical grant ' + [m.typical_min, m.typical_max].filter(Boolean).map(shortMoney).join(' to ') : m.amount].filter(Boolean).join(' · '))}</span></div>
      <span class="fp-pick-add"><input class="fp-amt" inputmode="numeric" id="ffa_${m.id}" aria-label="Amount you expect from ${escHtml(m.title)}" placeholder="$ expected" value="${m.typical_max || m.typical_min ? money(m.typical_max || m.typical_min) : ''}">
      <button class="btn ghost sm" onclick="fpAddFound('${m.id}', this)">Add</button></span></div>`).join('')}</div>` : '<p class="fp-sub">Nothing in your Library by that name.</p>';
}
async function fpAddFound(gid, btn) {
  const m = RESULT.shown.find(x => x.id === gid), err = document.getElementById('fiErr');
  const amount = fpParse(document.getElementById('ffa_' + gid).value);
  if (amount === null || Number.isNaN(amount)) { err.textContent = 'Enter the amount you expect, in dollars.'; return; }
  btn.disabled = true; btn.textContent = 'Adding…';
  let tid;
  try {
    await apiFetch('/api/nonprofit/tracker', 'POST', {group_id: gid});           // into the Tracker, to follow its stage
    m.saved = true;
    TRACKER = await apiFetch('/api/nonprofit/tracker');
    const row = (TRACKER.items || []).find(x => x.group_id === gid);
    tid = row && row.tracking_id;
  } catch (e) { err.textContent = 'Could not save it to your Tracker: ' + e.message; btn.disabled = false; btn.textContent = 'Add'; return; }
  const items = fpStoredItems(FP_ADD.key);
  items.push({name: m.title, amount, status: 'planned', tracking_id: tid ? String(tid) : null, group_id: gid});
  if (!(await fpSaveItems(FP_ADD.key, items, err))) { btn.disabled = false; btn.textContent = 'Add'; }
}

// A source with money still to raise links to the Matches that would fill it (Nov 2 2026, Will: yes): the funders and
// programs of that kind that fit, by the funder's type (np_api._card's source). Nothing else changes, and no digest.
const FP_MATCH_SOURCES = {foundation: 'Find Foundation Matches', government: 'Find Government Matches', corporate: 'Find Corporate Matches'};
function fpFindMatches(key) {
  showPage('matches');
  const sel = document.getElementById('mSource');
  if (sel) sel.value = key;
  if (typeof RESULT !== 'undefined' && RESULT) drawMatches(); else runMatches(true);
}

// ── saving the plan ─────────────────────────────────────────────────────
async function fpSave(changes) {
  FP_MSG = '';
  try {
    FP = await apiFetch('/api/nonprofit/funding-plan/' + FP.fiscal_year, 'POST', {...changes, updated_at: FP.updated_at});
  } catch (e) {
    FP_MSG = escHtml(e.message) + (e.status === 409 ? ` <button class="btn ghost sm" onclick="FP_MSG='';fpLoad(${FP.fiscal_year})">Reload</button>` : '');
  }
  fpDraw();
}
function fpBad(what) { FP_MSG = escHtml(what + ' must be an amount in dollars, like 25,000.'); fpDraw(); }
function fpSaveGoal(raw) { const n = fpParse(raw); if (Number.isNaN(n)) return fpBad('The goal'); fpSave({goal: n}); }
function fpSaveSource(key, field, raw) {
  const n = fpParse(raw); if (Number.isNaN(n)) return fpBad('An amount');
  fpSave({sources: {[key]: {[field]: n || 0}}});
}
function fpSaveAward(tid, change) {
  const cur = [...FP.awards, ...FP.pending, ...FP.other_year_awards].find(a => a.tracking_id === tid) || {};
  const next = {source: cur.source !== cur.default_source ? cur.source : null, share: cur.share != null ? cur.share : null, left_out: !!cur.left_out,
                restricted: !!cur.restricted, ...change};
  if ('share' in change) { const n = fpParse(change.share); if (Number.isNaN(n)) return fpBad("This year's share"); next.share = n; }
  if (next.source === cur.default_source) next.source = null;
  fpSave({awards: {[tid]: next.source == null && next.share == null && !next.left_out && !next.restricted ? null : next}});
}
function fpAddOther() {
  const tid = document.getElementById('fpOther').value, n = fpParse(document.getElementById('fpOtherShare').value);
  if (!n || Number.isNaN(n)) return fpBad("This year's share");
  fpSave({awards: {[tid]: {source: null, share: n, left_out: false}}});
}

// ── the donor list ──────────────────────────────────────────────────────
function fpDonorsCard() {
  const ds = (FP_DONORS && FP_DONORS.donors) || [], q = FP_DQ.toLowerCase();
  const shown = q ? ds.filter(d => (d.name || '').toLowerCase().includes(q) || (d.email || '').toLowerCase().includes(q)) : ds;
  const given = ds.reduce((a, d) => a + d.given_this_year, 0), open = ds.reduce((a, d) => a + d.pledge_open, 0);
  const viaDaf = ds.reduce((a, d) => a + (d.given_through_daf_this_year || 0), 0);
  return `<div class="card"><h2>Individual Donors</h2>
      <p class="lead">Your own list, seen only by your team. FundBug never shares it and never uses it to write anything. Gifts dated in FY${FP.fiscal_year} count toward Individual Donors above, and pledges not yet given count as pending.</p>
      <p class="fp-stat">${ds.length ? `<b>${ds.length.toLocaleString()}</b> donors, <b>${money(given)}</b> given this year${viaDaf ? ` (<b>${money(viaDaf)}</b> of it through donor-advised funds)` : ''}, <b>${money(open)}</b> pledged and still to come.` : 'No donors yet.'}</p>
      <div class="fp-actions"><button class="btn sm" onclick="fpDonorPanel(null)">Add A Donor</button><button class="btn ghost sm" onclick="fpDonorPanel(null, true)">Add An Anonymous DAF Gift</button><button class="btn ghost sm" onclick="fpImportPanel()">Import From A Spreadsheet</button>${ds.length ? '<button class="btn ghost sm" onclick="fpDownload()">Download As A Spreadsheet</button>' : ''}</div>
      ${ds.length > 10 ? `<input id="fpDq" class="gp-search" placeholder="Search donors" value="${escHtml(FP_DQ)}" oninput="FP_DQ=this.value;fpDraw();const i=document.getElementById('fpDq');i.focus();i.setSelectionRange(i.value.length,i.value.length)">` : ''}
      ${shown.length ? `<div class="gp-table"><table><thead><tr><th>Name</th><th class="num">Given This Year</th><th class="num">Pledged This Year</th><th>Last Gift</th><th>Next Step</th></tr></thead><tbody>
        ${shown.map(d => `<tr><td><a onclick="fpDonorPanel('${d.id}')">${escHtml(d.name)}</a>${(d.daf_sponsors || []).length ? ` <span class="badge" title="${escHtml(d.daf_sponsors.join(', '))}">Gives Through A DAF</span>` : ''}</td><td class="num">${money(d.given_this_year)}</td><td class="num">${d.pledged_this_year ? money(d.pledged_this_year) : ''}</td>
          <td>${d.last_gift ? escHtml(money(d.last_gift.amount) + ', ' + fpDay(d.last_gift.date)) : ''}</td><td>${escHtml(d.next_step || '')}${d.next_step_on ? ' (' + escHtml(fpDay(d.next_step_on)) + ')' : ''}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
      <h3 class="fp-h3">Gifts From Donor-Advised Funds</h3>
      <p>${FP_DAF_TIP}</p>
      <h3 class="fp-h3">Community Foundations Whose Donors Give Near You</h3><div id="fpCf">${fpCfCard(FP_CF)}</div>
    </div>`;
}
function fpPanel(title, html) {
  document.getElementById('panelTitle').textContent = title;
  document.getElementById('panelBody').innerHTML = html;
  document.getElementById('panel').classList.add('open');
  document.getElementById('scrim').style.display = 'block';
}
// Donor-advised funds (Nov 6 2026, Susan of Minerva; Will: approved). A gift through a DAF names its sponsor, the legal
// giver, on the gift of the donor who recommended it; an anonymous one goes on a donor named for its sponsor.
const FP_DAF_SPONSORS = ['Fidelity Charitable', 'Schwab Charitable (DAFgiving360)', 'Vanguard Charitable', 'National Philanthropic Trust',
  'American Endowment Foundation', 'Daffy Charitable Fund', 'Goldman Sachs Philanthropy Fund', 'Morgan Stanley Global Impact Funding Trust',
  'Berkshire Taconic Community Foundation', 'The Boston Foundation', 'Community Foundation of Western Massachusetts', 'Jewish Communal Fund'];
const FP_DAF_TIP = 'To welcome gifts from donor-advised funds, put your legal name and EIN in your appeals and add a DAF option to your donation page (DAFpay and DAF Direct are two). When one arrives, record it on the gift of the donor who recommended it, with its sponsor under Through A DAF.';
let FP_EDIT = null;                         // the donor open in the panel, with its gifts as edited
function fpDonorPanel(id, anonymousDaf) {
  const d = id ? FP_DONORS.donors.find(x => x.id === id)
              : anonymousDaf ? {name: 'Anonymous Through ', gifts: [{date: new Date().toISOString().slice(0, 10), amount: null, note: '', daf: ''}], pledges: {}}
              : {name: '', gifts: [], pledges: {}};
  if (!d) return;
  FP_EDIT = {id, updated_at: d.updated_at, pledges: {...(d.pledges || {})}, gifts: (d.gifts || []).map(g => ({...g}))};
  const fy = FP.fiscal_year, val = k => escHtml(d[k] || '');
  fpPanel(id ? d.name : 'Add A Donor', `
    <div class="row"><div><label for="fdName">Name</label><input id="fdName" value="${val('name')}"></div>
      <div><label for="fdEmail">Email</label><input id="fdEmail" type="email" value="${val('email')}"></div></div>
    <div class="row"><div><label for="fdPhone">Phone</label><input id="fdPhone" value="${val('phone')}"></div>
      <div><label for="fdPledge">Pledged For FY${fy}</label><input id="fdPledge" inputmode="numeric" value="${FP_EDIT.pledges[fy] ? money(FP_EDIT.pledges[fy]) : ''}" placeholder="$"></div></div>
    <div class="row"><div><label for="fdNext">Next Step</label><input id="fdNext" value="${val('next_step')}" placeholder="e.g. Thank-you call"></div>
      <div><label for="fdNextOn">Next Step On</label><input id="fdNextOn" type="date" value="${val('next_step_on')}"></div></div>
    <label for="fdNotes">Notes</label><textarea class="t-notes" id="fdNotes">${val('notes')}</textarea>
    <h3 class="fp-h3">Gifts</h3>
    <p>A gift through a donor-advised fund: put its sponsor (on the check or letter) under Through A DAF. Thank the sponsor and your donor both. Your donor gets no tax receipt, since they took the deduction when they funded their DAF, and a DAF cannot pay for event tickets or other benefits.${anonymousDaf ? ' For an anonymous gift, name this donor for the sponsor, such as Anonymous Through Fidelity Charitable.' : ''}</p>
    <div id="fdGifts"></div>
    <div class="err" id="fdErr"></div>
    <div class="fp-actions"><button class="btn" onclick="fpSaveDonor()">Save</button><button class="btn ghost" onclick="closePanel()">Cancel</button>
      ${id ? `<button class="btn ghost" onclick="fpRemoveDonor('${id}')">Remove This Donor</button>` : ''}</div>`);
  fpDrawGifts();
}
function fpDrawGifts() {
  const g = FP_EDIT.gifts;
  document.getElementById('fdGifts').innerHTML = `<datalist id="fdDafList">${FP_DAF_SPONSORS.map(x => `<option value="${escHtml(x)}">`).join('')}</datalist>
    <div class="gp-table"><table><thead><tr><th>Date</th><th class="num">Amount</th><th>Note</th><th>Restricted</th><th>Through A DAF</th><th></th></tr></thead><tbody>
    ${g.map((x, i) => `<tr><td><input type="date" aria-label="Gift date" value="${escHtml(x.date || '')}" onchange="FP_EDIT.gifts[${i}].date=this.value"></td>
      <td class="num"><input class="fp-amt" inputmode="numeric" aria-label="Gift amount" value="${x.amount ? money(x.amount) : ''}" onchange="FP_EDIT.gifts[${i}].amount=fpParse(this.value)"></td>
      <td><input style="min-width:130px" aria-label="Gift note" value="${escHtml(x.note || '')}" onchange="FP_EDIT.gifts[${i}].note=this.value"></td>
      <td><input type="checkbox" aria-label="Restricted to a purpose" ${x.restricted ? 'checked' : ''} onchange="FP_EDIT.gifts[${i}].restricted=this.checked"></td>
      <td><input list="fdDafList" style="min-width:190px" aria-label="Donor-advised fund sponsor, if it came through one" placeholder="Sponsor, if any" value="${escHtml(x.daf || '')}" onchange="FP_EDIT.gifts[${i}].daf=this.value.trim()"></td>
      <td><button class="btn ghost sm" onclick="FP_EDIT.gifts.splice(${i},1);fpDrawGifts()">Remove</button></td></tr>`).join('')}
    </tbody></table></div><button class="btn ghost sm" onclick="FP_EDIT.gifts.push({date: new Date().toISOString().slice(0, 10), amount: null, note: ''});fpDrawGifts()">Add A Gift</button>`;
}
async function fpSaveDonor() {
  const err = document.getElementById('fdErr'), v = id => document.getElementById(id).value;
  const pledge = fpParse(v('fdPledge'));
  if (Number.isNaN(pledge)) { err.textContent = 'The pledge must be an amount in dollars.'; return; }
  if (FP_EDIT.gifts.some(g => !g.amount || Number.isNaN(g.amount) || !g.date)) { err.textContent = 'Each gift needs a date and an amount in dollars.'; return; }
  const pledges = {...FP_EDIT.pledges}; if (pledge) pledges[FP.fiscal_year] = pledge; else delete pledges[FP.fiscal_year];
  const fields = {name: v('fdName'), email: v('fdEmail'), phone: v('fdPhone'), notes: v('fdNotes'), next_step: v('fdNext'),
                  next_step_on: v('fdNextOn') || null, pledges, gifts: FP_EDIT.gifts};
  try {
    if (FP_EDIT.id) await apiFetch('/api/nonprofit/donors/' + FP_EDIT.id, 'PATCH', {...fields, updated_at: FP_EDIT.updated_at});
    else await apiFetch('/api/nonprofit/donors', 'POST', fields);
  } catch (e) { err.textContent = e.message; return; }
  closePanel();
  await fpLoad(FP.fiscal_year);
}
async function fpRemoveDonor(id) {
  if (!confirm('Remove this donor from your list? Their gifts stop counting toward your plan.')) return;
  try { await apiFetch('/api/nonprofit/donors/' + id + '/remove', 'POST', {}); }
  catch (e) { document.getElementById('fdErr').textContent = e.message; return; }
  closePanel();
  await fpLoad(FP.fiscal_year);
}

// ── a spreadsheet in, a spreadsheet out ─────────────────────────────────
// Rows are read here and sent as {name, email, amount, date, note}; the backend matches each to a donor by email, else
// by exactly the same name, adds a gift only once, and reports what it could not read. Check It shows exactly what
// Import will do.
function fpParseCsv(text) {
  const rows = [], s = String(text || '').replace(/^﻿/, '');
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim())) rows.push(row);
  return rows;
}
const FP_FIELDS = [['name', 'Name'], ['first', 'First Name'], ['last', 'Last Name'], ['email', 'Email'], ['amount', 'Amount'], ['date', 'Date'], ['note', 'Note']];
function fpGuessColumns(head) {
  const h = head.map(x => String(x || '').trim().toLowerCase()), pick = (re, not) => h.findIndex(x => re.test(x) && !(not && not.test(x)));
  const m = {first: pick(/first/), last: pick(/last|surname/, /last gift|last donation|last date/), email: pick(/e-?mail/),
             amount: pick(/amount|gift|donation|total|received/, /date|count|type|id$/), date: pick(/date|received on|given on/),
             note: pick(/note|memo|fund|campaign|appeal|designation/)};
  m.name = pick(/^(full |donor |contact |constituent )?name$|^donor$|constituent/);
  return m;
}
function fpDate(s) {
  s = String(s || '').trim();
  let m;
  const ymd = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/.exec(s))) return ymd(m[3].length === 2 ? '20' + m[3] : m[3], m[1], m[2]);
  if ((m = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/.exec(s))) {
    const i = MONTH_NAMES.findIndex(n => n.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
    if (i >= 0) return ymd(m[3], i + 1, m[2]);
  }
  return s;                                            // sent as it is: the backend reports it as not read
}
function fpRowsFrom(table, m) {
  const cell = (r, i) => i >= 0 ? String(r[i] || '').trim() : '';
  return table.slice(1).map(r => ({
    name: cell(r, m.name) || [cell(r, m.first), cell(r, m.last)].filter(Boolean).join(' '),
    email: cell(r, m.email), amount: cell(r, m.amount), date: cell(r, m.date) ? fpDate(cell(r, m.date)) : '', note: cell(r, m.note)}));
}
function fpImportPanel() {
  FP_IMPORT = null;
  fpPanel('Import Donors From A Spreadsheet', `
    <p class="lead">Save your donor list or gift history as a CSV file (every spreadsheet and donor database can), then choose it here. Each row can be a donor, or one gift with its date and amount. Nothing is added until you press Import.</p>
    <label for="fiFile">CSV File</label><input id="fiFile" type="file" accept=".csv,text/csv" onchange="fpReadFile(this.files[0])">
    <div id="fiMap"></div><div id="fiResult"></div><div class="err" id="fiErr"></div>
    <div class="fp-actions"><button class="btn ghost" onclick="closePanel()">Cancel</button></div>`);
}
function fpReadFile(f) {
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    const table = fpParseCsv(r.result);
    if (table.length < 2) { document.getElementById('fiErr').textContent = 'That file has no rows under its headings.'; return; }
    FP_IMPORT = {table, map: fpGuessColumns(table[0])};
    fpDrawMap();
  };
  r.readAsText(f);
}
function fpDrawMap() {
  const {table, map} = FP_IMPORT, head = table[0];
  document.getElementById('fiMap').innerHTML = `<h3 class="fp-h3">Which Column Is Which</h3><p class="lead">${(table.length - 1).toLocaleString()} rows. Check the columns FundBug picked.</p>
    <div class="row">${FP_FIELDS.map(([k, label]) => `<div><label for="fiCol-${k}">${label}</label><select id="fiCol-${k}" onchange="FP_IMPORT.map['${k}']=+this.value;document.getElementById('fiResult').innerHTML=''">
      <option value="-1">(none)</option>${head.map((x, i) => `<option value="${i}" ${map[k] === i ? 'selected' : ''}>${escHtml(x || 'Column ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
    <button class="btn" onclick="fpSendImport(false)">Check It</button>`;
}
async function fpSendImport(apply) {
  const err = document.getElementById('fiErr'), out = document.getElementById('fiResult');
  err.textContent = '';
  const m = FP_IMPORT.map;
  if (m.name < 0 && m.first < 0 && m.last < 0 && m.email < 0) { err.textContent = 'Choose the column with the name or the email.'; return; }
  let r;
  try { r = await apiFetch('/api/nonprofit/donors/import', 'POST', {rows: fpRowsFrom(FP_IMPORT.table, m), apply}); }
  catch (e) { err.textContent = e.message; return; }
  const c = r.counts;
  if (apply) {
    closePanel();
    FP_MSG = escHtml(`Imported: ${c.new_donors.toLocaleString()} new donors and ${c.gifts.toLocaleString()} gifts.`) +
      (r.left && r.left.length ? escHtml(` Left as they were, since someone changed them meanwhile: ${r.left.join(', ')}. Import the file again to add their gifts.`) : '');
    await fpLoad(FP.fiscal_year);
    return;
  }
  out.innerHTML = `<h3 class="fp-h3">What Import Will Do</h3><ul>
      <li>${c.new_donors.toLocaleString()} new donors${r.sample.length ? ' (' + r.sample.map(s => escHtml(s.name)).join(', ') + (c.new_donors > r.sample.length ? ', and more' : '') + ')' : ''}</li>
      <li>${c.gifts.toLocaleString()} gifts added</li>
      <li>${c.already_on_file.toLocaleString()} gifts already on your list, left as they are</li>
      ${c.skipped ? `<li>${c.skipped.toLocaleString()} rows not read: ${r.skipped.slice(0, 8).map(s => 'row ' + (s.row + 1) + ' (' + escHtml(s.why) + ')').join('; ')}${c.skipped > 8 ? '; and more' : ''}</li>` : ''}
    </ul><p class="lead">A donor is matched by email, else by exactly the same name; anyone else is added as a new donor.</p>
    ${c.new_donors || c.gifts ? `<button class="btn" onclick="fpSendImport(true)">Import</button>` : ''}`;
}
function fpCsvCell(v) { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function fpDownloadText(ds) {
  const lines = [['Name', 'Email', 'Phone', 'Date', 'Amount', 'Note', 'Through A DAF', 'Next Step', 'Next Step On']];
  for (const d of ds) {
    const base = [d.name, d.email, d.phone];
    if (!(d.gifts || []).length) lines.push([...base, '', '', '', '', d.next_step, d.next_step_on]);
    for (const g of d.gifts || []) lines.push([...base, g.date, g.amount, g.note, g.daf || '', d.next_step, d.next_step_on]);
  }
  return lines.map(l => l.map(fpCsvCell).join(',')).join('\r\n') + '\r\n';
}
function fpDownload() {
  const blob = new Blob([fpDownloadText(FP_DONORS.donors)], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'donors.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
