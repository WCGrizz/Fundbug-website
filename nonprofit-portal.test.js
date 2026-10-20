// The nonprofit portal's helpers (Oct 19 2026): Why It May Fit spoken to the organization, typical grants rounded as
// the digest rounds them, a page's stale address cleared, NY Prequalified only for New York, new matches since the
// last visit, what is due in 30 days, the optional detail compared as the server stores it, Where You Work kept whole,
// and the pickers shared with the signup. Runs without a browser:  node nonprofit-portal.test.js
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/nonprofit-portal.html', 'utf8');
const shared = fs.readFileSync(__dirname + '/nonprofit-choices.js', 'utf8');
const drafting = fs.readFileSync(__dirname + '/nonprofit-drafting.js', 'utf8');
const landscape = fs.readFileSync(__dirname + '/nonprofit-landscape.js', 'utf8');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? '' : `  (got ${JSON.stringify(a)})`));

const a = html.indexOf('// ── PORTAL HELPERS START'), b = html.indexOf('// ── PORTAL HELPERS END');
const sa = shared.indexOf('// ── CHOICE HELPERS START'), sb = shared.indexOf('// ── CHOICE HELPERS END');
ok(a > 0 && b > a && sa >= 0 && sb > sa, 'the portal and the shared file mark their helpers');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(shared.slice(sa, sb) + '\n' + html.slice(a, b) +
  '\n;globalThis.__t = {toSecondPerson, round2, typicalText, staleHash, worksInNY, newSince, daysUntil, dueSoon, pruneDetails, sameDetails, withArticle, regionLabel, whereFrom, regionsForProfile, regionsFor, teamRows, seatLine, seatsFull, fullMessage};', ctx);
const t = ctx.__t;

// E. Why It May Fit: the fit judge's first person, spoken to the organization.
eq(t.toSecondPerson('It funds youth arts in our region, which we serve.'), 'It funds youth arts in your region, which you serve.', 'our region and we serve become your region and you serve');
eq(t.toSecondPerson('We run food programs; the money is for us, and the choice is ours.'), 'You run food programs; the money is for you, and the choice is yours.', 'We, us and ours, with the capital kept');
eq(t.toSecondPerson('Our county is named. OUR work fits.'), 'Your county is named. YOUR work fits.', 'Our and OUR keep their case');
eq(t.toSecondPerson("We're eligible and we've applied; trust, house and flour stay."), "You're eligible and you've applied; trust, house and flour stay.", 'whole words only (trust, house, flour untouched; we\'re and we\'ve change)');
eq(t.toSecondPerson('Grants across the US for organizations like ours.'), 'Grants across the US for organizations like yours.', 'an all-capital US is the United States');
eq(t.toSecondPerson(null), '', 'nothing stays nothing');
ok(/Why It May Fit/.test(html) && /toSecondPerson\(m\.verdict_reason\)/.test(html) && !/Our Read/.test(html), 'the card says Why It May Fit, through the conversion, and never Our Read');
ok(/m\.verdict === 'no' \? 'Why It May Not Fit'/.test(html), 'a "no" verdict is labelled Why It May Not Fit');

// F. Typical Grant rounded as the digest rounds it (np_digest._round2: two significant figures, half to even).
eq([32856, 30180, 10000, 99, 150, 250, 125, 135, 2500, 3500, 1234567].map(t.round2), [33000, 30000, 10000, 99, 150, 250, 120, 140, 2500, 3500, 1200000],
   'two significant figures, an exact half to the even figure as Python rounds');
eq(t.typicalText(10000, 30180), '$10,000 to $30,000', 'a range');
eq(t.typicalText(32856, 32856), '$33,000', 'one figure when both ends round the same');
eq(t.typicalText(null, 4870), '$4,900', 'one end only');
eq(t.typicalText(null, null), '', 'none');
ok((html.match(/typicalText\(/g) || []).length >= 3, 'the Library card and the listing panel both use it');

// G. The address bar: a page's own hash goes when another page opens; digest links are left for the start to carry out.
ok(t.staleHash('#answers', 'profile') && t.staleHash('#answers', 'matches') && !t.staleHash('#answers', 'answers'), '#answers clears off any other page');
ok(t.staleHash('#prep/abc', 'answers') && !t.staleHash('#prep/abc', 'prep'), '#prep/<id> clears off any page but Prep');
ok(!t.staleHash('#listing=0b9b4c3e-1111-2222-3333-444455556666', 'profile') && !t.staleHash('#save=x', 'profile') && !t.staleHash('#tracker', 'profile') && !t.staleHash('', 'profile'),
   'digest links (#listing=, #save=, #tracker) and no hash are left alone');
ok(/function showPage\(id\) \{\n  if \(staleHash\(location\.hash, id\)\) history\.replaceState\(null, '', location\.pathname\);/.test(html), 'showPage clears a stale hash first');

// D. NY Prequalified only for an organization that works in New York.
ok(t.worksInNY('NY', '', []) && t.worksInNY('', '12201', []) && t.worksInNY('', '00501', []), 'a New York address (state or ZIP)');
ok(t.worksInNY('MA', '01201', [{type: 'state', value: 'NY'}]) && t.worksInNY('MA', '01201', [{type: 'county', state: 'NY', fips: '36021'}]), 'New York under Where You Work');
ok(!t.worksInNY('MA', '01201', [{type: 'national'}, {type: 'state', value: 'VT'}]), 'not for a Massachusetts organization, nationwide included');
ok(/<div id="nyBox" hidden>/.test(html), 'the box starts hidden');

// A. New matches since the last visit, and what is due in 30 days.
eq(t.newSince(['a', 'b', 'c'], ['a']), ['b', 'c'], 'what fits now and did not then');
ok(t.newSince(['a'], null) === null, 'a first visit has nothing to compare');
const TR = [{program_id: 'p1', group_id: 'g1', title: 'Soon Fund', days_until_deadline: 12},
            {program_id: 'p2', group_id: 'g2', title: 'Later Fund', days_until_deadline: 45},
            {program_id: 'p3', title: 'Call Back', follow_up_date: '2026-10-25'},
            {program_id: 'p4', title: 'Overdue Call', follow_up_date: '2026-10-01'},
            {program_id: 'p5', group_id: 'g5', title: 'Past', days_until_deadline: -2},
            {program_id: 'p6', group_id: 'g6', title: 'Seen Only', days_until_deadline: 3, seen_in_digest: true}];
const LIB = [{id: 'g1', fits: true, kind: 'opportunity', title: 'Soon Fund', deadline_date: '2026-10-31'},
             {id: 'g7', fits: true, kind: 'opportunity', title: 'Open Call', deadline_date: '2026-11-10'},
             {id: 'g8', fits: false, kind: 'opportunity', title: 'Not A Fit', deadline_date: '2026-10-30'},
             {id: 'g9', fits: true, not_for_you: true, kind: 'opportunity', title: 'Judged No', deadline_date: '2026-10-30'},
             {id: 'g10', fits: true, kind: 'opportunity', title: 'Far Off', deadline_date: '2027-03-01'},
             {id: 'g11', fits: true, kind: 'funder', title: 'A Funder', deadline_date: '2026-10-30'}];
eq(t.dueSoon(TR, LIB, '2026-10-19').map(d => [d.where, d.title, d.what, d.days]),
   [['tracker', 'Overdue Call', 'follow_up', -18], ['tracker', 'Call Back', 'follow_up', 6], ['tracker', 'Soon Fund', 'deadline', 12], ['library', 'Open Call', 'deadline', 22]],
   'Tracker deadlines and follow-ups, then fitting Library opportunities, soonest first; none passed, far off, unfit or already tracked');
eq(t.daysUntil('2026-11-18', '2026-10-19'), 30, 'days are counted by date');
ok(/if \(!routed\) showPage\('profile'\);/.test(html) && /showPage\('profile'\);\s+\/\/ the profile first/.test(html), 'an account and the preview both open on the Organization Profile');
ok(/<div class="card acct-only" id="pfMeterCard">/.test(html) && /renderMeter\(PROFILE_METER, 'pf'\)/.test(html) && /function renderMeter\(p, prefix\)/.test(drafting),
   'the profile carries the drafting meter, fed by the same reply');

// B. The optional detail compares as the server stores it, so an untouched form sends nothing.
eq(t.pruneDetails({contact: {street: ' 1 Main St ', city: ''}, leadership: {led_by: []}, programs: [{}, {name: 'Choir'}], impact: {served_last_year: null}}),
   {contact: {street: '1 Main St'}, programs: [{name: 'Choir'}]}, 'empty values, rows and sections are left out, text trimmed');
ok(t.sameDetails({contact: {city: 'Lee', street: '1 Main'}}, {contact: {street: '1 Main', city: 'Lee', zip: ''}}), 'the same detail in another order is unchanged');
ok(t.sameDetails({}, null) && !t.sameDetails({mission: {mission: 'x'}}, {}), 'nothing equals nothing; something new is a change');
for (const sec of ['Contact And Address', 'Leadership', 'Mission And Programs', 'Finances', 'Registrations', 'Impact And History', 'Past Funders'])
  ok(new RegExp(`<details class="sec[^"]*" id="det-[a-z_]+"><summary>${sec}<`).test(html), `a collapsible ${sec} section`);
ok(/addDetailRow\('programs'\)/.test(html) && /addDetailRow\('past_funders'\)/.test(html), 'programs and past funders have a row editor');

// 0. The signup's kinds, the 10,000 characters, and Nationwide.
ok(/const NONPROFIT_ORG_TYPES = \[[^\]]*'individual'/.test(html), 'an individual stays in the nonprofit portal');
ok(/<select id="fOrgType">[\s\S]*?<option value="individual">Individual \(artist, musician, writer\)<\/option>/.test(html), 'Individual is a kind in the profile');
ok(/individual: 'individual artist, musician or writer'/.test(html) && t.withArticle('individual artist') === 'An individual artist', 'orgLabel names an individual, with "An"');
ok(/<textarea id="fAbout"[^>]*maxlength="10000"/.test(html), 'About Your Organization takes 10,000 characters');
eq(t.regionLabel({type: 'national'}), 'Nationwide', 'Nationwide in the summary, not "undefined, undefined"');
eq(t.regionLabel({type: 'county', state: 'MA', fips: '25003'}, f => f === '25003' ? 'Berkshire County' : f), 'Berkshire County, MA', 'a county by name');
eq(t.regionLabel({type: 'state', value: 'VT'}, null, c => c === 'VT' ? 'Vermont' : c), 'All of Vermont', 'a whole state by name');
// Where You Work: the four modes from stored regions, and back, with nothing dropped.
const back = rs => JSON.stringify(t.regionsForProfile(t.whereFrom(rs)));
for (const rs of [[{type: 'county', state: 'MA', fips: '25003'}], [{type: 'state', value: 'MA'}], [{type: 'state', value: 'MA'}, {type: 'state', value: 'NY'}],
                  [{type: 'national'}], [{type: 'national'}, {type: 'state', value: 'NY'}],
                  [{type: 'county', state: 'MA', fips: '25003'}, {type: 'state', value: 'VT'}], [{type: 'national'}, {type: 'county', state: 'MA', fips: '25003'}]])
  ok(JSON.stringify([...JSON.parse(back(rs))].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))) ===
     JSON.stringify([...rs].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))), 'Where You Work keeps ' + JSON.stringify(rs));
eq(['county', 'statewide', 'several', 'national', 'county'].map((m, i) => t.whereFrom([[{type: 'county', state: 'MA', fips: '25003'}], [{type: 'state', value: 'MA'}],
   [{type: 'state', value: 'MA'}, {type: 'state', value: 'NY'}], [{type: 'national'}], []][i]).mode), ['county', 'statewide', 'several', 'national', 'county'], 'each opens in its own mode');
ok(['county', 'statewide', 'several', 'national'].every(m => html.includes(`data-mode="${m}"`)) && /My County Or Towns[\s\S]*Statewide[\s\S]*Several States[\s\S]*Nationwide/.test(html),
   'the profile offers the signup\'s four choices');

// C. The pickers are the signup's, from the shared file; no Candid anywhere in the portal.
// Each local script carries a version tag (Oct 19 2026: the browser kept a 4-hour-old nonprofit-drafting.js beside
// the new page and the profile meter stuck on Loading). Change the tag whenever the script changes.
ok([...html.matchAll(/<script src="(\/[^"]+)"/g)].every(m => /\?v=[\w-]+$/.test(m[1])), 'the portal\'s own scripts carry a version tag');
ok(/<script src="\/nonprofit-choices\.js\?v=[\w-]+"><\/script>\s*<script>/.test(html), 'the portal loads the shared pickers before its own script');
ok(!/function (searchTerms|narrowGroups|regionsFor|drawPicker|buildPicker)\b|const CATS\b/.test(html), 'the portal keeps no copy of its own');
ok(['subjects', 'populations', 'funding_purposes'].every(f => html.includes(`<div class="picker" id="pk-${f}"></div>`)), 'the three pickers have their boxes');
ok(!/candid/i.test(html + drafting + landscape) && !/pcsCredit|TERMS\.credit/.test(html), 'no mention of Candid, and no credit line');

// The shared picker draws in a page: search, broad choices, Suggested For You, You Picked (a stand-in document).
const els = {};
const el = id => els[id] || (els[id] = {id, innerHTML: '', hidden: false, value: '', textContent: '', attrs: {}, listeners: {},
  setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { this.listeners[k] = f; }});
const page = {document: {getElementById: el}, TERMS: {subjects: [{code: 'SA000000', label: 'Arts and culture', tier: 1, definition: ''},
  {code: 'SA030000', label: 'Performing arts', tier: 2, parent: 'SA000000', definition: 'Theater. Can' + 'did uses it.'}], populations: [], funding_purposes: []},
  picks: {subjects: new Set(['SA030000']), populations: new Set(), funding_purposes: new Set()}, changed: []};
vm.createContext(page);
vm.runInContext('function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c])); }\n' +
  'var TERMS = this.TERMS, picks = this.picks;\nfunction onPicksChanged(f) { changed.push(f); }\n' + shared +
  '\n;buildPicker("subjects"); drawPicker("subjects"); globalThis.__p = {suggested, togglePick, drawPicker};', page);
ok(/data-cat="0"/.test(els['bd-subjects'].innerHTML) && els['sg-subjects'].hidden, 'the broad choices show, Suggested For You hides when empty');
ok(/You Picked:<\/b> Performing arts/.test(els['pp-subjects'].innerHTML), 'You Picked names what is chosen');
page.__p.suggested.subjects = ['SA030000']; page.__p.drawPicker('subjects');
ok(!els['sg-subjects'].hidden && /Suggested For You/.test(els['sg-subjects'].innerHTML) && !/Can.?did/i.test(els['sg-subjects'].innerHTML), 'Suggested For You shows its terms, the publisher\'s sentence left out');
els['q-subjects'].value = 'music'; page.__p.drawPicker('subjects');
ok(!els['rs-subjects'].hidden && /Performing arts/.test(els['rs-subjects'].innerHTML) && els['bd-subjects'].hidden, 'the search shows matches in place of the broad choices');
page.__p.togglePick('subjects', 'SA030000');
ok(!page.picks.subjects.has('SA030000') && page.changed.join() === 'subjects', 'a pick changes the set and tells the page (the profile marks it unsaved)');

// H. Team (Oct 19 2026): the people on the account, the owner first; the seat count as the server counts it; only the
// owner invites and removes; a teammate opens the nonprofit portal from an invite, routed on the ACCOUNT's kind.
const SEATS = {your_role: 'owner', seats_used: 2, seats_allowed: 2, seats_available: 0, members: [
  {id: '11111111-1111-1111-1111-111111111111', member_name: 'Kevin Pink', member_email: 'kpink@x.org', role: 'member', status: 'active', receives_digest: true, is_you: false},
  {id: '22222222-2222-2222-2222-222222222222', member_name: 'Gone', member_email: 'gone@x.org', role: 'member', status: 'revoked', receives_digest: true},
  {id: '33333333-3333-3333-3333-333333333333', member_name: '', member_email: 'new@x.org', role: 'member', status: 'invited', receives_digest: false}]};
const OWNER = {first_name: 'Ben', last_name: 'Lamb', email: 'blamb@x.org'};
eq(t.teamRows(SEATS, OWNER).map(r => [r.role, r.name || r.email, r.invited, r.digest, r.you]),
   [['Owner', 'Ben Lamb', false, true, true], ['Member', 'Kevin Pink', false, true, false], ['Member', 'new@x.org', true, false, false]],
   'the owner first (from the account), then members; a removed one never');
const withOwnerRow = {...SEATS, your_role: 'member', members: [{id: 'o', member_name: 'Owner Row', member_email: 'o@x.org', role: 'owner', status: 'active', receives_digest: true}, SEATS.members[0]]};
eq(t.teamRows(withOwnerRow, OWNER).map(r => r.name), ['Owner Row', 'Kevin Pink'], 'an owner row of its own is never shown twice');
eq(t.seatLine(SEATS), '2 of 2 seats in use', 'the seat count');
ok(t.seatsFull(SEATS) && !t.seatsFull({seats_available: 1}), 'full when no seat is free');
ok(t.fullMessage(SEATS).startsWith('Your plan includes 2 seats and all are in use.') && !/ [-—] /.test(t.fullMessage(SEATS)), "the cap's message, no dash mid-sentence");
ok(/<a data-page="subscription" class="acct-only owner-only"[^>]*>Subscription<\/a>\s*<a data-page="team" class="acct-only" onclick="showPage\('team'\); loadTeam\(\)">Team<\/a>/.test(html),
   'Team is its own sidebar item after Subscription, and Subscription is the owner\'s only');
ok(/body\.member \.owner-only\{display:none\}/.test(html) && /<div class="card owner-only" id="inviteCard">/.test(html), 'a teammate sees the list only: no invite form');
ok(/document\.body\.classList\.toggle\('member', !owner\)/.test(html) && /setRole\(ACCOUNT\.you\);/.test(html), 'the role comes from /api/nonprofit/me');
ok(/owner && !r\.owner && \/\^\[0-9a-f-\]\{36\}\$\/\.test\(r\.id \|\| ''\) \? `<button/.test(html), 'only the owner gets a Remove button, never on the owner');
ok(/Gets The Digest By Email/.test(html) && /receives_digest: document\.getElementById\('tmDigest'\)\.checked/.test(html), 'the invite asks whether they get the digest');
const modal = html.match(/<div class="modal-overlay" id="tmRemoveModal"[\s\S]*?\n<\/div>/);
ok(modal && /onclick="closeRemove\(\)">Close ✕<\/button>/.test(modal[0]) && /onclick="closeRemove\(\)">Cancel<\/button>/.test(modal[0]) &&
   !/<div class="modal-overlay" id="tmRemoveModal"[^>]*onclick/.test(html) && !/tmRemoveModal'\)\.addEventListener\('click'/.test(html),
   'the remove dialog closes by its X or Cancel only, never an outside click');
ok(/if \(inviteToken && !loginToken\)/.test(html) && /const orgType = await acceptInvite\(inviteToken\);\s*if \(!NONPROFIT_ORG_TYPES\.includes\(orgType\)\) \{ location\.replace\('\/portal'\); return; \}/.test(html),
   'an invite link signs the teammate in and keeps a nonprofit account here');
ok(/if \(e\.status === 403 && \/removed\/i\.test\(e\.message\)\)/.test(html), 'a removed teammate is told so, not sent to the business portal');
ok(!/[a-z] - [a-z]|[a-z] — [a-z]/i.test((html.match(/<div class="page" id="page-team">[\s\S]*?<div class="page" id="page-leftout">/) || [''])[0]), 'no dash mid-sentence on the Team page');
// The business portal routes a teammate on the account's kind too (portal.html).
const biz = fs.readFileSync(__dirname + '/portal.html', 'utf8');
ok(/subscription_status: d\.subscription_status \|\| 'trial', org_type: d\.org_type \|\| 'for_profit',/.test(biz) &&
   /localStorage\.setItem\('fb_sub', JSON\.stringify\(subscriber\)\);\s*return true;/.test(biz), 'portal.html keeps the accept reply\'s org_type, so showApp routes a nonprofit teammate on');
ok(/org_type:\s+p\.org_type \|\| 'for_profit',/.test(biz), 'portal.html keeps the profile\'s org_type when it rebuilds the session');
ok(/const p=await apiFetch\('\/api\/portal\/profile'\);\s*\/\/[^\n]*\n[^\n]*\n\s*if \(isNonprofitAccount\(p\)\) \{/.test(biz), 'a login saved before its account joined the nonprofit side moves on');

process.exit(fails ? 1 : 0);
