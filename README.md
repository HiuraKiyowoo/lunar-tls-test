# lunar-tls-test

Tes kecil: **apakah TLS impersonate bisa menembus `429` dari Cloudflare** pada CDN video?

## Kenapa

Backend Lunar bisa mengambil daftar stream, tapi URL video (`bcdn*.hakunaymatata.com`)
menjawab `429` walau header sudah lengkap ala Chrome. Dugaan: Cloudflare memeriksa
**TLS fingerprint**, jadi perlu client yang meniru Chrome (`node-tls-client`).

## Cara jalan

```bash
npm install
node test.js "<URL MP4>"
```

### Dapatkan URL contoh

```bash
curl -s 'http://127.0.0.1:3000/stream?tmdb=550&type=movie&debug=1' \
  | grep -o '"url":"[^"]*"' | head -1
```

(atau lihat bagian `_raw.qualities["360"].url` pada respons JSON)

## Membaca hasil

| Keluaran | Arti |
|---|---|
| `[ok] initTLS() berhasil` | mesin kompatibel (butuh x86_64) |
| `✅ status 200` + `looksLikeVideo: true` | **berhasil** — TLS impersonate menembus 429 |
| semua `❌ 429` | perlu cara lain |
| `[GAGAL] initTLS()` | arch tidak didukung (mis. ARM) |

## Catatan

- Butuh **Node.js >= 18** dan **x86_64** (binary Go di dalamnya tidak jalan di ARM).
- Tidak menyentuh apa pun di server Lunar — berdiri sendiri.
