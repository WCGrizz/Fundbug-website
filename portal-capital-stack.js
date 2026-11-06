// The business portal's Capital Stack (Nov 6 2026, Will: "convert the funding plan section to be more like a
// traditional capital stack when its for for-profit subscribers"). One project's financing drawn as lenders draw it,
// senior debt at the bottom and owner equity at the top, each layer with its share of the total project cost and what
// is secured (solid), pending (striped) and still to find (light). Names and figures sit beside the stack, never on
// color. Backend: fundbug_capital_stack.py, GET and PATCH /api/portal/capital-stack.

const CS_COLORS = {senior_debt: '#2f5d7c', second_loan: '#5b86a8', subordinate: '#7a5c99', grants: '#3d7a38',
                   tax_credits: '#7ab870', equity: '#a8643a', other: '#8a8577'};
let CS = null, CS_MSG = '';

function csMoney(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }
function csShort(n) {
  n = n || 0;
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
  return '$' + n;
}
function csPct(p) { return p == null ? '' : p + '%'; }
function csParse(v) { const s = String(v || '').replace(/[$,\s]/g, ''); return s === '' ? 0 : Number(s); }
function csEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c])); }

async function loadCapStack() {
  const box = document.getElementById('csBody');
  if (!CS) box.innerHTML = '<div class="cs-empty">Loading…</div>';
  try { CS = await apiFetch('/api/portal/capital-stack'); }
  catch (e) { box.innerHTML = `<div class="cs-empty">${csEsc(e.message)}</div>`; return; }
  csDraw();
}

// The stack itself: one block per layer with money in it, bottom to top, its height its share of the project.
function csStack(v) {
  const layers = v.layers.filter(l => l.shown > 0);
  const cost = v.project_cost || 0, whole = Math.max(cost, v.totals.shown, 1);
  if (!layers.length) return '<div class="cs-empty">Enter your total project cost and plan each layer below, and your capital stack appears here.</div>';
  const unplanned = cost > v.totals.shown ? cost - v.totals.shown : 0;
  // Each layer at least tall enough for its two lines; its share of the project is in its words (Nov 6 2026).
  const H = 460, h = n => Math.max(52, Math.round(H * n / whole));
  const blocks = layers.map(l => {
    const c = CS_COLORS[l.key], base = Math.max(l.planned, l.shown, 1);
    const sec = Math.min(l.secured, base), pen = Math.min(l.pending, base - sec);
    return `<div class="cs-layer" style="height:${h(l.shown)}px" title="${csEsc(`${l.label}: ${csMoney(l.secured)} secured, ${csMoney(l.pending)} pending, ${csMoney(l.planned)} planned`)}">
        <div class="cs-block"><i style="width:${(100 * sec / base).toFixed(1)}%;background:${c}"></i>${pen > 0 ? `<i class="cs-pend" style="width:${(100 * pen / base).toFixed(1)}%;--c:${c}"></i>` : ''}</div>
        <div class="cs-side"><span><b><i class="cs-dot" style="background:${c}"></i>${csEsc(l.label)}</b> · ${csShort(l.planned || l.shown)}${l.share_of_cost != null ? ` · <b>${csPct(l.share_of_cost)}</b> of the project` : ''}</span>
          <span>${csShort(l.secured)} secured${l.pending ? `, ${csShort(l.pending)} pending` : ''}${l.gap ? `, ${csShort(l.gap)} to find` : ''}</span></div></div>`;
  });
  if (unplanned) blocks.push(`<div class="cs-layer" style="height:${h(unplanned)}px"><div class="cs-block cs-unplanned"></div>
      <div class="cs-side"><span><b>Not Yet Planned</b> · ${csShort(unplanned)}${cost ? ` · <b>${csPct(Math.round(100 * unplanned / cost))}</b> of the project` : ''}</span></div></div>`);
  // Bottom to top: the column is reversed, so senior debt sits at the base.
  return `<div class="cs-stack" role="img" aria-label="${csEsc(`Capital stack: ${csMoney(v.totals.secured)} secured of ${csMoney(cost || v.totals.shown)}`)}">${blocks.join('')}</div>`;
}

function csTiles(v) {
  const t = v.totals;
  return `<div class="cs-tiles">
      <div class="cs-tile"><b>${t.project_cost ? csMoney(t.project_cost) : 'Not set'}</b><span>total project cost</span></div>
      <div class="cs-tile"><b>${csMoney(t.secured)}</b><span>secured${t.secured_share != null ? ` (${t.secured_share}%)` : ''}</span></div>
      <div class="cs-tile"><b>${csMoney(t.pending)}</b><span>pending${t.pending_share != null ? ` (${t.pending_share}%)` : ''}</span></div>
      <div class="cs-tile"><b>${t.project_cost ? csMoney(t.to_raise) : '—'}</b><span>still to raise${t.to_raise_share != null ? ` (${t.to_raise_share}%)` : ''}</span></div>
    </div>`;
}

function csTable(v) {
  return `<div class="cs-table"><table><thead><tr><th>Layer</th><th class="num">Planned</th><th class="num">Share Of Project</th>
      <th class="num">Secured, Entered By You</th><th class="num">Pending, Entered By You</th><th class="num">From Your Tracker</th><th class="num">Still To Find</th></tr></thead><tbody>
    ${v.layers.slice().reverse().map(l => `<tr><td><i class="cs-dot" style="background:${CS_COLORS[l.key]}"></i>${csEsc(l.label)}</td>
      <td class="num"><input class="cs-amt" inputmode="numeric" aria-label="${csEsc(l.label)} planned" value="${l.planned ? csMoney(l.planned) : ''}" onchange="csSaveLayer('${l.key}', 'planned', this.value)"></td>
      <td class="num">${csPct(l.share_of_cost)}</td>
      <td class="num"><input class="cs-amt" inputmode="numeric" aria-label="${csEsc(l.label)} secured" value="${l.secured_entered ? csMoney(l.secured_entered) : ''}" onchange="csSaveLayer('${l.key}', 'secured', this.value)"></td>
      <td class="num"><input class="cs-amt" inputmode="numeric" aria-label="${csEsc(l.label)} pending" value="${l.pending_entered ? csMoney(l.pending_entered) : ''}" onchange="csSaveLayer('${l.key}', 'pending', this.value)"></td>
      <td class="num">${l.secured_tracker || l.pending_tracker ? `${csMoney(l.secured_tracker)}${l.pending_tracker ? `<br>${csMoney(l.pending_tracker)} pending` : ''}` : ''}</td>
      <td class="num">${csMoney(l.gap)}${l.planned ? `<br>${csPct(Math.round(100 * l.gap / l.planned))} of planned` : ''}</td></tr>`).join('')}
    </tbody>${csTotalRow(v)}</table></div>`;
}

// Each column summed (Nov 6 2026, Will: "the columns should show total amounts").
function csTotalRow(v) {
  const L = v.layers, sum = f => L.reduce((a, l) => a + (l[f] || 0), 0), t = v.totals;
  return `<tfoot><tr class="cs-total"><td><b>Total</b></td><td class="num"><b>${csMoney(t.planned)}</b></td><td class="num"><b>${csPct(t.planned_share)}</b></td>
      <td class="num"><b>${csMoney(sum('secured_entered'))}</b></td><td class="num"><b>${csMoney(sum('pending_entered'))}</b></td>
      <td class="num"><b>${csMoney(sum('secured_tracker'))}</b>${sum('pending_tracker') ? `<br>${csMoney(sum('pending_tracker'))} pending` : ''}</td>
      <td class="num"><b>${csMoney(t.gap)}</b></td></tr></tfoot>`;
}
function csAwards(v) {
  const rows = v.awards.map(a => ({...a, kind: 'Awarded'})).concat(v.pending.map(a => ({...a, kind: 'Pending'})));
  if (!rows.length) return '<p class="cs-lead">Nothing yet. When you mark a program Awarded in My Tracker with its amount, or Submitted with the amount you asked for, it counts in its layer here.</p>';
  const opts = cur => v.layers.map(l => `<option value="${l.key}" ${l.key === cur ? 'selected' : ''}>${csEsc(l.label)}</option>`).join('');
  return `<div class="cs-table"><table><thead><tr><th>From My Tracker</th><th></th><th class="num">Amount</th><th>Counts Toward</th><th>Leave Out</th></tr></thead><tbody>
    ${rows.map(a => `<tr><td>${csEsc(a.title || '')}</td><td>${a.kind}</td><td class="num">${csMoney(a.amount)}</td>
      <td><select aria-label="Counts toward" onchange="csSaveAward('${a.tracking_id}', {layer: this.value})">${opts(a.layer)}</select></td>
      <td><input type="checkbox" aria-label="Leave it out" ${a.left_out ? 'checked' : ''} onchange="csSaveAward('${a.tracking_id}', {left_out: this.checked})"></td></tr>`).join('')}
    </tbody></table></div>`;
}

function csDraw() {
  const v = CS; if (!v) return;
  document.getElementById('csBody').innerHTML = `${CS_MSG ? `<div class="cs-msg">${CS_MSG}</div>` : ''}
    <div class="card"><div class="card-title">The Project</div>
      <div class="cs-row"><div><label for="csName">Project Name</label><input id="csName" value="${csEsc(v.project_name)}" placeholder="e.g. A new facility" onchange="csSave({project_name: this.value})"></div>
        <div><label for="csCost">Total Project Cost</label><input id="csCost" inputmode="numeric" value="${v.project_cost ? csMoney(v.project_cost) : ''}" placeholder="$" onchange="csSaveCost(this.value)"></div></div>
      ${csTiles(v)}</div>
    <div class="card"><div class="card-title">Your Capital Stack</div>${csStack(v)}
      <div class="cs-key"><span><i class="cs-k"></i>Secured</span><span><i class="cs-k cs-k-pend"></i>Pending</span><span><i class="cs-k cs-k-gap"></i>Still to find</span><span><i class="cs-k cs-k-dash"></i>Not yet planned</span></div>
      <p class="cs-lead">Senior debt sits at the bottom, repaid first; owner equity at the top. Each layer's height is its share of the total project cost.${v.updated_by_name ? ` Last changed by ${csEsc(v.updated_by_name)}.` : ''}</p></div>
    <div class="card"><div class="card-title">The Layers</div>${csTable(v)}
      <p class="cs-lead">Plan how much each layer covers; together they should reach your total project cost. Enter anything already committed under Secured, and offers or applications under Pending. Awards in My Tracker add to their layer by themselves.</p></div>
    <div class="card"><div class="card-title">Awards And Applications In My Tracker</div>${csAwards(v)}</div>`;
}

async function csSave(changes) {
  CS_MSG = '';
  try { CS = await apiFetch('/api/portal/capital-stack', 'PATCH', {...changes, updated_at: CS && CS.updated_at}); }
  catch (e) { CS_MSG = csEsc('Not saved: ' + e.message); }
  csDraw();
}
function csSaveCost(raw) {
  const n = csParse(raw);
  if (Number.isNaN(n) || n < 0) { CS_MSG = 'The total project cost must be an amount in dollars.'; csDraw(); return; }
  csSave({project_cost: n});
}
function csSaveLayer(key, field, raw) {
  const n = csParse(raw);
  if (Number.isNaN(n) || n < 0) { CS_MSG = 'Each amount must be in dollars.'; csDraw(); return; }
  const l = CS.layers.find(x => x.key === key) || {};
  const cur = {planned: l.planned || 0, secured: l.secured_entered || 0, pending: l.pending_entered || 0};
  cur[field] = n;
  csSave({layers: {[key]: cur}});
}
function csSaveAward(tid, change) {
  const a = CS.awards.concat(CS.pending).find(x => x.tracking_id === tid) || {};
  csSave({awards: {[tid]: {layer: a.layer, left_out: a.left_out, ...change}}});
}
