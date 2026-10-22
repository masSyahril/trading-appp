# Mini History Coffee — website

Halaman satu-muka untuk Mini History Coffee, Jl. Ahmad Yani, Panggung, Pelaihari, Tanah Laut.
Butuh hosting PHP (XAMPP, cPanel, dll). Tidak butuh database.

## Wajib dicek sebelum online

Semua ada di bagian `CONFIG` paling atas `app.js`:

- `instagramHandle` — username Instagram asli (sekarang masih tebakan: `minihistorycoffee`).
- `openHour` — jam buka. Google Maps hanya mencantumkan tutup 00.00; selama `null`, status "sedang buka" tidak ditampilkan.
- `menu` — daftar menu masih contoh tanpa harga. Ganti dengan menu asli.

## Menyambungkan Instagram (feed live)

Feed diambil server lewat `api/instagram.php`, jadi token tidak pernah terlihat di browser.

1. Ubah akun Instagram kafe menjadi akun **Business** atau **Creator** (Pengaturan → Jenis akun).
2. Buat app di <https://developers.facebook.com/> → tambahkan produk **Instagram** → "API setup with Instagram login".
3. Tambahkan akun Instagram kafe, lalu buat **access token** (long-lived, 60 hari).
4. Salin `api/config.example.php` menjadi `api/config.local.php`, isi `access_token`.
5. Pastikan folder `api/cache/` bisa ditulis oleh server (dipakai untuk cache feed dan token yang diperbarui).

Hasilnya: 12 unggahan terbaru, cache 5 menit di server, browser memeriksa ulang tiap 3 menit.
Token diperbarui otomatis sebelum 60 hari habis, selama situs dikunjungi minimal sekali per ~10 hari.

Tanpa token, bagian "Arsip harian" menampilkan tombol ke profil Instagram — halaman tetap jalan.

Catatan: API ini hanya membaca **post feed**. Instagram Stories dan siaran Live tidak bisa ditampilkan di website lewat API.

## Coba lokal

```
cd mini-history-coffee
php -S 127.0.0.1:8080
```
