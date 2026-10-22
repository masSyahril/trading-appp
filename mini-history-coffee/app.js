// Mini History Coffee - page behaviour.
// Edit CONFIG to match the cafe; everything else reads from it.
const CONFIG = {
  // Instagram username without "@". TODO: confirm the real handle.
  instagramHandle: 'minihistorycoffee',

  // Server proxy that holds the Instagram token (see api/instagram.php).
  feedUrl: 'api/instagram.php',
  pollMinutes: 3,

  // Closing time is from Google Maps (00.00). Opening time isn't listed
  // there yet - set e.g. openHour: 15 to show the "open now" line.
  openHour: null,
  closeHour: 24,

  // Your own photos in foto/ (see foto/README.txt). Shown at the top of the
  // page and in "Suasana kedai" while the Instagram feed isn't connected.
  photos: [],

  // TODO: replace with the real menu and prices (e.g. 'Rp18.000').
  // Leave price empty to show the item without one.
  menu: [
    { group: 'Kopi', items: [
      { name: 'Kopi susu', note: 'Espresso, susu segar, gula aren' },
      { name: 'Americano', note: 'Panas atau dingin' },
      { name: 'Cappuccino' },
      { name: 'Manual brew', note: 'V60, biji pilihan minggu ini' },
    ]},
    { group: 'Bukan kopi', items: [
      { name: 'Cokelat' },
      { name: 'Matcha latte' },
      { name: 'Teh' },
    ]},
    { group: 'Teman ngopi', items: [
      { name: 'Roti bakar' },
      { name: 'Kentang goreng' },
      { name: 'Pisang goreng' },
    ]},
  ],
};

const igProfile = `https://www.instagram.com/${CONFIG.instagramHandle}/`;
const seenKey = 'mhc-seen-posts';
const dayFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long' });
const timeFmt = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child != null) node.append(child);
  }
  return node;
}

function readSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); }
  catch { return new Set(); }
}
function writeSeen(ids) {
  try { localStorage.setItem(seenKey, JSON.stringify(ids.slice(0, 50))); } catch { /* private mode */ }
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

function dayLabel(date) {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diff === 0) return 'Hari ini';
  if (diff === 1) return 'Kemarin';
  return dayFmt.format(date);
}

function relative(date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return timeFmt.format(date);
}

function firstLine(caption) {
  return (caption || '').split('\n')[0].trim();
}

// items: [{ image, alt, label, href? }], newest last so it lands on top.
const tilts = ['-7deg', '5deg', '-1.5deg'];
function renderPrints(items) {
  const prints = $('prints');
  if (!items.length) return;
  prints.replaceChildren(...items.slice(0, 3).map((item, i) => {
    const attrs = { class: 'print', style: `--r:${tilts[i]};--i:${i}` };
    if (item.href) Object.assign(attrs, { href: item.href, target: '_blank', rel: 'noopener' });
    return el(item.href ? 'a' : 'figure', attrs,
      el('div', { class: 'print-img', role: 'img', 'aria-label': item.alt, style: `background-image:url("${encodeURI(item.image)}")` }),
      el('figcaption', {}, item.label));
  }));
}

function postsToPrints(posts) {
  return posts.slice(0, 3).reverse().map((p) => {
    const date = new Date(p.timestamp);
    return {
      image: p.image,
      alt: firstLine(p.caption) || 'Foto dari Instagram',
      label: `${dayLabel(date)}, ${timeFmt.format(date)}`,
      href: p.permalink,
    };
  });
}

function photosToPrints(photos) {
  return photos.slice(0, 3).reverse().map((p) => ({ image: p.src, alt: p.caption || 'Foto kedai', label: p.caption || '' }));
}

function renderGallery() {
  if (!CONFIG.photos.length) return;
  $('suasana').hidden = false;
  $('gallery-grid').replaceChildren(...CONFIG.photos.map((p) =>
    el('figure', {},
      el('img', { src: p.src, alt: p.caption || 'Foto kedai', loading: 'lazy' }),
      p.caption ? el('figcaption', {}, p.caption) : null)));
}

function renderTimeline(posts, seen) {
  const groups = new Map();
  for (const p of posts) {
    const date = new Date(p.timestamp);
    const key = startOfDay(date);
    if (!groups.has(key)) groups.set(key, { date, posts: [] });
    groups.get(key).posts.push(p);
  }

  const firstVisit = seen.size === 0;
  $('timeline').replaceChildren(...[...groups.values()].map(({ date, posts: dayPosts }) =>
    el('li', { class: 'day' },
      el('h3', { class: 'day-date' }, dayLabel(date), el('small', {}, `${weekdayFmt.format(date)}, ${date.getFullYear()}`)),
      el('div', { class: 'day-posts' }, ...dayPosts.map((p) => {
        const when = new Date(p.timestamp);
        const isNew = !firstVisit && !seen.has(p.id);
        const caption = firstLine(p.caption);
        return el('a', { class: `post${isNew ? ' is-new' : ''}`, href: p.permalink, target: '_blank', rel: 'noopener' },
          el('div', { class: 'post-img', role: 'img', 'aria-label': caption || 'Foto dari Instagram', style: `background-image:url("${encodeURI(p.image)}")` },
            p.type === 'VIDEO' ? el('span', { class: 'post-type' }, 'Video') : null,
            p.type === 'CAROUSEL_ALBUM' ? el('span', { class: 'post-type' }, 'Album') : null),
          el('span', { class: 'post-time' }, isNew ? `Baru, ${relative(when)}` : relative(when)),
          caption ? el('p', { class: 'post-caption' }, caption) : null);
      })))));
}

function showEmpty() {
  // Keep the built-in illustrations unless the cafe added its own photos.
  if (CONFIG.photos.length) renderPrints(photosToPrints(CONFIG.photos));
  $('timeline').replaceChildren();
  $('feed-empty').hidden = false;
  $('feed-meta').textContent = '';
}

async function loadFeed() {
  try {
    const res = await fetch(CONFIG.feedUrl, { cache: 'no-store' });
    const data = await res.json();
    if (!['ok', 'stale'].includes(data.status) || !data.posts?.length) return showEmpty();

    const seen = readSeen();
    renderPrints(postsToPrints(data.posts));
    renderTimeline(data.posts, seen);
    writeSeen(data.posts.map((p) => p.id));
    $('feed-empty').hidden = true;
    const at = timeFmt.format(new Date(data.fetched_at));
    $('feed-meta').textContent = data.status === 'stale'
      ? `Instagram sedang tidak bisa dihubungi. Menampilkan data pukul ${at}.`
      : `Diperbarui pukul ${at}.`;
  } catch {
    showEmpty();
  }
}

function renderMenu() {
  $('menu-list').replaceChildren(...CONFIG.menu.map((g) =>
    el('div', { class: 'menu-group' },
      el('h3', {}, g.group),
      el('ul', {}, ...g.items.map((item) =>
        el('li', {},
          el('span', { class: 'name' }, item.name, item.note ? el('span', { class: 'note' }, item.note) : null),
          item.price ? el('span', { class: 'price' }, item.price) : null))))));
}

function renderOpenStatus() {
  if (CONFIG.openHour == null) return;
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const open = h >= CONFIG.openHour && h < CONFIG.closeHour;
  const status = $('open-status');
  status.hidden = false;
  status.classList.toggle('closed', !open);
  status.textContent = open
    ? 'Sedang buka, tutup pukul 00.00'
    : `Sedang tutup, buka lagi pukul ${String(CONFIG.openHour).padStart(2, '0')}.00`;
}

for (const id of ['feed-empty', 'ig-foot']) $(id).href = igProfile;
$('ig-handle').textContent = `@${CONFIG.instagramHandle}`;
renderMenu();
renderGallery();
renderOpenStatus();
loadFeed();
setInterval(loadFeed, CONFIG.pollMinutes * 60000);
setInterval(renderOpenStatus, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadFeed(); });
