// The business portal's Capital Stack (Nov 6 2026). Run: node portal-capital-stack.test.js
const fs = require('fs'), vm = require('vm');
const js = fs.readFileSync(__dirname + '/portal-capital-stack.js', 'utf8');
const html = fs.readFileSync(__dirname + '/portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
// fundbug_capital_stack.compute's answer for a $20M project like Don Harris's (Nov 6 2026).
const view = {"project_name": "Grand Prix RaceTrack", "project_cost": 20000000, "layers": [{"key": "senior_debt", "label": "Senior Debt", "planned": 16000000, "secured_entered": 0, "pending_entered": 16000000, "secured_tracker": 0, "pending_tracker": 0, "secured": 0, "pending": 16000000, "gap": 0, "shown": 16000000, "share_of_cost": 80, "secured_share_of_layer": 0}, {"key": "second_loan", "label": "SBA 504 / Second Loan", "planned": 0, "secured_entered": 0, "pending_entered": 0, "secured_tracker": 0, "pending_tracker": 0, "secured": 0, "pending": 0, "gap": 0, "shown": 0, "share_of_cost": 0, "secured_share_of_layer": null}, {"key": "subordinate", "label": "Subordinate Or Mezzanine Debt", "planned": 0, "secured_entered": 0, "pending_entered": 0, "secured_tracker": 15000, "pending_tracker": 0, "secured": 15000, "pending": 0, "gap": 0, "shown": 15000, "share_of_cost": 0, "secured_share_of_layer": 100}, {"key": "grants", "label": "Grants And Incentives", "planned": 1000000, "secured_entered": 0, "pending_entered": 0, "secured_tracker": 0, "pending_tracker": 10000, "secured": 0, "pending": 10000, "gap": 990000, "shown": 1000000, "share_of_cost": 5, "secured_share_of_layer": 0}, {"key": "tax_credits", "label": "Tax Credits", "planned": 500000, "secured_entered": 0, "pending_entered": 0, "secured_tracker": 0, "pending_tracker": 0, "secured": 0, "pending": 0, "gap": 500000, "shown": 500000, "share_of_cost": 2, "secured_share_of_layer": 0}, {"key": "equity", "label": "Owner Equity", "planned": 2000000, "secured_entered": 500000, "pending_entered": 0, "secured_tracker": 0, "pending_tracker": 0, "secured": 500000, "pending": 0, "gap": 1500000, "shown": 2000000, "share_of_cost": 10, "secured_share_of_layer": 25}, {"key": "other", "label": "Other", "planned": 0, "secured_entered": 0, "pending_entered": 0, "secured_tracker": 0, "pending_tracker": 0, "secured": 0, "pending": 0, "gap": 0, "shown": 0, "share_of_cost": 0, "secured_share_of_layer": null}], "totals": {"planned": 19500000, "secured": 515000, "pending": 16010000, "gap": 2990000, "shown": 19515000, "project_cost": 20000000, "unplanned": 500000, "to_raise": 19485000, "secured_share": 3, "pending_share": 80, "to_raise_share": 97, "planned_share": 98}, "awards": [{"tracking_id": "a", "title": "PERC CDBG Micro-Loan", "capital_type": "Microloan", "layer": "subordinate", "default_layer": "subordinate", "left_out": false, "group_id": null, "amount": 15000}], "pending": [{"tracking_id": "b", "title": "MGCC Technical Assistance Grant", "capital_type": "Grant", "layer": "grants", "default_layer": "grants", "left_out": false, "group_id": null, "amount": 10000}], "saved": true, "updated_at": "t1", "updated_by_name": null};
const sent = [];
const ctx = {console, document: {getElementById: () => ({innerHTML: ''})}, apiFetch: async (p, m, b) => { sent.push({p, m, b}); return view; }};
vm.createContext(ctx);
vm.runInContext(js + ';globalThis.t = {csStack, csTiles, csTable, csAwards, csParse, csShort}; globalThis.setCS = v => { CS = v; };', ctx);
const t = ctx.t;
const st = t.csStack(view);
const order = [...st.matchAll(/<b><i class="cs-dot"[^>]*><\/i>([^<]+)<\/b>/g)].map(m => m[1]);
ok(order[0] === 'Senior Debt' && order[order.length - 1] === 'Owner Equity' && /flex-direction:column-reverse/.test(fs.readFileSync(__dirname + '/portal.html', 'utf8')),
   'senior debt is drawn first, at the bottom, and equity last, at the top');
ok(st.includes('Senior Debt</b> · $16M · <b>80%</b> of the project') && st.includes('Owner Equity</b> · $2M · <b>10%</b> of the project'), 'each layer gives its share of the project');
ok(st.includes('$0 secured, $16M pending') && st.includes('$500K secured, $1.5M to find'), 'and what is secured, pending and still to find');
ok(!/<div class="cs-block">[^<]*[A-Za-z$]/.test(st), 'no words on the colored blocks');
const tiles = t.csTiles(view);
ok(tiles.includes('$20,000,000') && tiles.includes('secured (3%)') && tiles.includes('pending (80%)') && tiles.includes('still to raise (97%)'), 'the tiles give shares of the project');
const table = t.csTable(view);
ok(table.indexOf('Owner Equity') < table.indexOf('Senior Debt') && table.includes('$15,000') && table.includes('$10,000 pending'), 'the table lists top to bottom, with the Tracker\'s award and application');
ok(t.csAwards(view).includes('PERC CDBG Micro-Loan') && t.csAwards(view).includes('Pending'), 'the Tracker\'s awards and applications can be moved or left out');
ok(t.csStack({...view, layers: view.layers.map(l => ({...l, shown: 0})), totals: {...view.totals, shown: 0}}).includes('Enter your total project cost'), 'an empty stack says how to start');
ok(t.csParse('$1,500') === 1500 && t.csParse('') === 0 && Number.isNaN(t.csParse('abc')), 'amounts read as dollars');
ok(/<a href="#" onclick="showPage\('capstack',this\)" id="nav-capstack">/.test(html) && /id="page-capstack"/.test(html) && html.includes('/portal-capital-stack.js')
   && html.includes("if (id === 'capstack' && typeof loadCapStack === 'function') loadCapStack();"), 'the portal has the page, its link and its script');
(async () => {
  ctx.setCS(view);
  vm.runInContext("csSaveLayer('equity', 'secured', '$750,000')", ctx);
  await new Promise(r => setTimeout(r, 0));
  ok(sent.length === 1 && sent[0].m === 'PATCH' && JSON.stringify(sent[0].b.layers) === JSON.stringify({equity: {planned: 2000000, secured: 750000, pending: 0}}) && sent[0].b.updated_at === 't1',
     'a change sends only its layer, with the stack as read');
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
