// The nonprofit portal's guided tours (Nov 10 2026, Will: "a guided introduction of the portal for new users ... where
// the background is dimmed, and different features/points are pointed out and described"; "each section should also
// have descriptions or a tour specific to it"; "a take the tour button that is permanent"). The main tour walks the
// portal in seven stops; each page's own tour (Tour This Page, in its title band) walks that page. Take The Tour stays
// in the top bar. The main tour shows itself once to an account made from Nov 10 2026, never to one made before.
// The card closes only by its own buttons, never by a click outside it (CLAUDE.md). No library: a dimmed backdrop with
// a cut-out around the feature (one box with a large shadow), and a card beside it.
// nonprofit-portal.html loads this after its own script and supplies go, ROUTE, MODE, ACCOUNT, escHtml and viewerKey.
// Run its tests: node nonprofit-tour.test.js

const TOUR_SINCE = '2026-11-10';                       // accounts made from this day see the main tour once by itself
// A stop: where to go first (a page's address), what to light up (a CSS selector; the first one shown is used), and
// what to say. A stop whose feature is not on the page says its words in the middle, with nothing lit.
const TOURS = {
  main: [
    {go: 'home', el: '#topLinks', title: 'Your Sections',
     text: 'Everything is here: your Funding Plan, Tracker, My Answers and Library. Each section\'s pages are in the column on the left.'},
    {go: 'home', el: '#pfStrip', title: 'Home',
     text: 'New matches since your last visit, and what is due in the next 30 days.'},
    {go: 'plan', el: '.fp-stack-card', title: 'Funding Plan',
     text: 'Set this year\'s goal, then add what you expect under each source: a grant, a bake sale, a donor.'},
    {go: 'answers', el: '#drNav, #drCards, #drEmpty', title: 'My Answers',
     text: 'Answers to the questions funders ask most, drafted from your profile. Edit them once, then reuse them on every application.'},
    {go: 'library', el: '#mList .m', title: 'Your Library',
     text: 'Every funder and program that fits you, best first. Ones marked Not Reviewed Yet come from tax filings FundBug has not checked by hand.'},
    {go: 'library', el: '#mList .m .m-actions .btn', title: 'Save What You Will Pursue',
     text: 'Save the ones you will go after. Your Tracker follows each one from first contact to award.'},
    {go: 'home', el: '.top-org', title: 'Your Organization',
     text: 'The more your profile says, the better your matches and drafts. Take The Tour is always in the top bar, and every page has its own tour under Tour This Page.'},
  ],
  home: [
    {el: '#pfNew', title: 'New Matches', text: 'Funders and programs that fit you now and did not at your last visit. Open them from here.'},
    {el: '#pfDue', title: 'Due Soon', text: 'Deadlines and follow-ups in the next 30 days, from your Tracker and your Library.'},
    {el: '#homePlan', title: 'Your Funding Plan', text: 'How much of this year\'s goal is secured, and what is left to raise.'},
    {el: '#gsCard', title: 'Getting Started', text: 'Four first steps. Each is ticked when it is done, and you can hide the list.'},
  ],
  matches: [
    {el: '#subnav', title: 'Fits You And All Funders', text: 'Fits You shows what fits your organization. All Funders shows everything FundBug knows, with the reason for any that may not fit.'},
    {el: '#page-matches .toolbar', title: 'Narrow It Down', text: 'Search by name, or show only funders or only programs, or one kind of source.'},
    {el: '#mList .m', title: 'A Card', text: 'Its name, how much it gives in your county, its typical grant and how to apply, and one line on why it may fit. Open it for everything else.'},
    {el: '#mList .m .m-actions', title: 'Save, Hide Or Open', text: 'Save puts it in your Tracker. Hide takes it out of your Library for good. Open shows its full page.'},
    {el: '.top-search', title: 'Find A Funder', text: 'Know a name? Type it here from any page.'},
  ],
  listing: [
    {el: '#subnav', title: 'Its Pages', text: 'Overview, Giving, Programs and People And Contact. Only the ones it has are shown.'},
    {el: '#lpBody .summary-card, #lpBody .lp-pane:not([hidden])', title: 'Is It For You?', text: 'How it takes requests, its first grant to a new organization, and its giving in your county.'},
    {el: '#pSave', title: 'Save To Tracker', text: 'Keep it in your Tracker to follow it from first contact to award.'},
  ],
  tracker: [
    {el: '#page-tracker .toolbar', title: 'Your Tracker', text: 'Show one stage at a time, add a funder FundBug does not list yet, or put your deadlines in your own calendar.'},
    {el: '#tList .t-row', title: 'One Row Each', text: 'Its stage, its deadline and when to follow up. Open it to change the stage, record an award, and add notes.'},
    {el: '#subnav', title: 'Seen In Your Digest', text: 'Everything your digests sent you. Add any of it to your Tracker.'},
  ],
  plan: [
    {el: '.fp-head', title: 'Your Goal', text: 'The year and how much you need. It starts as your profile\'s annual budget.'},
    {el: '.fp-stack', title: 'Your Capital Stack', text: 'Secured in solid colors, pending striped, and what your plan does not cover yet dashed.'},
    {el: '.fp-srcs .fp-src', title: 'Your Sources', text: 'Open a source to see what is in it, and press Add Source for a grant, an event, a donor or anything else.'},
    {el: '.fp-stack-card .fp-actions', title: 'Close The Gap And Donors', text: 'Funders that fit what is left to raise, and your donor list, each on its own page.'},
  ],
  answers: [
    {el: '#drModeBar', title: 'How FundBug Helps', text: 'Choose outlines or drafted answers. Read and approve every answer before you use it.'},
    {el: '#drNav', title: 'Find An Answer', text: 'Search, or show only those that need review, are empty or are saved.'},
    {el: '#drCards .dr-card', title: 'One Line Each', text: 'Open an answer to edit it, save it, copy it or copy its link.'},
    {el: '#subnav', title: 'Applications', text: 'Prepare a particular application: bring in its questions and answer them from your saved answers.'},
  ],
  profile: [
    {el: '#pfMeterCard', title: 'Your Profile\'s Strength', text: 'How complete your profile is, and what to add next for better matches and drafts.'},
    {el: '#page-profile .card[data-fold]', title: 'Its Sections', text: 'Each section shows its answers in one line. Press Edit to change them.'},
    {el: '.savebar', title: 'Save Changes', text: 'Your changes are kept when you press Save Changes.'},
  ],
};
// The pages that have a tour of their own, by page id.
const TOUR_PAGES = ['home', 'matches', 'listing', 'tracker', 'plan', 'answers', 'profile'];

let TOUR_NOW = null;                                 // {name, i}
function tourVisible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
function tourFind(sel) { return [...document.querySelectorAll(sel)].find(tourVisible) || null; }
function tourStart(name) {
  if (!TOURS[name]) return;
  TOUR_NOW = {name, i: 0};
  tourShow();
}
function tourEnd() {
  TOUR_NOW = null;
  const o = document.getElementById('tourLayer'); if (o) o.remove();
  window.removeEventListener('resize', tourPlace);
  window.removeEventListener('scroll', tourPlace, true);
}
async function tourShow() {
  if (!TOUR_NOW) return;
  const steps = TOURS[TOUR_NOW.name], st = steps[TOUR_NOW.i];
  if (st.go && !(ROUTE && ROUTE.path === st.go)) go(st.go);
  let el = null;
  for (let t = 0; t < 30 && !el; t++) { el = tourFind(st.el); if (!el) await new Promise(r => setTimeout(r, 100)); }     // up to 3 seconds
  if (!TOUR_NOW) return;
  if (el) el.scrollIntoView({block: 'center', behavior: 'instant'});
  let layer = document.getElementById('tourLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'tourLayer';
    layer.innerHTML = '<div class="tour-block"></div><div class="tour-hole"></div><div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle"></div>';
    document.body.appendChild(layer);
    window.addEventListener('resize', tourPlace);
    window.addEventListener('scroll', tourPlace, true);
  }
  const n = steps.length, i = TOUR_NOW.i;
  layer.querySelector('.tour-card').innerHTML = `<div class="tour-count">${i + 1} of ${n}</div>
    <h3 id="tourTitle">${escHtml(st.title)}</h3><p>${escHtml(st.text)}</p>
    <div class="tour-btns"><button type="button" class="btn ghost sm" onclick="tourEnd()">${i === n - 1 ? 'Close' : 'Skip Tour'}</button>
      <span class="tour-gap"></span>
      ${i ? '<button type="button" class="btn ghost sm" onclick="tourStep(-1)">Back</button>' : ''}
      <button type="button" class="btn sm" id="tourNext" onclick="${i === n - 1 ? 'tourEnd()' : 'tourStep(1)'}">${i === n - 1 ? 'Done' : 'Next'}</button></div>`;
  TOUR_NOW.el = el;
  tourPlace();
  const next = document.getElementById('tourNext'); if (next) next.focus({preventScroll: true});
}
function tourStep(d) {
  if (!TOUR_NOW) return;
  TOUR_NOW.i = Math.max(0, Math.min(TOURS[TOUR_NOW.name].length - 1, TOUR_NOW.i + d));
  tourShow();
}
// The cut-out around the feature and the card beside it (below it when there is room, above it otherwise, in the middle
// when nothing is lit), kept inside the window.
function tourPlace() {
  const layer = document.getElementById('tourLayer'); if (!layer || !TOUR_NOW) return;
  const hole = layer.querySelector('.tour-hole'), card = layer.querySelector('.tour-card'), el = TOUR_NOW.el;
  const W = window.innerWidth, H = window.innerHeight, pad = 8, gap = 14;
  const cw = Math.min(380, W - 32);
  card.style.width = cw + 'px';
  if (!el || !el.isConnected || !tourVisible(el)) {
    hole.style.cssText = 'left:50%;top:50%;width:0;height:0';
    card.style.left = (W - cw) / 2 + 'px'; card.style.top = Math.max(16, (H - card.offsetHeight) / 2) + 'px';
    return;
  }
  const r = el.getBoundingClientRect();
  const top = Math.max(4, r.top - pad), left = Math.max(4, r.left - pad);
  const w = Math.min(W - 8 - left, r.width + pad * 2), h = Math.min(H - 8 - top, r.height + pad * 2);
  hole.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
  const ch = card.offsetHeight;
  let y = top + h + gap;
  if (y + ch > H - 16) y = top - gap - ch;
  if (y < 16) y = Math.min(H - ch - 16, Math.max(16, top + 16));
  card.style.top = y + 'px';
  card.style.left = Math.min(W - cw - 16, Math.max(16, left)) + 'px';
}
// Take The Tour (the top bar) and Tour This Page (each page's title band).
function tourButtons() {
  document.querySelectorAll('.page .hero').forEach(hero => {
    const id = hero.parentElement.id.replace(/^page-/, '');
    if (!TOUR_PAGES.includes(id) || hero.querySelector('.tour-page-btn')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tour-page-btn'; b.textContent = 'Tour This Page';
    b.addEventListener('click', () => tourStart(id));
    hero.appendChild(b);
    if (id === 'home') {                                // a phone's top bar has no room: the main tour is on Home too
      const m = document.createElement('button');
      m.type = 'button'; m.className = 'tour-page-btn tour-phone-only'; m.textContent = 'Take The Tour';
      m.addEventListener('click', () => tourStart('main'));
      hero.appendChild(m);
    }
  });
}
// The main tour by itself, once, for an account made from TOUR_SINCE (each person, in this browser).
function tourMaybeAutostart() {
  if (MODE !== 'account' || typeof ACCOUNT === 'undefined' || !ACCOUNT) return;
  const made = String((ACCOUNT.subscriber && ACCOUNT.subscriber.created_at) || '').slice(0, 10);
  if (!made || made < TOUR_SINCE) return;
  const key = 'fb_np_toured_' + (typeof viewerKey === 'function' ? viewerKey() : '');
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) { return; }
  setTimeout(() => tourStart('main'), 800);
}

if (typeof module !== 'undefined') module.exports = { TOURS, TOUR_PAGES, TOUR_SINCE };
