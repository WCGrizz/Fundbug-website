// A trial code on the nonprofit signup (Nov 3 2026, Will: a month-long free trial for MCN's members): the code check
// asks the nonprofit route, and the trial's length changes everywhere the page names it. Run: node nonprofit-trial-code.test.js
const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-signup.html', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = re => { const m = html.match(re); if (!m) throw new Error('not found: ' + re); return m[0]; };
const hero = html.match(/<p id="heroText">([^<]+)<\/p>/)[1];
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`const HERO_PRICED = ${JSON.stringify(hero)};\n` + grab(/function trialText\(days\)[\s\S]*?\n\}/) + '\nglobalThis.t = {trialText};', ctx);
const t30 = ctx.t.trialText(30), t14 = ctx.t.trialText(14);
ok(t30.lead === 'Your first 30 days are free. Cancel before then and you pay nothing.', 'the plan card names 30 days');
ok(t30.hero.includes('30 days free, then $45 a month') && !t30.hero.includes('14 days'), 'the headline names 30 days, nothing left at 14');
ok(/Your free trial is 30 days with this code/.test(t30.banner) && t14.banner === '', 'a banner only for a longer trial');
ok(t14.lead.includes('14 days') && t14.hero === hero, 'no code: the page reads as before');
ok(/getJson\('\/api\/nonprofit\/code\/'/.test(html) && !/\/api\/comp-code\//.test(html), 'the check asks the nonprofit code route, which knows trial codes');
ok(/Code accepted: your free trial is \$\{trialDays\} days\./.test(html), 'the note under the field says so');
ok(/id="trialLead"/.test(html), 'the plan card line can change');
process.exit(fails ? 1 : 0);
