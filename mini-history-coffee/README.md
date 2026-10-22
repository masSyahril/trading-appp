# Mini History Coffee — website

Halaman satu-muka untuk Mini History Coffee, Jl. Ahmad Yani, Panggung, Pelaihari, Tanah Laut.
Butuh hosting PHP (XAMPP, cPanel, dll). Tidak butuh database.

## Wajib dicek sebelum online

Semua ada di bagian `CONFIG` paling atas `app.js`:

- `instagramHandle` — username Instagram asli (sekarang masih tebakan: `minihistorycoffee`).
- `signature` dan `menu` — nama, harga, dan catatan rasa masih contoh. Ganti dengan menu asli.
- `openHour` — jam buka. Google Maps hanya mencantumkan tutup 00.00.
- `heroVideo` — opsional, video pendek latar bagian atas (mp4, tanpa suara, < 6 MB).

Teks "Cerita kami" dan "Dari biji ke cangkir" ada di `index.html` (ditandai komentar `GANTI`).
Isinya masih umum; tulis ulang dengan cerita dan proses asli kedai.

## Foto

Foto di `img/` adalah foto stok dari Unsplash (lisensi Unsplash: boleh dipakai gratis,
termasuk komersial, tanpa wajib mencantumkan nama). Foto itu **bukan** foto kedai ini.
Ganti dengan foto asli dengan nama file yang sama (format JPG, potret 4:5,
lebar sekitar 1000 px; `hero.jpg` lanskap, lebar sekitar 2000 px):

- `hero.jpg` — gambar besar paling atas
- `cerita.jpg` — bagian Cerita kami
- `biji.jpg` — bagian Dari biji ke cangkir
- `es-kopi-susu.jpg`, `cappuccino.jpg`, `kopi-hitam.jpg` — tiga menu andalan

## Menyambungkan Instagram (feed live)

Feed diambil server lewat `api/instagram.php`, jadi token tidak pernah terlihat di browser.

1. Ubah akun Instagram kafe menjadi akun **Business** atau **Creator** (Pengaturan → Jenis akun).
2. Buat app di <https://developers.facebook.com/> → tambahkan produk **Instagram** → "API setup with Instagram login".
3. Tambahkan akun Instagram kafe, lalu buat **access token** (long-lived, 60 hari).
4. Salin `api/config.example.php` menjadi `api/config.local.php`, isi `access_token`.
5. Pastikan folder `api/cache/` bisa ditulis oleh server (dipakai untuk cache feed dan token yang diperbarui).

Hasilnya: 6 unggahan terbaru tampil di bagian "Terbaru di Instagram" (cache 5 menit di server).
Token diperbarui otomatis sebelum 60 hari habis, selama situs dikunjungi minimal sekali per ~10 hari.

Tanpa token, bagian Instagram disembunyikan — halaman tetap jalan sebagai profil dan menu.

Catatan: API ini hanya membaca **post feed**. Instagram Stories dan siaran Live tidak bisa ditampilkan di website lewat API.

## Coba lokal

```
cd mini-history-coffee
php -S 127.0.0.1:8080
```
