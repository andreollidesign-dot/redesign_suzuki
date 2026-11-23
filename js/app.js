/* Suzuki Press – prototipo di redesign (Lulop)
   Vanilla JS, nessun build step. I dati arrivano da data/*.json.
   Routing a hash: #home · #comunicato-<id> · #modello-<slug> · #media */
(async () => {
'use strict';

/* ---------- dati ---------- */
const DATA_FILES = ['posts', 'albums', 'docs', 'videos', 'models'];
let POSTS, ALB, DOCS, VIDS, MODELS, FACTS, STATUS, NOVITA;
try {
  const [p, a, d, v, m] = await Promise.all(DATA_FILES.map(f => fetch(`data/${f}.json`).then(r => {
    if (!r.ok) throw new Error(f);
    return r.json();
  })));
  POSTS = p.sort((x, y) => y.date.localeCompare(x.date) || y.id - x.id);
  ALB = a; DOCS = d; VIDS = v; MODELS = m.tree; FACTS = m.facts || {}; STATUS = m.status || {}; NOVITA = m.novita || {};
} catch (err) {
  document.getElementById('app').innerHTML = `<div class="wrap sec"><div class="empty"><b>I dati del prototipo non si sono caricati.</b><br>
    Il browser blocca la lettura dei file JSON se la pagina è aperta con doppio clic.<br>
    Apri il Terminale in questa cartella e lancia <code>npx serve</code>, poi vai su <code>http://localhost:3000</code>.</div></div>`;
  console.error('Caricamento dati fallito:', err);
  return;
}

/* ---------- helper ---------- */
const IMG = (p, n, s) => `https://media.lulop.com/media/getimage/l/${p}/${n}/${s}`;
const AREAS = { Auto: '--auto', Moto: '--moto', Marine: '--marine', Corporate: '--corp' };
const col = a => `var(${AREAS[a] || '--corp'})`;
const TODAY = new Date('2026-11-20');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmt = d => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const ph = (src, label, c) => `<div class="ph" style="--c:${c || 'var(--auto)'}"><img loading="lazy" src="${src}" alt="${esc(label)}" onerror="this.parentNode.classList.add('err');this.remove()"><div class="fb">${esc(label)}</div></div>`;
const ico = {
  f: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>',
  v: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
  d: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
  dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/></svg>',
  cp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
};

const postById = id => POSTS.find(p => p.id === +id);
const postHref = p => `#comunicato-${p.id}`;
const coverOf = p => IMG(p.id, p.cover || 1, '640,480');
const albumsOf = id => ALB.filter(a => a.post === id);
const docsOf = id => DOCS.filter(d => d.post === id);
const vidsOf = id => VIDS.filter(v => v.post === id);
const albumName = a => a.model ? `${a.model} – ${a.kind}` : a.kind;
const hasKit = p => albumsOf(p.id).length > 0 || docsOf(p.id).length > 0 || vidsOf(p.id).length > 0;

const hasContent = m => POSTS.some(p => p.models.includes(m)) || ALB.some(a => a.model === m) || DOCS.some(d => d.model === m) || VIDS.some(v => v.model === m);
const isCurrent = m => (STATUS[m] || 'current') === 'current';
const inMenu = m => isCurrent(m) && hasContent(m);
const modelPhoto = m => { const a = ALB.find(x => x.model === m); if (a) return IMG(a.post, a.cover || a.first, '640,480'); const p = POSTS.find(x => x.models.includes(m)); return p ? coverOf(p) : ''; };
const gammaHref = a => `#gamma-${slug(a)}`;
const allModels = () => Object.values(MODELS).flatMap(f => Object.values(f).flat());
const areaOf = m => Object.entries(MODELS).find(([, f]) => Object.values(f).flat().includes(m))?.[0] || 'Moto';
const famOf = m => { for (const f of Object.values(MODELS)) for (const [k, ms] of Object.entries(f)) if (ms.includes(m)) return k; return ''; };

const st = { q: '', area: 'Tutte', type: 'Tutti', lang: 'Tutte', per: 'Tutto', logged: false, album: null, shown: 24, tab: 'foto', cur: null, mf: 'Tutti' };
/* ricerca, filtri, carrello e login restano salvati tra un ricarico e l'altro; ?reset=1 riparte da zero */
const STORE = 'suzukiPressDemo';
const SAVED = ['q', 'area', 'type', 'lang', 'per', 'logged'];
const params = new URLSearchParams(location.search);
if (params.has('reset')) {
  try { localStorage.removeItem(STORE); } catch (_) { /* storage non disponibile */ }
  params.delete('reset');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
} else {
  try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved) SAVED.forEach(k => { if (k in saved) st[k] = saved[k]; }); } catch (_) { /* dati salvati illeggibili: si parte da zero */ }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(Object.fromEntries(SAVED.map(k => [k, st[k]])))); } catch (_) { /* storage non disponibile */ } }

/* ---------- Marine: categorie di prodotto, non modelli ---------- */
const MGEN = 'Fuoribordo Suzuki';
const MCATS = () => Object.values(MODELS.Marine || {}).flat();
const isMcat = m => MCATS().includes(m);
const mcatHref = c => `#marine-${slug(c)}`;
const mcatPosts = c => POSTS.filter(p => p.area === 'Marine' && (c === MGEN || p.category === c));
const nCom = n => `${n} ${n === 1 ? 'comunicato' : 'comunicati'}`;
const mcatLinks = () => [...MCATS().map(c => { const n = mcatPosts(c).length; return `<a href="${mcatHref(c)}">${esc(c)}${n ? ` <small class="mc">${nCom(n)}</small>` : ''}</a>`; }), `<a href="${mcatHref(MGEN)}"><b>${MGEN}: tutti i comunicati</b></a>`].join('');
function marine(c) {
  const own = mcatPosts(c), rest = POSTS.filter(p => p.area === 'Marine' && !own.includes(p)), a = 'Marine';
  return `<section class="ghead" style="--c:${col(a)}"><div class="wrap">
    <div class="crumbs" style="padding:0 0 10px"><a href="#home">Home</a> › Marine${c === MGEN ? '' : ` › <a href="${mcatHref(MGEN)}">${MGEN}</a>`}</div>
    <h1>${esc(c)}</h1><p>${c === MGEN ? 'Tutti i comunicati sui motori fuoribordo Suzuki: eventi, partnership, raid e tecnologia.' : `Comunicati, foto e documenti per la stampa sui fuoribordo Suzuki della categoria “${esc(c)}”.`}</p>
    <div class="chips"><div class="cg"><span>Categoria</span>${[MGEN, ...MCATS()].map(o => `<a class="chip" href="${mcatHref(o)}" aria-current="${o === c ? 'page' : 'false'}">${esc(o)}</a>`).join('')}</div></div>
  </div></section>
  <section class="sec"><div class="wrap">
    ${own.length ? `<div class="sh"><h2>Comunicati</h2><span class="n">${own.length}</span></div><div class="grid">${own.map(card).join('')}</div>` : `<div class="soonbox"><h2>I comunicati dedicati arrivano presto</h2><p>Qui trovi i comunicati su questa categoria appena l'ufficio stampa li pubblica. Intanto, tutte le notizie sui fuoribordo Suzuki.</p></div>`}
    ${rest.length ? `<div class="sh" style="margin-top:32px"><h2>${own.length ? 'Altri comunicati' : 'Tutti i comunicati'} ${MGEN}</h2><span class="n">${rest.length}</span></div><div class="grid">${rest.map(card).join('')}</div>` : ''}
  </div></section>`;
}

/* ---------- nav ---------- */
/* nel menu solo i modelli a listino con almeno un contenuto; il resto è nelle pagine gamma */
const menuFamilies = a => Object.entries(MODELS[a]).map(([f, ms]) => [f, ms.filter(inMenu)]).filter(([, ms]) => ms.length);
function renderNav() {
  const megas = Object.keys(MODELS).map(a => {
    const fams = a === 'Marine' ? [[0]] : menuFamilies(a), nov = (NOVITA[a] || []).filter(hasContent);
    return `<div><button class="nb" aria-expanded="false" data-mega><span class="dot" style="background:${col(a)}"></span>${a}</button><div class="mega" style="--cols:${Math.max(1, Math.min(fams.length, 4))}">
      ${nov.length ? `<div class="nov"><h4>Novità</h4><div class="novc">${nov.map(m => `<a class="ncard" href="#modello-${slug(m)}">${ph(modelPhoto(m), m, col(a))}<b>${esc(m)}</b></a>`).join('')}</div></div>` : ''}
      ${a === 'Marine' ? `<div class="mcats"><h4>Fuoribordo per categoria</h4>${mcatLinks()}</div>` : fams.map(([f, ms]) => `<div><h4>${esc(f)}</h4>${ms.map(m => `<a href="#modello-${slug(m)}">${esc(m)}</a>`).join('')}</div>`).join('')}
      <div class="mfoot"><a href="#home" data-area="${a}">Tutte le news ${a} →</a>${a === 'Marine' ? '' : `<a href="${gammaHref(a)}">Tutta la gamma ${a} →</a>`}</div></div></div>`;
  }).join('');
  $('#nav').innerHTML = megas + `<div><a class="nb" href="#home" data-area="Corporate">Corporate</a></div><div><a class="nb" href="#media">Media library</a></div>`;
  $('#mnav').innerHTML = `<div class="dh" style="padding:4px 4px 12px"><b>Menu</b><button class="x" data-close aria-label="Chiudi">×</button></div>` +
    Object.keys(MODELS).map(a => `<details><summary><span><span class="dot" style="background:${col(a)}"></span>${a}</span></summary>${a === 'Marine' ? `<h4>Fuoribordo per categoria</h4>${mcatLinks()}` : menuFamilies(a).map(([f, ms]) => `<h4>${esc(f)}</h4>${ms.map(m => `<a href="#modello-${slug(m)}">${esc(m)}</a>`).join('')}`).join('') + `<a href="${gammaHref(a)}"><b>Tutta la gamma ${a} →</b></a>`}<a href="#home" data-area="${a}">Tutte le news ${a}</a></details>`).join('') +
    `<a class="plain" href="#home" data-area="Corporate" style="display:block">Corporate</a><a class="plain" href="#media" style="display:block">Media library</a><a class="plain" href="#" data-act="login" style="display:block">Area giornalisti</a><a class="plain" href="#" data-act="newsletter" style="display:block">Newsletter</a>`;
}

/* ---------- pagine gamma ---------- */
function gammaCard(m, a) {
  const c = hasContent(m), src = modelPhoto(m);
  const nPost = POSTS.filter(p => p.models.includes(m)).length, nPh = ALB.filter(x => x.model === m).reduce((s, x) => s + x.count, 0);
  const img = src ? ph(src, m, col(a)) : `<div class="ph gph"><div class="fb">${esc(m)}</div></div>`;
  const meta = c ? [nPost ? `${nPost} ${nPost === 1 ? 'comunicato' : 'comunicati'}` : '', nPh ? `${nPh} foto` : ''].filter(Boolean).join(' · ') || 'Materiali disponibili' : 'Nessun materiale ancora';
  const inner = `${img}<div class="gb"><small>${esc(famOf(m))}</small><b>${esc(m)}</b><span>${meta}</span></div>`;
  return c ? `<a class="gcard" href="#modello-${slug(m)}">${inner}</a>` : `<div class="gcard none">${inner}</div>`;
}
function gammaList(a) {
  const q = (st.gq || '').trim().toLowerCase(), f = st.gf || 'Tutte';
  const ok = m => (f === 'Tutte' || famOf(m) === f) && (!q || m.toLowerCase().includes(q));
  const all = Object.values(MODELS[a]).flat();
  /* prima i modelli con contenuti (più comunicati in testa), poi gli altri in ordine alfabetico */
  const nPosts = m => POSTS.filter(p => p.models.includes(m)).length;
  const nPhotos = m => ALB.filter(x => x.model === m).reduce((t, x) => t + x.count, 0);
  const order = (x, y) => (hasContent(y) - hasContent(x)) || (hasContent(x) && (nPosts(y) - nPosts(x) || nPhotos(y) - nPhotos(x))) || x.localeCompare(y, 'it');
  const cur = all.filter(m => isCurrent(m) && ok(m)).sort(order), arc = all.filter(m => !isCurrent(m) && ok(m)).sort(order);
  return `<div class="ggrid">${cur.map(m => gammaCard(m, a)).join('') || '<div class="empty">Nessun modello trovato.</div>'}</div>
  ${arc.length ? `<h2 class="garch">Archivio</h2><p class="gnote">Versioni precedenti e modelli non più a listino.</p><div class="ggrid arch">${arc.map(m => gammaCard(m, a)).join('')}</div>` : ''}`;
}
function gamma(a) {
  const fams = Object.keys(MODELS[a]);
  return `<section class="ghead" style="--c:${col(a)}"><div class="wrap">
    <div class="crumbs" style="padding:0 0 10px"><a href="#home">Home</a> › ${a}</div>
    <h1>Gamma ${a}</h1><p>Tutti i modelli ${a} con comunicati, foto e documenti per la stampa.</p>
    <label class="sbox gsearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="gq" type="search" placeholder="Cerca un modello ${a}" value="${esc(st.gq || '')}" autocomplete="off"></label>
    <div class="chips"><div class="cg"><span>Famiglia</span>${['Tutte', ...fams].map(o => `<button class="chip" data-gf="${esc(o)}" aria-pressed="${(st.gf || 'Tutte') === o}">${esc(o)}</button>`).join('')}</div></div>
  </div></section>
  <section class="sec"><div class="wrap" id="glist">${gammaList(a)}</div></section>`;
}

/* ---------- home ---------- */
function filtered() {
  const q = st.q.trim().toLowerCase();
  return POSTS.filter(p => {
    if (st.area !== 'Tutte' && p.area !== st.area) return false;
    if (st.lang !== 'Tutte' && p.lang !== st.lang) return false;
    if (st.type === 'Press kit' && !p.kit) return false;
    if (st.type === 'Foto' && !(p.photos > 0)) return false;
    if (st.type === 'Video' && !(p.videos > 0)) return false;
    if (st.type === 'Documenti' && !(p.docs > 0)) return false;
    if (st.per !== 'Tutto') { const days = (TODAY - new Date(p.date)) / 864e5; if (days > (st.per === '7 giorni' ? 7 : 30)) return false; }
    if (q) {
      const hay = [p.title, p.excerpt, p.area, p.event, ...(p.models || []), ...(p.tags || [])].join(' ').toLowerCase();
      return q.split(/\s+/).every(w => hay.includes(w));
    }
    return true;
  });
}
const card = p => `<a class="card" href="${postHref(p)}">
  <div style="position:relative">${ph(coverOf(p), p.title, col(p.area))}${p.kit ? '<span class="pk">Press kit</span>' : ''}</div>
  <div class="body"><div class="meta"><span class="area" style="--c:${col(p.area)}">${p.area}</span><span>${fmt(p.date)}</span><span class="lang ${p.lang === 'EN' ? 'en' : ''}">${p.lang}</span></div>
  <h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>
  <div class="counts">${p.photos ? `<span>${ico.f}${p.photos} foto</span>` : ''}${p.videos ? `<span>${ico.v}${p.videos} video</span>` : ''}${p.docs ? `<span>${ico.d}${p.docs} doc</span>` : ''}${p.models.length ? `<span>· ${p.models.slice(0, 2).join(', ')}${p.models.length > 2 ? ' +' + (p.models.length - 2) : ''}</span>` : ''}</div></div></a>`;
const chipGroup = (label, key, opts) => `<div class="cg"><span>${label}</span>${opts.map(o => `<button class="chip" data-f="${key}" data-v="${o}" aria-pressed="${st[key] === o}">${o}</button>`).join('')}</div>`;

/* ---------- hero "In evidenza" ---------- */
const HQ = (p, n, sz) => `https://media.lulop.com/media/hqgetimage/l/${p}/${n}/${sz}`;
const heroN = p => typeof p.heroImage === 'object' ? p.heroImage.n : (p.heroImage || p.cover || 1);
const heroFocus = p => (typeof p.heroImage === 'object' && p.heroImage.focus) || '70% 50%';
/* focus = riquadro a destra su desktop (>= 900 px); focusMobile = foto a tutta larghezza sotto i 900 px */
const heroFocusM = p => (typeof p.heroImage === 'object' && (p.heroImage.focusMobile || p.heroImage.focus)) || '70% 50%';
/* tablet (601–899 px): foto nella parte alta, allineata in basso salvo focusTablet */
const heroFocusT = p => (typeof p.heroImage === 'object' && p.heroImage.focusTablet) || heroFocusM(p).split(' ')[0] + ' 100%';
function featuredPosts() {
  const f = POSTS.filter(p => p.featured).sort((x, y) => (x.heroOrder || 99) - (y.heroOrder || 99));
  return f.length ? f : POSTS.slice(0, 3);
}
/* immagine ad alta risoluzione con fallback alla versione normale */
function heroImg(p, cls = 'himg') {
  const n = heroN(p);
  return `<img class="${cls}" src="${HQ(p.id, n, '1600,1000')}" srcset="${HQ(p.id, n, '960,600')} 960w, ${HQ(p.id, n, '1600,1000')} 1600w" sizes="100vw" alt="" style="--fd:${heroFocus(p)};--fm:${heroFocusM(p)};--ft:${heroFocusT(p)}" data-fb="${IMG(p.id, n, '1600,1000')}" onerror="if(this.dataset.fb){this.removeAttribute('srcset');this.src=this.dataset.fb;this.dataset.fb=''}else{this.remove()}">`;
}
/* i codici modello (GSX-10R…) non vanno a capo sul trattino */
const nobreak = t => esc(t).replace(/(\S*\w-\w\S*)/g, '<span class="nw">$1</span>');
function heroText(p, i) {
  const alb = albumsOf(p.id), nf = alb.reduce((s, a) => s + a.count, 0), m0 = p.models.find(m => allModels().includes(m));
  const H = i === 0 ? 'h1' : 'h2';
  return `<div class="kick"><span class="tag">In evidenza</span>${esc([p.event, p.area].filter(Boolean).join(' · '))}</div>
    <${H} class="ht">${nobreak(p.heroTitle || p.title)}</${H}>
    <p>${esc(p.heroText || p.excerpt)}</p>
    <div class="cta"><a class="btn r" href="${postHref(p)}#kit">Apri il press kit</a>${hasDownloads(p) ? `<button class="btn w" data-act="addkit" data-post="${p.id}">${ico.dl}Scarica tutto</button>` : ''}</div>
    ${m0 ? `<a class="hlink" href="#modello-${slug(m0)}">Pagina <span class="nw">${esc(m0)}</span>&nbsp;→</a>` : ''}
    ${nf ? `<div class="stats"><div><b>${nf}</b>foto${alb.length > 1 ? ` in ${alb.length} album` : ''}</div>${docsOf(p.id).length ? `<div><b>${docsOf(p.id).length}</b>documenti</div>` : ''}${vidsOf(p.id).length ? `<div><b>${vidsOf(p.id).length}</b>video</div>` : ''}</div>` : ''}`;
}
/* heroShade = [desktop 0%, desktop 35%, mobile 0%, mobile 30%, fine sfumatura mobile]: solo per le foto troppo chiare */
const shadeVars = p => { const h = p.heroShade; if (!h) return ''; return `--a0:${h[0]};--a1:${h[1]};--am:${h[2] ?? .9};--am2:${h[3] ?? .45};--mend:${h[4] ?? 60}%`; };
function heroCarousel(list) {
  return `<section class="hero hc" aria-roledescription="carousel" aria-label="In evidenza">
    <div class="track" id="htrack">${list.map((p, i) => `<article class="slide" id="slide-${i}" aria-roledescription="slide" aria-label="${i + 1} di ${list.length}: ${esc(p.short || p.title)}" style="${shadeVars(p)}">${heroImg(p)}<div class="shade"></div><div class="wrap hcontent"><div class="hcol">${heroText(p, i)}</div></div></article>`).join('')}</div>
    ${list.length > 1 ? `<div class="hnav"><div class="wrap hnav-in"><button class="hplay" id="hplay" type="button" aria-label="Metti in pausa la rotazione" hidden><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
      <div class="hdots">${list.map((p, i) => `<button type="button" class="hdot" data-slide="${i}" aria-label="Vai a: ${esc(p.short || p.title)}" aria-current="${i === 0}"><span class="bar"><i></i></span><span class="hl">${esc(p.short || p.title)}</span></button>`).join('')}</div></div></div>` : ''}
  </section>`;
}
function heroGrid(list) {
  const [big, ...small] = list;
  return `<section class="hgrid"><div class="wrap hgrid-in">
    <article class="hbig" style="${shadeVars(big)}">${heroImg(big)}<div class="shade"></div><div class="hcol">${heroText(big, 0)}</div></article>
    <div class="hsmall">${small.slice(0, 2).map(p => `<a class="hs" href="${postHref(p)}">${heroImg(p, 'himg')}<div class="hs-t"><span class="kick"><span class="tag">In evidenza</span></span><h2>${nobreak(p.heroTitle || p.title)}</h2></div></a>`).join('')}</div>
  </div></section>`;
}

/* rotazione: solo desktop, mai con "riduci movimento"; pausa su hover/focus e con il pulsante */
let heroT = null;
function initHero() {
  clearTimeout(heroT);
  const sec = $('.hc'), track = $('#htrack'); if (!sec || !track) return;
  const slides = [...track.children], dots = [...sec.querySelectorAll('.hdot')], btn = $('#hplay');
  const auto = matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches && slides.length > 1;
  let idx = 0, userPaused = false, hover = false, focus = false;
  const running = () => auto && !userPaused && !hover && !focus && !document.hidden;
  const mark = i => { idx = i; dots.forEach((d, k) => d.setAttribute('aria-current', k === i)); slides.forEach((s, k) => s.toggleAttribute('inert', k !== i)); };
  /* ogni (ri)partenza riavvia i 7 secondi e la barra dell'indicatore attivo */
  const schedule = () => { clearTimeout(heroT); sec.classList.remove('playing'); if (!running()) return; void sec.offsetWidth; sec.classList.add('playing'); heroT = setTimeout(() => go(idx + 1), 7000); };
  const go = i => { const n = (i + slides.length) % slides.length; track.scrollTo({ left: n * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); mark(n); schedule(); };
  let sT; track.addEventListener('scroll', () => { clearTimeout(sT); sT = setTimeout(() => { const n = Math.round(track.scrollLeft / track.clientWidth); if (n !== idx) { mark(n); schedule(); } }, 80); }, { passive: true });
  dots.forEach(d => d.addEventListener('click', () => go(+d.dataset.slide)));
  if (btn) {
    btn.hidden = !auto;
    btn.addEventListener('click', () => { userPaused = !userPaused; btn.setAttribute('aria-label', userPaused ? 'Riprendi la rotazione' : 'Metti in pausa la rotazione'); btn.innerHTML = userPaused ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'; schedule(); });
  }
  sec.addEventListener('mouseenter', () => { hover = true; schedule(); });
  sec.addEventListener('mouseleave', () => { hover = false; schedule(); });
  sec.addEventListener('focusin', () => { focus = true; schedule(); });
  sec.addEventListener('focusout', e => { if (!sec.contains(e.relatedTarget)) { focus = false; schedule(); } });
  mark(0); schedule();
}

function home() {
  const list = featuredPosts();
  return `${new URLSearchParams(location.search).get('hero') === 'grid' ? heroGrid(list) : heroCarousel(list)}
  <section class="finder" id="cerca"><div class="wrap">
    <label class="sbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="${innerWidth < 600 ? 'Cerca modello, evento, tema…' : 'Cerca un modello, un evento, un tema… es. GSX-10R, rugby, finanziari'}" value="${esc(st.q)}" autocomplete="off"><button class="clear" id="clr" ${st.q ? '' : 'hidden'}>Cancella</button></label>
    <div class="chips">${chipGroup('Area', 'area', ['Tutte', 'Auto', 'Moto', 'Marine', 'Corporate'])}${chipGroup('Contiene', 'type', ['Tutti', 'Press kit', 'Foto', 'Video', 'Documenti'])}${chipGroup('Lingua', 'lang', ['Tutte', 'IT', 'EN'])}${chipGroup('Periodo', 'per', ['Tutto', '7 giorni', '30 giorni'])}</div>
  </div></section>
  <section class="sec"><div class="wrap"><div class="sh"><h2 id="resT">Ultimi comunicati</h2><span class="n" id="resN"></span></div><div id="res"></div></div></section>
  <section class="sec" style="background:var(--soft)"><div class="wrap"><div class="sh"><h2>Esplora per area</h2></div><div class="areas">
  ${['Auto', 'Moto', 'Marine'].map(a => { const ps = POSTS.filter(p => p.area === a).slice(0, 3); return `<div class="ac" style="--c:${col(a)}"><h3>${a}</h3>${ps.map(p => `<a href="${postHref(p)}">${esc(p.title)}</a>`).join('')}<a class="go" href="#home" data-area="${a}">Tutte le news ${a} →</a></div>`; }).join('')}
  </div></div></section>`;
}
const searchActive = () => !!(st.q.trim() || st.area !== 'Tutte' || st.type !== 'Tutti' || st.lang !== 'Tutte' || st.per !== 'Tutto');
/* porta la barra di ricerca in cima (sotto l'header): sotto si vedono subito i risultati */
function toResults() { const f = $('#cerca'); if (f) f.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
function renderResults() {
  const r = filtered(); const el = $('#res'); if (!el) return;
  const active = searchActive();
  $('#app').classList.toggle('searching', active);
  save();
  $('#resT').textContent = active ? 'Risultati' : 'Ultimi comunicati';
  $('#resN').textContent = `${r.length} di ${POSTS.length} comunicati`;
  el.innerHTML = r.length ? `<div class="grid">${r.map(card).join('')}</div>` : `<div class="empty"><b>Nessun comunicato trovato.</b><br>Prova a togliere un filtro o a cercare il nome del modello.<br><br><button class="btn g" data-act="reset">Azzera filtri</button></div>`;
  const c = $('#clr'); if (c) c.hidden = !st.q;
}

/* ---------- press kit (comunicato e modello) ---------- */
function albumCard(a) {
  const p = postById(a.post);
  return `<button class="album" data-album="${a.id}">${ph(IMG(a.post, a.cover || a.first, '640,480'), albumName(a), col(p?.area || 'Moto'))}<div class="ab"><div><b>${esc(albumName(a))}</b>${a.old && a.old !== albumName(a) ? `<small title="Nome attuale sul sito">prima: ${esc(a.old)}</small>` : ''}</div><span class="cnt">${a.count}</span></div></button>`;
}
const photoNums = a => a.items || Array.from({ length: a.count }, (_, i) => a.first + i);
function viewer() {
  const a = ALB.find(x => x.id === st.album); if (!a) return '';
  const area = postById(a.post)?.area || 'Moto';
  const all = photoNums(a), n = Math.min(st.shown, all.length), items = all.slice(0, n);
  return `<div class="viewer" id="viewer"><div class="vh"><div><h3>${esc(albumName(a))}</h3><small>${a.count} foto · tocca una foto per scaricarla</small></div><div class="cta"><button class="btn g" data-act="closealbum">Chiudi album</button><button class="btn b" data-act="dlalbum">${ico.dl}Scarica l'album (${a.count} foto)</button></div></div>
  <div class="thumbs">${items.map((i, k) => `<button class="th" data-ph="${i}" data-pp="${a.post}" aria-label="Scarica ${esc(albumName(a))} · ${k + 1}">${ph(IMG(a.post, i, '265,175'), albumName(a) + ' ' + (k + 1), col(area))}<span class="ck">${ico.dl}</span></button>`).join('')}</div>
  ${n < all.length ? `<div class="more"><button class="btn g" data-act="more">Mostra altre ${Math.min(24, all.length - n)} di ${all.length - n}</button></div>` : ''}</div>`;
}
/* scope: {post:id} oppure {model:name} */
function kitTabs(scope) {
  const byModel = !!scope.model;
  const alb = byModel ? ALB.filter(a => a.model === scope.model) : albumsOf(scope.post);
  const docs = byModel ? DOCS.filter(d => d.model === scope.model) : docsOf(scope.post);
  const vids = byModel ? VIDS.filter(v => v.model === scope.model) : vidsOf(scope.post);
  const p = byModel ? null : postById(scope.post);
  const nVid = byModel ? vids.length : Math.max(vids.length, p?.videos || 0);
  const tabs = [['foto', `Foto (${alb.reduce((s, a) => s + a.count, 0)})`], ['video', `Video (${nVid})`], ['doc', `Documenti (${docs.length})`]].filter(([k]) => k === 'foto' ? alb.length : k === 'video' ? nVid : docs.length);
  if (!tabs.length) return '';
  if (!tabs.some(([k]) => k === st.tab)) st.tab = tabs[0][0];
  const area = p?.area || areaOf(scope.model);
  let body = '';
  if (st.tab === 'foto') body = `<div class="albums">${alb.map(albumCard).join('')}</div>${alb.some(a => a.id === st.album) ? viewer() : ''}`;
  if (st.tab === 'video') body = `<div class="vid">${vids.map(v => {
    const thumb = v.youtube ? `https://i.ytimg.com/vi/${v.youtube}/hqdefault.jpg` : v.poster;
    const href = v.youtube ? `https://www.youtube.com/watch?v=${v.youtube}` : null;
    const inner = `<div style="position:relative">${ph(thumb, v.title, col(area))}<span class="play"><i></i></span></div><b style="display:block;margin-top:8px">${esc(v.title)}</b>${v.info ? `<small style="color:var(--mute)">${esc(v.info)}</small>` : ''}`;
    return href ? `<a href="${href}" target="_blank" rel="noopener" style="text-decoration:none">${inner}</a>` : `<button class="vbtn" data-act="video" style="all:unset;cursor:pointer">${inner}</button>`;
  }).join('')}${!byModel && nVid > vids.length ? '<div class="empty" style="padding:20px">Un video del comunicato non è stato catalogato in questo prototipo.</div>' : ''}</div>`;
  if (st.tab === 'doc') body = `<div class="docs">${docs.map(d => { const i = DOCS.indexOf(d); return `<div class="doc"><span class="ext">${esc(d.ext)}</span><div class="dn"><b>${esc(d.title)}</b><small>${esc(d.ext)} · ${esc(d.size)}</small></div><button class="ib" data-doc="${i}">${ico.dl}Scarica</button></div>`; }).join('')}</div>${(p?.dupNote) ? `<p style="color:var(--mute);font-size:13.5px">${esc(p.dupNote)}</p>` : ''}`;
  return `<div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${st.tab === k}">${l}</button>`).join('')}</div>${body}`;
}

/* ---------- comunicato ---------- */
/* righe brevi tutte maiuscole o che finiscono con ":" diventano titoletti */
const isHead = t => t.length <= 90 && ((t.length <= 70 && /:$/.test(t)) || (/[A-Z]/.test(t) && t === t.toUpperCase()));
const headCase = t => t !== t.toUpperCase() ? t : t.split(' ').map(w => /\d|-|\//.test(w) || /^([A-Z]\.){2,}[A-Z]?\.?$/.test(w) ? w : w.toLowerCase()).join(' ')
  .replace(/^./, c => c.toUpperCase()).replace(/\bsuzuki\b/g, 'Suzuki');
const blocks = p => (p.body || []).map(b => b.h || isHead(b.p) ? { h: headCase(b.h || b.p) } : { p: b.p });
const plain = html => String(html).replace(/<[^>]+>/g, '');
const textOf = p => [p.title, '', ...(p.brief || []).map(b => '• ' + plain(b)), p.lead || '', '', ...blocks(p).map(b => b.h ? '\n' + b.h : b.p)].filter((x, i, arr) => x !== '' || arr[i - 1] !== '').join('\n');
const hasDownloads = p => albumsOf(p.id).length > 0 || docsOf(p.id).length > 0;
function relatedOf(p) {
  const same = POSTS.filter(x => x.id !== p.id && !(p.translations || []).includes(x.id) && x.models.some(m => p.models.includes(m))).slice(0, 3);
  const shown = new Set([p.id, ...(p.translations || []), ...same.map(x => x.id)]);
  const area = POSTS.filter(x => !shown.has(x.id) && x.area === p.area).slice(0, 3);
  return { same, area };
}
const sideLinks = list => list.map(x => `<a class="mlink" href="${postHref(x)}"><div><b style="font-size:14px">${esc(x.title)}</b><small>${fmt(x.date)}${x.lang === 'EN' ? ' · EN' : ''}</small></div></a>`).join('');
function article(p) {
  const kit = hasKit(p), dl = hasDownloads(p);
  const lead = p.brief?.length ? `<ul>${p.brief.map(b => `<li>${b}</li>`).join('')}</ul>` : p.lead ? `<p style="margin:0">${esc(p.lead)}</p>` : '';
  const bl = blocks(p);
  const body = bl.map(b => b.h ? `<h3>${esc(b.h)}</h3>` : `<p>${esc(b.p)}</p>`).join('') || `<p>${esc(p.excerpt)}</p>`;
  const first = bl.find(b => b.p)?.p || p.excerpt;
  const preview = first.length > 220 ? first.slice(0, 220).replace(/\s+\S*$/, '') + '…' : first;
  const models = p.models.filter(m => allModels().includes(m));
  const trans = (p.translations || []).map(postById).filter(Boolean);
  const rel = relatedOf(p);
  const nAlb = albumsOf(p.id).length, nPh = albumsOf(p.id).reduce((s, a) => s + a.count, 0);
  const kitSum = [nPh ? `${nPh} foto${nAlb > 1 ? ` in ${nAlb} album` : ''}` : '', vidsOf(p.id).length ? `${vidsOf(p.id).length} video` : '', docsOf(p.id).length ? `${docsOf(p.id).length} documenti` : ''].filter(Boolean).join(' · ');
  return `<div class="wrap"><div class="crumbs"><a href="#home">Home</a> › <a href="#home" data-area="${p.area}">${p.area}</a> › Comunicato</div>
  <div class="art"><div>
    <div class="meta"><span class="area" style="--c:${col(p.area)}">${p.area}</span><span>${fmt(p.date)}</span><span class="lang ${p.lang === 'EN' ? 'en' : ''}">${p.lang}</span>${p.event ? `<span>· ${esc(p.event)}</span>` : ''}</div>
    <h1>${esc(p.title)}</h1>
    <div class="actions">${dl ? `<button class="btn r" data-act="addkit" data-post="${p.id}">${ico.dl}Scarica tutto il press kit</button>` : `<button class="btn r" data-act="addbasic" data-post="${p.id}">${ico.dl}Scarica foto e testo</button>`}<button class="btn g" data-act="copy">${ico.cp}Copia testo</button><button class="btn g" data-act="share">Condividi link</button>${kit ? `<a class="tokit" href="${postHref(p)}#kit" data-act="tokit">↓ Vai al press kit</a>` : ''}</div>
    ${lead ? `<div class="brief"><h3>In breve</h3>${lead}</div>` : ''}
    ${kit ? `<section class="kitc" id="kit"><div class="kh"><h2>Press kit</h2><span>${kitSum}</span></div><div id="kitBody">${kitTabs({ post: p.id })}</div></section>` : ''}
    <details class="full"><summary><span class="st">Leggi il comunicato completo</span><span class="prev">${esc(preview)}</span></summary><div class="text" id="atext">${body}${p.textNote ? `<p style="color:var(--mute);font-size:14px">${esc(p.textNote)}</p>` : ''}</div></details>
  </div>
  <aside>
    ${models.length ? `<div class="box"><h4>${models.length > 1 ? 'Modelli in questo comunicato' : 'Modello in questo comunicato'}</h4>
    ${models.map(m => { const a = ALB.find(x => x.model === m); const src = a ? IMG(a.post, a.cover || a.first, '265,175') : coverOf(p); return `<a class="mlink" href="#modello-${slug(m)}"><div style="width:84px">${ph(src, m, col(areaOf(m)))}</div><div><b>${esc(m)}</b><small>Pagina modello →</small></div></a>`; }).join('')}</div>` : ''}
    ${trans.length ? `<div class="box"><h4>${p.lang === 'EN' ? 'Versione in italiano' : 'Versione in inglese'}</h4>${sideLinks(trans)}</div>` : ''}
    ${rel.same.length ? `<div class="box"><h4>Sugli stessi modelli</h4>${sideLinks(rel.same)}</div>` : ''}
    ${rel.area.length ? `<div class="box"><h4>Altri comunicati ${p.area}</h4>${sideLinks(rel.area)}</div>` : ''}
    <div class="box"><h4>Contatti ufficio stampa</h4><div style="font-size:14.5px">Ufficio stampa Suzuki Italia<br>press@suzuki.it · 011 9213711</div></div>
  </aside></div></div>`;
}

/* ---------- pagina modello ---------- */
function model(name) {
  const a = areaOf(name), posts = POSTS.filter(p => p.models.includes(name)), alb = ALB.filter(x => x.model === name);
  const hasMedia = alb.length || DOCS.some(d => d.model === name) || VIDS.some(v => v.model === name);
  const cover = alb.length ? IMG(alb[0].post, alb[0].cover || alb[0].first, '640,480') : posts.length ? coverOf(posts[0]) : '';
  return `<section class="mhero"><div class="wrap"><div>
    <div class="crumbs" style="padding:0 0 10px"><a href="#home">Home</a> › ${a} › ${esc(famOf(name))}</div>
    <span class="fam" style="--c:${col(a)}">${a} · ${esc(famOf(name))}</span><h1 class="mname${/\s/.test(name) ? '' : ' nw'}">${esc(name)}</h1>
    ${FACTS[name] ? `<div class="facts">${FACTS[name].map(f => `<span>${esc(f)}</span>`).join('')}</div>` : '<p style="color:var(--mute)">Scheda, comunicati e materiali del modello, sempre aggiornati in un unico posto.</p>'}
    <div class="follow">${alb.length ? `<button class="btn r" data-act="addmodel" data-m="${esc(name)}">${ico.dl}Scarica tutti i media</button>` : ''}<button class="btn g" data-act="newsletter">Avvisami sulle novità ${esc(name)}</button></div>
  </div>${cover ? ph(cover, name, col(a)) : `<div class="ph" style="--c:${col(a)}"><div class="fb" style="display:flex">${esc(name)}</div></div>`}</div></section>
  <section class="sec"><div class="wrap">
    ${posts.length ? `<div class="sh"><h2>Comunicati</h2><span class="n">${posts.length}</span></div><div class="grid">${posts.map(card).join('')}</div>` : `<div class="soonbox"><h2>Le prime notizie su ${esc(name)} arrivano presto</h2><p>Questa pagina si riempie da sola quando l'ufficio stampa pubblica comunicati, foto e schede su ${esc(name)}. Attiva "Avvisami" per riceverli appena escono.</p></div>
    <div class="sh" style="margin-top:32px"><h2>Intanto, le ultime novità ${a}</h2><a class="n" href="#home" data-area="${a}">Tutte le news ${a} →</a></div><div class="grid">${POSTS.filter(p => p.area === a).slice(0, 3).map(card).join('')}</div>`}
    ${hasMedia ? `<h2 style="font-size:28px;margin-top:40px">Media e documenti</h2><div id="kitBody">${kitTabs({ model: name })}</div>` : ''}
  </div></section>`;
}

/* ---------- media library ---------- */
function media() {
  const ms = [...new Set(ALB.map(a => a.model).filter(Boolean))];
  const others = ALB.some(a => !a.model);
  const f = st.mf;
  const alb = ALB.filter(a => f === 'Tutti' || (f === 'Eventi e altro' ? !a.model : a.model === f));
  return `<section class="sec"><div class="wrap"><div class="sh"><h2>Media library</h2><span class="n">${ALB.reduce((s, a) => s + a.count, 0)} foto in ${ALB.length} album · nomi standard</span></div>
  <div class="chips" style="margin:0 0 20px"><div class="cg"><span>Modello</span>${['Tutti', ...ms, ...(others ? ['Eventi e altro'] : [])].map(o => `<button class="chip" data-mf="${o}" aria-pressed="${f === o}">${o}</button>`).join('')}</div></div>
  <div class="albums">${alb.map(albumCard).join('')}</div>${alb.some(a => a.id === st.album) ? viewer() : ''}
  <h2 style="font-size:24px;margin:40px 0 14px">Foto di copertina dei comunicati</h2>
  <div class="thumbs">${POSTS.map(p => `<button class="th" data-cov="${p.id}" aria-label="Scarica la copertina: ${esc(p.title)}">${ph(IMG(p.id, p.cover || 1, '265,175'), p.title, col(p.area))}<span class="ck">${ico.dl}</span></button>`).join('')}</div>
  </div></section>`;
}

/* ---------- download (simulato): serve l'accesso giornalisti, poi parte subito ---------- */
const albumOfPhoto = (post, n) => ALB.find(a => a.post === post && photoNums(a).includes(n));
const photo = (post, n) => { const a = albumOfPhoto(post, n); return { t: a ? `${albumName(a)} · ${photoNums(a).indexOf(n) + 1}` : 'Foto ' + n, kind: 'Foto' }; };
const albumItems = a => photoNums(a).map(n => photo(a.post, n));
const docItem = i => ({ t: DOCS[i].title, kind: DOCS[i].ext });
function download(items, name) {
  if (!items.length) return;
  if (!st.logged) { loginModal({ items, name }); return; }
  dlReady(items, name);
}
function dlReady(items, name) {
  if (items.length === 1) { toast(`Download avviato: ${items[0].t}${items[0].kind === 'Foto' ? ' (alta risoluzione)' : ''}`); return; }
  const f = items.filter(c => c.kind === 'Foto').length, d = items.length - f;
  modal(`<h2>Il tuo zip è pronto</h2><p><b>${esc(name)}</b><br>${[f ? `${f} foto in alta risoluzione` : '', d ? `${d} ${d === 1 ? 'documento' : 'documenti'}` : ''].filter(Boolean).join(' · ')}</p><p style="font-size:14px">Demo: nella versione reale qui parte il download, e l'ufficio stampa vede nelle statistiche Lulop quali file sono stati scaricati e da quale testata.</p><button class="btn b" data-close>Ok</button>`);
}
const kitItems = id => [...albumsOf(id).flatMap(albumItems), ...docsOf(id).map(d => docItem(DOCS.indexOf(d)))];
function closeAll() { ['#mnav', '#scrim', '#modal'].forEach(s => $(s).classList.remove('on')); $('#burger').setAttribute('aria-expanded', 'false'); }

/* ---------- modali ---------- */
function modal(html) { $('#mcard').innerHTML = `<button class="x" data-close aria-label="Chiudi">×</button>` + html; $('#modal').classList.add('on'); $('#scrim').classList.add('on'); }
function loginModal(then) {
  st.after = then;
  modal(`<h2>Area giornalisti</h2><p>Accedi per scaricare foto e video in alta risoluzione. L'accesso è gratuito per i giornalisti accreditati.</p>
  <div class="field">Email di lavoro<input type="email" value="redazione@testata.it" aria-label="Email"></div>
  <div class="field">Password<input type="password" value="demo-demo" aria-label="Password"></div>
  <button class="btn b" style="width:100%;justify-content:center" data-act="dologin">Accedi (demo)</button>
  <p style="margin-top:14px;font-size:14px">Non sei registrato? <a href="#" data-act="newsletter">Richiedi l'accesso</a></p>`);
}
function nlModal(step) {
  if (step === 2) { modal(`<div class="steps">Passo 2 di 2</div><h2>La tua testata</h2><p>Facoltativo: ci aiuta a mandarti solo ciò che ti serve.</p><div class="field">Testata<input placeholder="es. Motociclismo"></div><button class="ib" style="margin-bottom:12px" data-act="addtestata">+ Aggiungi un'altra testata</button><div class="field">Telefono (facoltativo)<input type="tel"></div><button class="btn b" style="width:100%;justify-content:center" data-act="nldone">Completa</button>`); return; }
  modal(`<div class="steps">Passo 1 di 2</div><h2>Ricevi i comunicati Suzuki</h2><p>Scegli le aree: riceverai solo quelle.</p>
  <div class="field">Email<input type="email" placeholder="nome@testata.it"></div>
  <div class="checks">${['Auto', 'Moto', 'Marine', 'Corporate'].map(a => `<label><input type="checkbox" ${a === 'Moto' ? 'checked' : ''}> ${a}</label>`).join('')}</div>
  <label class="consent"><input type="checkbox"> Acconsento a ricevere i comunicati stampa di Suzuki Italia via email (obbligatorio). <a href="#">Informativa privacy</a></label>
  <label class="consent"><input type="checkbox"> Acconsento alla misurazione di aperture e clic per migliorare il servizio (facoltativo).</label>
  <button class="btn b" style="width:100%;justify-content:center" data-act="nl2">Continua</button>`);
}
function setLoginLabel() { $('#loginLbl').textContent = st.logged ? 'Redazione' : 'Area giornalisti'; }
let tt; function toast(m) {
  const t = $('#toast');
  t.textContent = m;
  t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200);
}

/* ---------- router ---------- */
function route() {
  const raw = location.hash.slice(1) || 'home';
  const [h, anchor] = raw.split('#');
  closeAll(); clearTimeout(heroT);
  let html, scrollTarget = null;
  st.cur = null;
  if (h === 'comunicato' || h.startsWith('comunicato-')) {
    const p = postById(h.slice(11)) || POSTS.find(x => x.featured) || POSTS.find(x => x.kit);
    if (st.curPost !== p.id) { st.album = null; st.shown = 24; st.tab = 'foto'; }
    st.curPost = p.id; st.cur = { post: p.id };
    html = article(p); scrollTarget = anchor;
  } else if (h.startsWith('marine-') || h === 'gamma-marine' || (h.startsWith('modello-') && MCATS().some(c => slug(c) === h.slice(8)))) {
    /* Marine: pagine per categoria; i vecchi link gamma/modello portano qui */
    const k = h.replace(/^(marine|modello|gamma)-/, '');
    html = marine([...MCATS(), MGEN].find(c => slug(c) === k) || MGEN);
  } else if (h.startsWith('modello-')) {
    const m = allModels().find(x => slug(x) === h.slice(8)) || 'GSX-10R';
    if (st.curModel !== m) { st.album = null; st.shown = 24; st.tab = 'foto'; }
    st.curModel = m; st.cur = { model: m };
    html = model(m);
  } else if (h.startsWith('gamma-') && Object.keys(MODELS).some(a => slug(a) === h.slice(6))) {
    const a = Object.keys(MODELS).find(x => slug(x) === h.slice(6));
    if (st.curGamma !== a) { st.gq = ''; st.gf = 'Tutte'; }
    st.curGamma = a; st.gamma = a;
    html = gamma(a);
  } else if (h === 'media') html = media();
  else html = home();
  const isHome = !st.cur && h !== 'media' && !h.startsWith('gamma-') && !html.includes('class="ghead"');
  if (!h.startsWith('gamma-')) st.gamma = null;
  $('#app').innerHTML = html;
  $('#app').classList.toggle('searching', isHome && searchActive());
  if (isHome) { renderResults(); initHero(); }
  const target = scrollTarget && document.getElementById(scrollTarget);
  if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
  fades();
}
function rerenderKit() {
  const h = location.hash.slice(1);
  if (h === 'media') { const y = scrollY; $('#app').innerHTML = media(); scrollTo(0, y); return; }
  const kb = $('#kitBody'); if (kb && st.cur) kb.innerHTML = kitTabs(st.cur);
}

/* ---------- eventi ---------- */
document.addEventListener('input', e => { if (e.target.id === 'gq') { st.gq = e.target.value; $('#glist').innerHTML = gammaList(st.gamma); return; } if (e.target.id === 'q') { const was = searchActive(); st.q = e.target.value; renderResults(); if (!was && searchActive()) toResults(); } });
function closeMegas() { document.querySelectorAll('nav.main .open').forEach(x => { x.classList.remove('open'); x.firstChild.setAttribute('aria-expanded', 'false'); }); }
document.addEventListener('click', e => {
  if (!e.target.closest('.mega, [data-mega]')) closeMegas();
  if (e.target.closest('.mega a')) closeMegas();
  const t = e.target.closest('button,a'); if (!t) return;
  if (t.dataset.close !== undefined) { closeAll(); return; }
  if (t.dataset.mega !== undefined) { const p = t.parentNode, o = p.classList.contains('open'); document.querySelectorAll('nav.main .open').forEach(x => { x.classList.remove('open'); x.firstChild.setAttribute('aria-expanded', 'false'); }); if (!o) { p.classList.add('open'); t.setAttribute('aria-expanded', 'true'); } return; }
  closeMegas();
  if (t.id === 'clr') { e.preventDefault(); st.q = ''; $('#q').value = ''; renderResults(); $('#q').focus(); return; }
  if (t.dataset.area) { st.area = t.dataset.area; st.q = ''; st.type = 'Tutti'; if (location.hash === '#home' || location.hash === '') { e.preventDefault(); route(); } setTimeout(() => $('#cerca')?.scrollIntoView(), 30); return; }
  if (t.dataset.f) { const was = searchActive(); st[t.dataset.f] = t.dataset.v; document.querySelectorAll(`[data-f="${t.dataset.f}"]`).forEach(b => b.setAttribute('aria-pressed', b === t)); renderResults(); if (!was && searchActive()) toResults(); return; }
  if (t.dataset.gf) { st.gf = t.dataset.gf; document.querySelectorAll('[data-gf]').forEach(b => b.setAttribute('aria-pressed', b === t)); $('#glist').innerHTML = gammaList(st.gamma); return; }
  if (t.dataset.mf) { st.mf = t.dataset.mf; st.album = null; rerenderKit(); return; }
  if (t.dataset.tab) { st.tab = t.dataset.tab; rerenderKit(); return; }
  if (t.dataset.album) { st.album = st.album === t.dataset.album ? null : t.dataset.album; st.shown = 24; rerenderKit(); setTimeout(() => $('#viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30); return; }
  if (t.dataset.ph) { download([photo(+t.dataset.pp, +t.dataset.ph)]); return; }
  if (t.dataset.cov) { const p = postById(t.dataset.cov); download([{ t: 'Copertina – ' + p.title, kind: 'Foto' }]); return; }
  if (t.dataset.doc) { download([docItem(+t.dataset.doc)]); return; }
  const a = t.dataset.act; if (!a) return; e.preventDefault();
  const A = ALB.find(x => x.id === st.album);
  ({
    addkit: () => { const p = postById(t.dataset.post); download(kitItems(p.id), 'Press kit – ' + p.title); },
    addbasic: () => { const p = postById(t.dataset.post); download([{ t: 'Copertina – ' + p.title, kind: 'Foto' }, { t: 'Testo – ' + p.title, kind: 'TXT' }], 'Foto e testo – ' + p.title); },
    tokit: () => document.getElementById('kit')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    dlalbum: () => download(albumItems(A), albumName(A)),
    addmodel: () => { const m = t.dataset.m; download([...ALB.filter(x => x.model === m).flatMap(albumItems), ...DOCS.map((d, i) => [d, i]).filter(([d]) => d.model === m).map(([, i]) => docItem(i))], 'Tutti i media – ' + m); },
    closealbum: () => { st.album = null; rerenderKit(); },
    more: () => { st.shown += 24; rerenderKit(); },
    reset: () => { Object.assign(st, { q: '', area: 'Tutte', type: 'Tutti', lang: 'Tutte', per: 'Tutto' }); route(); },
    video: () => toast('Anteprima video: nella versione reale si apre il player'),
    copy: async () => { try { await navigator.clipboard.writeText(textOf(postById(st.curPost))); toast('Testo copiato negli appunti'); } catch (_) { toast('Copia non consentita in questa anteprima'); } },
    share: async () => { const p = postById(st.curPost); const url = `https://press.suzuki.it/${slug(p.area)}/${p.id}`; try { await navigator.clipboard.writeText(url); toast('Link copiato: ' + url.replace('https://', '')); } catch (_) { toast('Link: ' + url.replace('https://', '')); } },
    dologin: () => { st.logged = true; save(); setLoginLabel(); closeAll(); const w = st.after; st.after = null; if (w) dlReady(w.items, w.name); else toast('Accesso effettuato: alta risoluzione sbloccata'); },
    newsletter: () => { closeAll(); nlModal(1); },
    login: () => { closeAll(); if (st.logged) toast('Sei già nell\'area giornalisti'); else loginModal(); },
    nl2: () => nlModal(2),
    addtestata: () => { t.insertAdjacentHTML('beforebegin', '<div class="field">Altra testata<input></div>'); },
    nldone: () => { closeAll(); toast('Iscrizione completata: riceverai una mail di conferma'); }
  })[a]?.();
});
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; const open = document.querySelector('nav.main .open'); if (open) { closeMegas(); open.firstChild.focus(); } closeAll(); });
$('#scrim').addEventListener('click', closeAll);
$('#loginBtn').addEventListener('click', () => { if (st.logged) { toast('Sei già nell\'area giornalisti'); return; } loginModal(); });
$('#burger').addEventListener('click', () => { $('#mnav').classList.add('on'); $('#scrim').classList.add('on'); $('#burger').setAttribute('aria-expanded', 'true'); $('#mnav .x')?.focus(); });
$('#srchBtn').addEventListener('click', () => { if (location.hash && location.hash !== '#home') { location.hash = 'home'; setTimeout(() => $('#q')?.focus(), 60); } else { $('#cerca')?.scrollIntoView({ behavior: 'smooth' }); $('#q')?.focus(); } });
function fades() { document.querySelectorAll('.cg').forEach(c => { c.classList.toggle('scrollx', c.scrollWidth > c.clientWidth + 2); c.classList.toggle('end', c.scrollLeft + c.clientWidth >= c.scrollWidth - 2); }); }
document.addEventListener('scroll', e => { if (e.target.classList?.contains('cg')) fades(); }, true);
window.addEventListener('resize', fades);
window.addEventListener('hashchange', route);
renderNav(); setLoginLabel(); route();
})();
