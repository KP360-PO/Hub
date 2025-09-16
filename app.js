/* ========= Router & Theme ========= */
const pages = Array.from(document.querySelectorAll('.page'));
const footer = document.getElementById('footer');
const themeToggle = document.getElementById('themeToggle');

const sunSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>`;
const moonSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
function setThemeIcon(mode){ themeToggle.innerHTML = (mode === 'dark') ? sunSVG : moonSVG; }
function applyTheme(mode){
  if(mode==='dark') document.body.classList.add('dark'); else document.body.classList.remove('dark');
  localStorage.setItem('theme',mode); setThemeIcon(mode);
}
themeToggle.addEventListener('click', ()=> applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
const saved = localStorage.getItem('theme');
applyTheme(saved ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

function setActive(view){
  const v = view || 'home';
  pages.forEach(p => p.classList.toggle('active', p.getAttribute('data-page') === v));
  const hash = v === 'home' ? '#home' : '#' + v;
  if (location.hash !== hash) history.pushState({view:v}, '', hash);
  window.scrollTo({top:0, behavior:'smooth'});

  const slim = v !== 'home';
  footer.classList.toggle('slim', slim);
  document.documentElement.style.setProperty('--footer-h', slim ? '24px' : '36px');
  document.body.style.paddingBottom = getComputedStyle(document.documentElement).getPropertyValue('--footer-h').trim();

  if (v === 'supplier-contacts') setTimeout(loadSupplierContacts, 0);
  if (v === 'top-performers') setTimeout(() => loadTopPerformers(false), 0);
  if (v === 'po-spreadsheets') ensureLinkGrid('grid-po-spreadsheets', PO_SPREADSHEETS);
  if (v === 'po-tools') ensureLinkGrid('grid-po-tools', PO_TOOLS);
  if (v === 'marketplaces') ensureLinkGrid('grid-marketplaces', MARKETPLACES);
  if (v === 'mailboxes') ensureLinkGrid('grid-mailboxes', MAILBOXES);
  if (v === 'supplier-websites') ensureLinkGrid('grid-supplier-websites', SUPPLIER_WEBSITES);
  if (v === 'sops') ensureLinkGrid('grid-sops', SOP_LINKS);
}
document.addEventListener('click', (e)=>{
  const link = e.target.closest('[data-view]');
  if(link){ e.preventDefault(); setActive(link.getAttribute('data-view')); }
});
window.addEventListener('popstate', e=>{
  const v = (e.state && e.state.view) || (location.hash || '#home').replace('#','');
  setActive(v);
});
document.querySelector('.brand').addEventListener('click', ()=> setActive('home'));
setActive((location.hash || '#home').replace('#',''));

/* ========= Apps Script Endpoint ========= */
const SUPPLIER_API = "https://script.google.com/macros/s/AKfycbw1y2WxgBD7HI5crf4ZXvFKrh0lKOHgTs1EjOc4ZWAkRX8OO84aqZGeRDDpr7aN1Zdp8g/exec";

async function getJSON(res){
  const text = await res.text();
  try { return JSON.parse(text); } catch(e){ throw new Error('Invalid JSON from API'); }
}
function normalizeToHeadersRows(payload){
  if (payload && Array.isArray(payload.headers) && Array.isArray(payload.rows)) {
    const headers = payload.headers;
    const rows = payload.rows.map(r => Array.isArray(r) ? r : headers.map(h => valueFromObj(r, h)));
    return { headers, rows };
  }
  if (Array.isArray(payload) && payload.length && typeof payload[0] === 'object') {
    const headers = Array.from(new Set(payload.flatMap(o => Object.keys(o))));
    const rows = payload.map(o => headers.map(h => valueFromObj(o, h)));
    return { headers, rows };
  }
  if (Array.isArray(payload) && payload.length && Array.isArray(payload[0])) {
    return { headers: payload[0], rows: payload.slice(1) };
  }
  throw new Error('Unexpected API shape');
}
function valueFromObj(obj, header){
  if (!obj) return '';
  if (header in obj) return obj[header] ?? '';
  const lower = header.toLowerCase();
  const candidates = [lower, lower.replace(/\s+/g,'_'), lower.replace(/\s+/g,''), header.replace(/\s+/g,'_')];
  for (const k of Object.keys(obj)) {
    const kl = k.toLowerCase();
    if (kl === lower || candidates.includes(kl)) return obj[k] ?? '';
  }
  return '';
}

/* ========= Supplier Contacts ========= */
function buildContactsTable(headers, rows){
  const wrap = document.getElementById('contactsTableWrap');
  const sel  = document.getElementById('contactsSupplierFilter');
  const searchEl = document.getElementById('contactsSearch');

  const idx = {};
  headers.forEach((h,i)=> idx[(h||'').toString().trim().toLowerCase()] = i);

  const col = {
    supplier: idx['supplier'] ?? idx['vendor'] ?? idx['company'],
    contact : idx['contact'] ?? idx['name'] ?? idx['contact name'] ?? idx['full name'],
    email   : idx['email'] ?? idx['email address'],
    phone   : idx['phone'] ?? idx['phone number'] ?? idx['contact number'] ?? idx['mobile'],
    notes   : idx['notes'] ?? idx['remarks'] ?? idx['comment'] ?? idx['comments'] ?? -1
  };

  function mount(filtered){
    const table = document.createElement('table');
    table.className = 'contacts-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Supplier</th><th>Contact</th><th>Email</th><th>Phone</th><th>Notes</th>
    </tr>`;
    const tbody = document.createElement('tbody');

    filtered.forEach(r=>{
      const row = Array.isArray(r) ? r : headers.map(h => valueFromObj(r, h));
      if(!row || row.every(c => c===''||c==null)) return;

      const supplier = col.supplier!=null ? (row[col.supplier]||'') : '';
      const contact  = col.contact !=null ? (row[col.contact ]||'') : '';
      const email    = col.email   !=null ? (row[col.email   ]||'') : '';
      const phone    = col.phone   !=null ? (row[col.phone   ]||'') : '';
      const notes    = col.notes   !=-1   ? (row[col.notes   ]||'') : '';

      const tr = document.createElement('tr');

      const tdSupplier=document.createElement('td'); tdSupplier.textContent=supplier;
      const tdContact =document.createElement('td'); tdContact.textContent =contact;
      const tdEmail   =document.createElement('td');
      if(email && /@/.test(email)){ const a=document.createElement('a'); a.href=`mailto:${email}`; a.textContent=email; tdEmail.appendChild(a); }
      else tdEmail.textContent=email;
      const tdPhone   =document.createElement('td'); tdPhone.textContent  =phone;
      const tdNotes   =document.createElement('td'); tdNotes.textContent  =notes;

      tr.append(tdSupplier,tdContact,tdEmail,tdPhone,tdNotes);
      tbody.appendChild(tr);
    });

    table.append(thead,tbody);
    wrap.innerHTML=""; wrap.appendChild(table);
  }

  const supplierIdx = col.supplier ?? -1;
  const suppliers = supplierIdx===-1 ? [] : Array.from(new Set(rows.map(r => {
    const row = Array.isArray(r) ? r : headers.map(h => valueFromObj(r,h));
    return (row[supplierIdx]||'').toString().trim();
  }).filter(Boolean))).sort();
  sel.innerHTML = '<option value="">All</option>' + suppliers.map(s=>`<option value="${s}">${s}</option>`).join('');

  mount(rows);

  function applyFilters(){
    const supplierVal = sel.value.trim().toLowerCase();
    const q = (searchEl.value||'').trim().toLowerCase();
    const filtered = rows.filter(r=>{
      const row = Array.isArray(r) ? r : headers.map(h => valueFromObj(r,h));
      const sup = supplierIdx!==-1 ? (row[supplierIdx]||'').toString().toLowerCase() : '';
      const matchesSupplier = !supplierVal || sup === supplierVal;
      if(!q) return matchesSupplier;
      const matchesText = row.some(c => (c??'').toString().toLowerCase().includes(q));
      return matchesSupplier && matchesText;
    });
    mount(filtered);
  }
  sel.onchange = applyFilters;
  searchEl.oninput = applyFilters;
}

async function loadSupplierContacts(){
  const statusEl = document.getElementById('contactsStatus');
  const errEl = document.getElementById('contactsError');
  try{
    statusEl.textContent = 'Loading…';
    errEl.style.display = 'none';

    const url = SUPPLIER_API + '?sheet=' + encodeURIComponent('Supplier Contacts');
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await getJSON(res);
    if (raw && raw.error) throw new Error(raw.error);

    const { headers, rows } = normalizeToHeadersRows(raw);
    if (!Array.isArray(headers) || !Array.isArray(rows)) throw new Error('Unexpected API shape');

    buildContactsTable(headers, rows);
    statusEl.textContent = `${rows.length} contacts loaded`;
  }catch(err){
    console.error(err);
    statusEl.textContent = 'Failed to load contacts';
    errEl.textContent = 'Error: ' + err.message + ' — confirm the Web App is deployed (Anyone with the link) and the tab is exactly “Supplier Contacts”.';
    errEl.style.display = 'block';
  }
}

/* ========= Top Performers ========= */
const PHOTO_BASES = [
  "https://raw.githubusercontent.com/KP360-PO/KPP/a0d4bb8d6909b10d25c517c65568568e4d37580b/path/to/photos/",
  "https://raw.githubusercontent.com/purchase-order-team/Processors/main/path/to/photos/"
];
function buildPhotoUrl(filename, baseIdx=0){
  const clean = encodeURIComponent(String(filename||'').trim());
  return PHOTO_BASES[baseIdx] + clean;
}
function renderTPCard(p){
  const div = document.createElement('div');
  div.className = 'tp-card';
  const img = document.createElement('img');
  img.alt = p.name;
  img.src = buildPhotoUrl(p.photoFile, 0);
  img.dataset.baseIdx = "0";
  img.onerror = () => {
    const idx = Number(img.dataset.baseIdx || "0");
    if (idx + 1 < PHOTO_BASES.length){
      img.dataset.baseIdx = String(idx + 1);
      img.src = buildPhotoUrl(p.photoFile, idx + 1);
    } else {
      img.onerror = null;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='110' height='110'>
           <rect width='100%' height='100%' rx='55' ry='55' fill='#e5e7eb'/>
           <text x='50%' y='52%' font-size='12' text-anchor='middle' fill='#6b7280'>No photo</text>
         </svg>`
      );
    }
  };
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = p.name;
  div.append(img,name);
  return div;
}
function buildTPGrid(list, note=''){
  const grid = document.getElementById('tp-page-grid'); if(!grid) return;
  grid.innerHTML = "";
  if (note){
    const n = document.createElement('div');
    n.style.cssText="margin:.25rem 0 1rem;color:var(--ink-2);font-size:.9rem";
    n.textContent = note;
    grid.appendChild(n);
  }
  if (!list.length) return;
  list.forEach(p => grid.appendChild(renderTPCard(p)));
}
function openTPModalSkeleton(){
  if (document.querySelector('.tp-overlay')) return;
  const overlay = document.createElement('div'); overlay.className='tp-overlay';
  const modal = document.createElement('div'); modal.className='tp-modal';
  const head = document.createElement('div'); head.className='tp-head';
  head.innerHTML = `<strong>🎉 Top Performers — Loading…</strong>`;
  const close = document.createElement('button'); close.className='tp-close'; close.textContent='Close';
  close.onclick = () => overlay.remove(); head.appendChild(close);
  const body = document.createElement('div'); body.className='tp-body';
  const skeleton = document.createElement('div'); skeleton.className='tp-skeleton';
  for (let i=0;i<8;i++){ const c=document.createElement('div'); c.className='cell'; skeleton.appendChild(c); }
  body.appendChild(skeleton);
  const grid = document.createElement('div'); grid.className='tp-grid'; grid.style.display='none'; body.appendChild(grid);
  modal.append(head,body); overlay.appendChild(modal); document.body.appendChild(overlay);
}
function fillTPModal(list, monthLabel){
  const overlay = document.querySelector('.tp-overlay'); if (!overlay) return;
  const body = overlay.querySelector('.tp-body');
  const skeleton = body.querySelector('.tp-skeleton'); if (skeleton) skeleton.remove();
  const grid = body.querySelector('.tp-grid'); grid.style.display='grid'; grid.innerHTML='';
  overlay.querySelector('.tp-head strong').textContent = `🎉 Top Performers — ${monthLabel || 'Top Performers'}`;
  if (!list || !list.length){ const empty=document.createElement('div'); empty.textContent='No rows in Top Performer sheet.'; empty.style.cssText='color:var(--ink-2)'; grid.appendChild(empty); return; }
  list.forEach(p => grid.appendChild(renderTPCard(p)));
}
async function loadTopPerformers(showModal=false){
  const grid = document.getElementById('tp-page-grid');
  if (showModal) openTPModalSkeleton();
  try{
    const url = SUPPLIER_API + '?sheet=' + encodeURIComponent('Top Performer');
    const res = await fetch(url, { cache:'no-store' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await getJSON(res);
    const { headers, rows } = normalizeToHeadersRows(raw);

    const idx = {}; headers.forEach((h,i)=> idx[String(h||'').trim().toLowerCase()] = i);
    const iName  = idx['name'] ?? idx['employee'] ?? idx['full name'] ?? idx['contact'];
    const iPhoto = idx['photo'] ?? idx['photo file'] ?? idx['photo filename'] ?? idx['filename'];

    if (iName == null || iPhoto == null) {
      buildTPGrid([], `No “Name”/“Photo” columns found in Top Performer. Headers: ${headers.join(', ')}`);
      if (showModal) fillTPModal([], null);
      return;
    }

    const list = rows
      .map(r => Array.isArray(r) ? r : headers.map(h => valueFromObj(r,h)))
      .map(r => ({ name: (r[iName]??'').toString().trim(), photoFile: (r[iPhoto]??'').toString().trim() }))
      .filter(p => p.name && p.photoFile);

    if (!list.length){
      buildTPGrid([], 'No rows in Top Performer sheet.');
      if (showModal) fillTPModal([], null);
    } else {
      buildTPGrid(list);
      if (showModal){
        const monthLabel = new Date(Date.now()-86400000*30).toLocaleString(undefined,{month:'long',year:'numeric'});
        fillTPModal(list, monthLabel);
      }
    }
  }catch(err){
    console.error('Top Performers load error:', err);
    if (grid) grid.innerHTML = `<div class="error">Top Performers error: ${err.message}. Test JSON: <a href="${SUPPLIER_API + '?sheet=' + encodeURIComponent('Top Performer')}" target="_blank" rel="noopener">open</a></div>`;
    if (showModal) fillTPModal([], null);
  }
}

/* ========= Link Grids =========
   Edit these arrays only — search picks them up automatically */
const PO_SPREADSHEETS = [
  // { name: 'Example Sheet', url: 'https://docs.google.com/spreadsheets/...', note: 'Tracker' },
];
const PO_TOOLS = [
  { name: 'Task Tracker', url: 'https://kp360-po.github.io/task-tracker/', note: 'PO tasks dashboard' },
  { name: 'PO Portal', url: 'https://kp360-po.github.io/KPP/PO_Portal.html', note: 'Projects & docs' },
];
const MARKETPLACES = [
  // { name: 'Amazon Seller Central', url: 'https://sellercentral.amazon.com', note: 'KP360 store' },
  // { name: 'eBay Seller Hub', url: 'https://www.ebay.com/sh/ovw', note: 'Marketplace' },
];
const MAILBOXES = [
  // { name: 'PO Team Mailbox', url: 'mailto:po-team@karparts360.com', note: 'Shared inbox' },
];
const SUPPLIER_WEBSITES = [
  // { name: 'Supplier A Portal', url: 'https://supplier-a.example.com', note: 'Orders & tickets' },
];
const SOP_LINKS = [
  // { name: 'Returns SOP', url: 'https://docs.google.com/document/...', note: 'RMA flow' },
  // { name: 'PO Creation SOP', url: 'https://docs.google.com/document/...', note: 'How to create POs' },
];

function ensureLinkGrid(containerId, items){
  const el = document.getElementById(containerId);
  if (!el || el.dataset.rendered) return;
  buildLinkGrid(el, items||[]);
  el.dataset.rendered = '1';
}
function buildLinkGrid(container, items){
  container.innerHTML = '';
  if (!items || !items.length){
    const empty = document.createElement('div');
    empty.className = 'error';
    empty.textContent = 'No links configured yet. Edit the array in app.js to add items.';
    container.appendChild(empty);
    return;
  }
  items.forEach(it => container.appendChild(linkCard(it)));
}
function linkCard({name, url, note}){
  const a = document.createElement('a');
  a.className = 'link-card';
  a.href = url || '#';
  if (url && /^https?:\/\//i.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
  a.innerHTML = `
    <div class="lc-ico">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 1 7.07 0l2 2a5 5 0 0 1-7.07 7.07l-2-2" />
        <path d="M14 11a5 5 0 0 1-7.07 0l-2-2a5 5 0 0 1 7.07-7.07l2 2" />
      </svg>
    </div>
    <div>
      <strong>${name||'Untitled'}</strong>
      ${note ? `<small>${note}</small>` : ''}
      ${url ? `<div style="font-size:.75rem;color:var(--ink-2);word-break:break-all">${url}</div>` : ''}
    </div>
  `;
  return a;
}

/* ========= SEARCH (icons + inside icons) ========= */
const CATALOG = [
  { page:'po-projects',   title:'PO Projects',   keywords:['projects','po','portal','docs','kpp'], items: ()=>[] },
  { page:'supplier-contacts', title:'Supplier Contacts', keywords:['contacts','vendors','phone','email','supplier'], items: ()=>[] },
  { page:'email-templates', title:'Email Templates', keywords:['templates','email','reply','canned responses'], items: ()=>[] },
  { page:'schedule',       title:'Schedule',     keywords:['calendar','roster','shift'], items: ()=>[] },
  { page:'task-monitoring',title:'Task Monitoring', keywords:['tasks','tracker','kanban','status'], items: ()=>[] },
  { page:'tracker',        title:'Tracker',      keywords:['status','metrics','tracking'], items: ()=>[] },
  { page:'marketplace-performance', title:'Marketplace Performance', keywords:['kpi','revenue','conversion','marketplace','performance'], items: ()=>[] },
  { page:'top-performers', title:'Top Performers', keywords:['awards','recognition','employees'], items: ()=>[] },
  { page:'po-spreadsheets',title:'PO Spreadsheets', keywords:['sheets','spreadsheets','gdrive','excel'], items: ()=> PO_SPREADSHEETS },
  { page:'po-tools',       title:'PO Tools',     keywords:['tools','utility','automation','dashboard'], items: ()=> PO_TOOLS },
  { page:'marketplaces',   title:'Marketplaces', keywords:['amazon','ebay','walmart','marketplace','seller'], items: ()=> MARKETPLACES },
  { page:'mailboxes',      title:'Mailboxes',    keywords:['inbox','gmail','outlook','email','support'], items: ()=> MAILBOXES },
  { page:'supplier-websites', title:'Supplier Websites', keywords:['supplier','portal','ordering','tickets'], items: ()=> SUPPLIER_WEBSITES },
  { page:'sops',           title:'SOPs',         keywords:['standard operating procedures','guidelines','policy','process','how-to'], items: ()=> SOP_LINKS },
];

function buildIndex(){
  const entries = [];
  CATALOG.forEach(cat => {
    entries.push({ kind:'category', page:cat.page, title:cat.title, subtitle:'Open section', haystack:(cat.title+' '+cat.keywords.join(' ')).toLowerCase() });
    try{
      (cat.items()||[]).forEach(it => {
        const hs = [(it.name||''), (it.note||''), (it.url||''), cat.title, ...(cat.keywords||[])].join(' ').toLowerCase();
        entries.push({ kind:'item', page:cat.page, title:it.name||'Untitled', subtitle:(it.note||cat.title), url:it.url||'', haystack:hs });
      });
    }catch(_e){}
  });
  return entries;
}
const searchInput = document.getElementById('globalSearch');
const searchBtn = document.getElementById('searchBtn');
const resultsEl = document.getElementById('searchResults');
let indexCache = null;
function ensureIndex(){ if(!indexCache) indexCache = buildIndex(); return indexCache; }

function search(q){
  const query = (q||'').trim().toLowerCase();
  const res = [];
  if (!query) return res;
  const idx = ensureIndex();
  idx.forEach(e => { if (e.haystack.includes(query)) res.push(e); });
  res.sort((a,b)=>{
    if(a.kind!==b.kind) return a.kind==='item' ? -1 : 1;
    const ad = (a.title.toLowerCase().indexOf(query)); const bd = (b.title.toLowerCase().indexOf(query));
    return (ad<0?999:ad) - (bd<0?999:bd);
  });
  return res.slice(0, 20);
}
function renderResults(list){
  resultsEl.innerHTML = '';
  if (!list.length){ resultsEl.classList.remove('visible'); return; }
  list.forEach((e,i)=>{
    const item = document.createElement('div');
    item.className = 'res-item'; item.role='option'; item.dataset.index=String(i);
    item.innerHTML = `
      <div class="res-ico">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          ${e.kind==='item' ? '<path d="M9 12l2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/>' : '<circle cx="12" cy="12" r="9"/>'}
        </svg>
      </div>
      <div class="res-main">
        <div class="res-title">${e.title}</div>
        <div class="res-sub">${e.subtitle || (e.kind==='item' ? 'Link' : 'Section')} · <em>${e.page}</em></div>
      </div>`;
    item.addEventListener('click', ()=> actOnResult(e));
    resultsEl.appendChild(item);
  });
  resultsEl.classList.add('visible');
}
function actOnResult(e){
  setActive(e.page);
  if (e.kind==='item' && e.url){
    try{ window.open(e.url, '_blank', 'noopener'); }catch(_){ location.href = e.url; }
  }
  resultsEl.classList.remove('visible');
}
function doSearch(){
  const q = searchInput.value;
  const res = search(q);
  if (res.length){ renderResults(res); }
  else { resultsEl.classList.remove('visible'); }
}
let t=null; searchInput.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(doSearch, 120); });
searchBtn.addEventListener('click', doSearch);
document.addEventListener('click', (e)=>{ if (!e.target.closest('.search')) resultsEl.classList.remove('visible'); });
searchInput.addEventListener('keydown', (e)=>{
  if (e.key==='Enter'){ const res = search(searchInput.value); if (res.length){ actOnResult(res[0]); } e.preventDefault(); }
  if (e.key==='Escape') resultsEl.classList.remove('visible');
});

/* ===== Initial triggers ===== */
document.addEventListener('DOMContentLoaded', () => {
  const initial = (location.hash || '#home').replace('#','') || 'home';
  if (initial === 'home') {
    openTPModalSkeleton();
    loadTopPerformers(true);
  } else {
    loadTopPerformers(false);
  }
});
const initial = (location.hash || '#home').replace('#','');
if (initial === 'supplier-contacts') setTimeout(loadSupplierContacts, 0);
