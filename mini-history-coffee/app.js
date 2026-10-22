// Mini History Coffee - page behaviour.
// Edit CONFIG to match the cafe; everything else reads from it.
const CONFIG = {
  // Instagram username without "@". TODO: confirm the real handle.
  instagramHandle: 'minihistorycoffee',

  // Server proxy that holds the Instagram token (see api/instagram.php).
  // While it isn't set up, the Instagram section simply stays hidden.
  feedUrl: 'api/instagram.php',

  // Optional short background video for the top of the page, e.g.
  // 'video/hero.mp4' (muted, 10-20 s, 1080p, under ~6 MB). img/hero.jpg
  // stays as the poster and is what visitors on slow connections see.
  heroVideo: '',

  // Closing time is from Google Maps (00.00). Opening time isn't listed
  // there yet - set e.g. openHour: 15 to add "Buka pukul 15.00" to Jam.
  openHour: null,

  // TODO: replace with the real menu, prices and tasting notes.
  // Leave price empty to show an item without one.
  signature: [
    { name: 'Kopi susu aren', price: '', notes: 'Espresso, susu segar, gula aren. Manis karamel, akhir yang lembut.', image: 'img/es-kopi-susu.jpg', alt: 'Es kopi susu dalam gelas di atas meja kayu' },
    { name: 'Cappuccino', price: '', notes: 'Busa susu halus di atas double shot. Cokelat, kacang panggang.', image: 'img/cappuccino.jpg', alt: 'Cappuccino dengan latte art di atas piring tatakan' },
    { name: 'Kopi hitam tubruk', price: '', notes: 'Diseduh pekat, tanpa gula. Pahit bersih, aroma rempah.', image: 'img/kopi-hitam.jpg', alt: 'Secangkir kopi hitam dilihat dari atas' },
  ],
  menu: [
    { group: 'Kopi', items: [
      { name: 'Espresso', notes: 'Satu shot, pekat dan singkat' },
      { name: 'Americano', notes: 'Panas atau dingin' },
      { name: 'Café latte', notes: 'Lembut, susu lebih banyak' },
      { name: 'Manual brew', notes: 'V60, biji pilihan minggu ini' },
    ]},
    { group: 'Bukan kopi', items: [
      { name: 'Cokelat', notes: 'Panas atau dingin' },
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

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k === 'class' ? 'class' : k, v);
  for (const child of children) if (child != null) node.append(child);
  return node;
}

function renderMenu() {
  $('signature').replaceChildren(...CONFIG.signature.map((item) =>
    el('article', { class: 'sig' },
      el('div', { class: 'sig-img' }, el('img', { src: item.image, alt: item.alt || item.name, loading: 'lazy', width: 900, height: 1125 })),
      el('div', { class: 'sig-body' },
        el('div', { class: 'sig-row' }, el('h3', {}, item.name), item.price ? el('span', { class: 'price' }, item.price) : null),
        item.notes ? el('p', { class: 'notes' }, item.notes) : null))));

  $('menu-list').replaceChildren(...CONFIG.menu.map((g) =>
    el('div', { class: 'menu-group' },
      el('h3', {}, g.group),
      el('ul', {}, ...g.items.map((item) =>
        el('li', {},
          el('div', { class: 'sig-row' }, el('span', { class: 'name' }, item.name), item.price ? el('span', { class: 'price' }, item.price) : null),
          item.notes ? el('p', { class: 'notes' }, item.notes) : null))))));
}

function renderHeroVideo() {
  if (!CONFIG.heroVideo || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (navigator.connection?.saveData) return;
  const video = el('video', { autoplay: '', muted: '', loop: '', playsinline: '', poster: 'img/hero.jpg', 'aria-hidden': 'true' });
  video.muted = true;
  video.append(el('source', { src: CONFIG.heroVideo, type: 'video/mp4' }));
  $('hero-media').replaceWith(video);
}

async function loadInstagram() {
  try {
    const res = await fetch(CONFIG.feedUrl, { cache: 'no-store' });
    const data = await res.json();
    if (!['ok', 'stale'].includes(data.status) || !data.posts?.length) return;
    $('ig-grid').replaceChildren(...data.posts.slice(0, 6).map((p) =>
      el('a', { href: p.permalink, target: '_blank', rel: 'noopener' },
        el('img', { src: p.image, alt: (p.caption || 'Foto dari Instagram').split('\n')[0].slice(0, 120), loading: 'lazy' }))));
    $('instagram').hidden = false;
  } catch {
    // No proxy (static hosting) or no token yet: the section stays hidden.
  }
}

const igProfile = `https://www.instagram.com/${CONFIG.instagramHandle}/`;
for (const id of ['ig-link', 'ig-foot']) $(id).href = igProfile;
if (CONFIG.openHour != null) {
  $('hours').textContent = `Buka pukul ${String(CONFIG.openHour).padStart(2, '0')}.00, tutup pukul 00.00`;
}

const header = document.querySelector('.top');
const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

renderHeroVideo();
renderMenu();
loadInstagram();
