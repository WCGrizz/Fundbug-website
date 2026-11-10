// Its trustees on the funder page (Nov 3 2026). Run: node nonprofit-trustees.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext([grab(/function escHtml\([\s\S]*?\n\}/), grab(/function line\(title, html\).*/), grab(/function trusteesLine\(t\)[\s\S]*?\n\}/), 'globalThis.f = trusteesLine;'].join('\n'), ctx);
const h = ctx.f({year: '2025', family_run: true, people: [{name: 'Alice L Flint', title: 'Trustee', funds_it: true}, {name: 'Jonathan A Flint', title: 'Trustee', funds_it: false}]});
ok(h.includes('<h4>Its Trustees</h4>') && h.includes('A family foundation: its trustees decide its grants.'), 'a family foundation is said so');
ok(h.includes('<b>Alice L Flint</b>, Trustee <span class="badge">Funds It</span>') && h.includes('From its 2025 Form 990-PF.'), 'names, titles, who funds it, and the source');
ok(ctx.f({year: '2024', family_run: false, people: [{name: 'A B', title: '', funds_it: false}]}).includes('It funds through relationships'), 'an invitation-only funder is said so');
ok(ctx.f(null) === '' && ctx.f({people: []}) === '', 'no trustees: no line');
ok(/put\('contact', trusteesLine\(L\.trustees\)\);/.test(html), 'the funder page shows it, under People And Contact');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
