// The Funding Plan page of the nonprofit portal (Oct 28 2026, Phase 1): a capital stack for the year, above the fields
// that fill it, and the organization's donor list. Will, after the BBEC call: "a fully customizable capital stack. a
// nonprofit can say i need x $ this year, and attribute different amounts to different sources"; "a large visual cap
// stack, traditionally rectangular, which is above all the other fillable fields". AJ (BBEC): track individual donors,
// not just foundations. The backend works out every figure (nonprofit/np_funding_plan.py); this page draws it and
// sends changes. nonprofit-portal.html loads this after its own script and supplies apiFetch, escHtml, money,
// shortMoney, showPage, openListing, MONTH_NAMES and the side panel.

let FP = null, FP_DONORS = null, FP_MSG = '', FP_DQ = '', FP_IMPORT = null;
const FP_COLORS = {earned: '#7ab870', government: '#2f5d7c', foundation: '#3d7a38', corporate: '#7a5c99',
                   individual: '#a8643a', events: '#b8901c', other: '#8a8577'};

async function openFundingPlan() {
  showPage('plan');
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
  fpDraw();
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
// One rectangle for the year: each source a band as tall as its planned amount (never shorter than what is already in
// it), filled from the left with what is secured (solid), then pending (striped), the rest still to raise (light).
// Above the bands, up to the goal, what is not yet planned (dashed). The goal is a line across.
function fpStack(v) {
  // Drawn at the phone's width on a phone, so its labels stay readable rather than shrinking to half size.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;
  const W = narrow ? 360 : 720, H = narrow ? 460 : 500, top = 30, inner = H - top - 6;
  const goal = v.goal || 0, max = Math.max(goal, v.totals.shown, 1);
  const bands = v.sources.filter(s => s.shown > 0);
  if (!bands.length && !goal) return `<div class="fp-empty">Set this year's goal and plan your sources below, and your capital stack appears here.</div>`;
  const out = [`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Your capital stack for FY${v.fiscal_year}" class="fp-stack">`, '<defs>'];
  for (const s of bands) out.push(`<pattern id="fpHatch-${s.key}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="${FP_COLORS[s.key]}" fill-opacity=".25"></rect><rect width="5" height="10" fill="${FP_COLORS[s.key]}" fill-opacity=".85"></rect></pattern>`);
  out.push('</defs>');
  out.push(`<rect x="0.5" y="${top}" width="${W - 1}" height="${inner}" style="fill:var(--white);stroke:var(--border)"></rect>`);
  let y = H - 6;
  for (const s of bands) {
    const h = s.shown / max * inner, ys = y - h, sec = Math.min(s.secured, s.shown), pen = Math.min(s.pending, s.shown - sec);
    const ws = W * sec / s.shown, wp = W * pen / s.shown, c = FP_COLORS[s.key];
    const tip = `${s.label}: ${money(s.secured)} secured, ${money(s.pending)} pending${s.pending_unknown ? ` (and ${s.pending_unknown} with no amount asked)` : ''}, ` +
      `${money(s.planned)} planned` + (s.planned && s.secured > s.planned ? ' (more than planned)' : '');
    out.push(`<g class="fp-band" data-key="${s.key}"><title>${escHtml(tip)}</title>`,
      `<rect x="0" y="${ys.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" fill="${c}" fill-opacity=".18"></rect>`,
      ws > 0 ? `<rect x="0" y="${ys.toFixed(1)}" width="${ws.toFixed(1)}" height="${h.toFixed(1)}" fill="${c}"></rect>` : '',
      wp > 0 ? `<rect x="${ws.toFixed(1)}" y="${ys.toFixed(1)}" width="${wp.toFixed(1)}" height="${h.toFixed(1)}" fill="url(#fpHatch-${s.key})"></rect>` : '',
      `<line x1="0" x2="${W}" y1="${ys.toFixed(1)}" y2="${ys.toFixed(1)}" style="stroke:var(--white);stroke-width:2"></line>`);
    // A thin band gets a smaller label; one too thin for any keeps its figures in its hover and the table below.
    if (h >= 18) out.push(`<text x="14" y="${(ys + h / 2 + (h >= 30 ? 6 : 5)).toFixed(1)}" class="fp-label${h >= 30 ? '' : ' sm'}">${escHtml(s.label)}: ${escHtml(shortMoney(s.secured))} of ${escHtml(shortMoney(s.planned || s.shown))}</text>`);
    out.push('</g>');
    y = ys;
  }
  if (goal > v.totals.shown) {
    const h = (goal - v.totals.shown) / max * inner;
    out.push(`<rect x="2" y="${(y - h + 2).toFixed(1)}" width="${W - 4}" height="${Math.max(0, h - 4).toFixed(1)}" style="fill:none;stroke:var(--muted);stroke-width:2;stroke-dasharray:8 6"></rect>`);
    if (h >= 30) out.push(`<text x="${W / 2}" y="${(y - h / 2 + 6).toFixed(1)}" text-anchor="middle" class="fp-label">Not yet planned: ${escHtml(money(goal - v.totals.shown))}</text>`);
  }
  if (goal) {
    const gy = H - 6 - goal / max * inner;
    out.push(`<line x1="0" x2="${W}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" style="stroke:var(--ink);stroke-width:3;stroke-dasharray:14 6"></line>`,
      `<text x="${W - 6}" y="${(gy - 8).toFixed(1)}" text-anchor="end" class="fp-label">Goal ${escHtml(money(goal))}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
function fpTotalsLine(v) {
  const t = v.totals, g = v.goal || 0;
  const pct = g ? Math.round(100 * t.secured / g) : null;
  return `<div class="gp-tiles">
      <div class="gp-tile"><b>${g ? money(g) : 'Not set'}</b><span>goal for FY${v.fiscal_year}</span></div>
      <div class="gp-tile"><b>${money(t.secured)}</b><span>secured${pct != null ? ` (${pct}%)` : ''}</span></div>
      <div class="gp-tile"><b>${money(t.pending)}</b><span>pending</span></div>
      <div class="gp-tile"><b>${g ? money(t.to_raise) : '—'}</b><span>still to raise</span></div>
    </div>`;
}

// ── the page ────────────────────────────────────────────────────────────
function fpDraw() {
  const v = FP; if (!v) return;
  const h = [];
  if (FP_MSG) h.push(`<div class="fp-msg">${FP_MSG}</div>`);
  h.push(`<div class="card fp-stack-card"><h2>Your Capital Stack</h2>${fpTotalsLine(v)}${fpStack(v)}
      <div class="fp-key"><span><i class="fp-k solid"></i>Secured</span><span><i class="fp-k striped"></i>Pending</span><span><i class="fp-k light"></i>Still to raise</span><span><i class="fp-k dashed"></i>Not yet planned</span></div>
      <p class="lead">Every figure is in the table below.${v.updated_by_name ? ` Last changed by ${escHtml(v.updated_by_name)}.` : ''}</p></div>`);
  const years = v.years.includes(v.fiscal_year) ? v.years : v.years.concat([v.fiscal_year]).sort();
  h.push(`<div class="card"><h2>The Plan</h2>
      <div class="row">
        <div><label for="fpYear">Fiscal Year</label><select id="fpYear" onchange="fpLoad(this.value)">${years.map(y => `<option value="${y}" ${y === v.fiscal_year ? 'selected' : ''}>${escHtml(fpYearLabel(y, v.end_month))}</option>`).join('')}</select></div>
        <div><label for="fpGoal">Goal For The Year</label><input id="fpGoal" inputmode="numeric" value="${v.goal != null ? money(v.goal) : ''}" placeholder="$" onchange="fpSaveGoal(this.value)"></div>
      </div>
      <p class="lead">Your fiscal year ends in ${MONTH_NAMES[v.end_month - 1]}; change it under Fiscal Year Ends in your <a onclick="showPage('profile')">Organization Profile</a>.${v.goal_from === 'budget' ? ' The goal is your profile\'s annual budget until you set one here.' : ''}</p>
      <div class="gp-table"><table class="fp-sources"><thead><tr><th>Source</th><th class="num">Planned</th><th class="num">Secured, Entered By You</th><th class="num">From Your Tracker And Donors</th><th class="num">Pending</th><th class="num">Still To Raise</th></tr></thead><tbody>
      ${v.sources.map(s => `<tr>
        <td><i class="fp-sw" style="background:${FP_COLORS[s.key]}"></i>${escHtml(s.label)}</td>
        <td class="num"><input class="fp-amt" inputmode="numeric" aria-label="${escHtml(s.label)} planned" value="${s.planned ? money(s.planned) : ''}" onchange="fpSaveSource('${s.key}', 'planned', this.value)"></td>
        <td class="num"><input class="fp-amt" inputmode="numeric" aria-label="${escHtml(s.label)} secured, entered by you" value="${s.secured_other ? money(s.secured_other) : ''}" onchange="fpSaveSource('${s.key}', 'secured', this.value)"></td>
        <td class="num">${s.key === 'individual' ? money(s.secured_donors) : s.from_tracker ? money(s.secured_tracker) : ''}</td>
        <td class="num">${money(s.pending)}${s.pending_unknown ? `<br>and ${s.pending_unknown} with no amount` : ''}</td>
        <td class="num">${money(Math.max(0, s.planned - s.secured))}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="lead">Foundation, government and corporate awards come from your Tracker: mark one Awarded with its amount. Individual donors come from your donor list below. Enter anything else you have secured yourself.</p>
    </div>`);
  h.push(fpAwardsCard(v));
  h.push(fpDonorsCard());
  document.getElementById('fpBody').innerHTML = h.join('');
}
function fpSourceSelect(tid, cur) {
  return `<select class="fp-sel" aria-label="Counts toward" onchange="fpSaveAward('${tid}', {source: this.value})">${['foundation', 'government', 'corporate', 'individual', 'events', 'earned', 'other']
    .map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${escHtml((FP.sources.find(s => s.key === k) || {}).label || k)}</option>`).join('')}</select>`;
}
function fpTitle(a) { return a.group_id ? `<a onclick="openListing('${a.group_id}')">${escHtml(a.title || '')}</a>` : escHtml(a.title || ''); }
function fpAwardsCard(v) {
  const h = [`<div class="card"><h2>Awards And Applications In Your Tracker</h2>`];
  if (!v.awards.length && !v.pending.length && !v.other_year_awards.length) {
    h.push(`<p class="lead">Nothing yet. When you mark a funder Submitted or Awarded in your <a onclick="showPage('tracker'); loadTracker()">Tracker</a> with its amount, it counts here.</p></div>`);
    return h.join('');
  }
  if (v.awards.length) {
    h.push(`<h3 class="fp-h3">Awarded</h3><div class="gp-table"><table><thead><tr><th>Funder Or Program</th><th class="num">Awarded</th><th>Decided</th><th>Counts Toward</th><th class="num">This Year's Share</th><th>Leave Out</th></tr></thead><tbody>
      ${v.awards.map(a => `<tr><td>${fpTitle(a)}</td><td class="num">${money(a.amount)}</td><td>${a.no_date ? 'No date in your Tracker: counted this year' : escHtml(fpDay(a.decided_on))}${a.other_year ? ' (another year)' : ''}</td>
        <td>${fpSourceSelect(a.tracking_id, a.source)}</td>
        <td class="num"><input class="fp-amt" inputmode="numeric" aria-label="This year's share" value="${a.share != null ? money(a.share) : ''}" placeholder="${escHtml(money(a.amount))}" onchange="fpSaveAward('${a.tracking_id}', {share: this.value})"></td>
        <td><input type="checkbox" aria-label="Leave out" ${a.left_out ? 'checked' : ''} onchange="fpSaveAward('${a.tracking_id}', {left_out: this.checked})"></td></tr>`).join('')}
      </tbody></table></div><p class="lead">A multi-year award: enter this year's share, and add it to each later year's plan below.</p>`);
  }
  if (v.pending.length) {
    h.push(`<h3 class="fp-h3">Submitted, Waiting To Hear</h3><div class="gp-table"><table><thead><tr><th>Funder Or Program</th><th class="num">Asked</th><th>Counts Toward</th><th>Leave Out</th></tr></thead><tbody>
      ${v.pending.map(a => `<tr><td>${fpTitle(a)}</td><td class="num">${a.amount_requested ? money(a.amount_requested) : 'No amount in your Tracker'}</td>
        <td>${fpSourceSelect(a.tracking_id, a.source)}</td>
        <td><input type="checkbox" aria-label="Leave out" ${a.left_out ? 'checked' : ''} onchange="fpSaveAward('${a.tracking_id}', {left_out: this.checked})"></td></tr>`).join('')}
      </tbody></table></div>`);
  }
  if (v.other_year_awards.length) {
    h.push(`<h3 class="fp-h3">Count An Award From Another Year</h3><div class="row">
        <div><label for="fpOther">Award</label><select id="fpOther">${v.other_year_awards.map(a => `<option value="${a.tracking_id}">${escHtml(a.title || '')}: ${escHtml(money(a.amount))}${a.decided_on ? ', ' + escHtml(fpDay(a.decided_on)) : ''}</option>`).join('')}</select></div>
        <div><label for="fpOtherShare">This Year's Share</label><input id="fpOtherShare" inputmode="numeric" placeholder="$"></div>
      </div><button class="btn ghost sm" onclick="fpAddOther()">Count It This Year</button>`);
  }
  h.push('</div>');
  return h.join('');
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
  const next = {source: cur.source !== cur.default_source ? cur.source : null, share: cur.share != null ? cur.share : null, left_out: !!cur.left_out, ...change};
  if ('share' in change) { const n = fpParse(change.share); if (Number.isNaN(n)) return fpBad("This year's share"); next.share = n; }
  if (next.source === cur.default_source) next.source = null;
  fpSave({awards: {[tid]: next.source == null && next.share == null && !next.left_out ? null : next}});
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
  return `<div class="card"><h2>Individual Donors</h2>
      <p class="lead">Your own list, seen only by your team. FundBug never shares it and never uses it to write anything. Gifts dated in FY${FP.fiscal_year} count toward Individual Donors above, and pledges not yet given count as pending.</p>
      <p>${ds.length ? `<b>${ds.length.toLocaleString()}</b> donors, <b>${money(given)}</b> given this year, <b>${money(open)}</b> pledged and still to come.` : 'No donors yet.'}</p>
      <div class="fp-actions"><button class="btn sm" onclick="fpDonorPanel(null)">Add A Donor</button><button class="btn ghost sm" onclick="fpImportPanel()">Import From A Spreadsheet</button>${ds.length ? '<button class="btn ghost sm" onclick="fpDownload()">Download As A Spreadsheet</button>' : ''}</div>
      ${ds.length > 10 ? `<input id="fpDq" class="gp-search" placeholder="Search donors" value="${escHtml(FP_DQ)}" oninput="FP_DQ=this.value;fpDraw();const i=document.getElementById('fpDq');i.focus();i.setSelectionRange(i.value.length,i.value.length)">` : ''}
      ${shown.length ? `<div class="gp-table"><table><thead><tr><th>Name</th><th class="num">Given This Year</th><th class="num">Pledged This Year</th><th>Last Gift</th><th>Next Step</th></tr></thead><tbody>
        ${shown.map(d => `<tr><td><a onclick="fpDonorPanel('${d.id}')">${escHtml(d.name)}</a></td><td class="num">${money(d.given_this_year)}</td><td class="num">${d.pledged_this_year ? money(d.pledged_this_year) : ''}</td>
          <td>${d.last_gift ? escHtml(money(d.last_gift.amount) + ', ' + fpDay(d.last_gift.date)) : ''}</td><td>${escHtml(d.next_step || '')}${d.next_step_on ? ' (' + escHtml(fpDay(d.next_step_on)) + ')' : ''}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
    </div>`;
}
function fpPanel(title, html) {
  document.getElementById('panelTitle').textContent = title;
  document.getElementById('panelBody').innerHTML = html;
  document.getElementById('panel').classList.add('open');
  document.getElementById('scrim').style.display = 'block';
}
let FP_EDIT = null;                         // the donor open in the panel, with its gifts as edited
function fpDonorPanel(id) {
  const d = id ? FP_DONORS.donors.find(x => x.id === id) : {name: '', gifts: [], pledges: {}};
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
    <h3 class="fp-h3">Gifts</h3><div id="fdGifts"></div>
    <div class="err" id="fdErr"></div>
    <div class="fp-actions"><button class="btn" onclick="fpSaveDonor()">Save</button><button class="btn ghost" onclick="closePanel()">Cancel</button>
      ${id ? `<button class="btn ghost" onclick="fpRemoveDonor('${id}')">Remove This Donor</button>` : ''}</div>`);
  fpDrawGifts();
}
function fpDrawGifts() {
  const g = FP_EDIT.gifts;
  document.getElementById('fdGifts').innerHTML = `<div class="gp-table"><table><thead><tr><th>Date</th><th class="num">Amount</th><th>Note</th><th></th></tr></thead><tbody>
    ${g.map((x, i) => `<tr><td><input type="date" aria-label="Gift date" value="${escHtml(x.date || '')}" onchange="FP_EDIT.gifts[${i}].date=this.value"></td>
      <td class="num"><input class="fp-amt" inputmode="numeric" aria-label="Gift amount" value="${x.amount ? money(x.amount) : ''}" onchange="FP_EDIT.gifts[${i}].amount=fpParse(this.value)"></td>
      <td><input aria-label="Gift note" value="${escHtml(x.note || '')}" onchange="FP_EDIT.gifts[${i}].note=this.value"></td>
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
  const lines = [['Name', 'Email', 'Phone', 'Date', 'Amount', 'Note', 'Next Step', 'Next Step On']];
  for (const d of ds) {
    const base = [d.name, d.email, d.phone];
    if (!(d.gifts || []).length) lines.push([...base, '', '', '', d.next_step, d.next_step_on]);
    for (const g of d.gifts || []) lines.push([...base, g.date, g.amount, g.note, d.next_step, d.next_step_on]);
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
