// Narrow It Down's groups are labelled (Will, Oct 20 2026: "the categories should be labelled"): each group has a
// Title Case heading, then "All Of <the area>" (the broad choice), then the narrower choices. Run: node nonprofit-narrow.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/nonprofit-choices.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const grab = name => src.match(new RegExp('function ' + name + '\\(([\\s\\S]*?)\\n}'))[0];
const ctx = {picks: {populations: new Set(['PA010400'])}, CATS: [{label: 'Arts And Culture', codes: ['SA']}],
  catOn: () => false, plainDefinition: d => d || '', escHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  termOf: (f, c) => ({code: c, label: 'Children and youth', definition: ''})};
vm.createContext(ctx);
vm.runInContext([grab('pill'), src.match(/function catPill[^\n]+/)[0], src.match(/function choiceTitle[^\n]+/)[0], grab('groupHtml')].join('\n')
  + '\n;globalThis.__t = {titleCase: choiceTitle, groupHtml};', ctx);
const t = ctx.__t;
ok(t.titleCase('Children and youth') === 'Children And Youth', 'a heading is in Title Case');
ok(t.titleCase('LGBTQIA+ people') === 'LGBTQIA+ People', 'capitals already in a word are kept');
const pop = t.groupHtml('populations', {code: 'PA010000', label: 'Children and youth', kids: [{code: 'PA010400', label: 'Adolescents'}]});
ok(/<p class="group-label">Children And Youth<\/p>/.test(pop), 'the group has a heading that is not a choice');
ok(/>All Of Children And Youth<\/button>/.test(pop), 'the broad choice reads All Of <the area>');
ok(/aria-pressed="true"[^>]*>Adolescents</.test(pop), 'the narrower choices follow, as picked');
const subj = t.groupHtml('subjects', {cat: 0, label: 'Arts And Culture', kids: []});
ok(/group-label">Arts And Culture</.test(subj) && />All Of Arts And Culture</.test(subj), 'a subject area is labelled the same way');
const more = t.groupHtml('populations', {code: null, label: 'More Choices', kids: [{code: 'PJ070000', label: 'Veterans'}]});
ok(/group-label">More Choices</.test(more) && !/All Of/.test(more), 'More Choices has a heading and no All Of chip');
ok(/narrowGroups\(field, terms\)\.map\(g => groupHtml\(field, g\)\)/.test(src), 'Narrow It Down draws its groups with groupHtml');
process.exit(fails ? 1 : 0);
