# lunar-tls-test

Tes kecil: **apakah TLS impersonate bisa menembus `429` dari Cloudflare** pada CDN video?

## Kenapa

Backend Lunar bisa mengambil daftar stream, tetapi URL video
(`bcdn*.hakunaymatata.com`) menjawab `429` walau header sudah lengkap ala Chrome.
Dugaan: Cloudflare memeriksa **TLS fingerprint**, jadi perlu client yang meniru
Chrome (`node-tls-client`).

## Cara jalan (otomatis — disarankan)

```bash
npm install

# server lokal :3000, film tmdb 550
node auto.js

# kalau "debug=1" kena cache, pakai tmdb lain
node auto.js 3000 603

# atau langsung ke domain
node auto.js https://api-lunar.zone.id 550
```

`auto.js` mengambil sendiri URL CDN asli dari `_raw.qualities[].url`,
lalu menguji dengan beberapa impersonate (chrome_131/124/120).

## Cara manual

```bash
# ambil URL asli
curl -s 'http://127.0.0.1:3000/stream?tmdb=550&type=movie&debug=1' | head -c 800
# copy nilai "_raw"."qualities"."360"."url"
node test.js "https://bcdn.hakunaymatata.com/....mp4?sign=...&t=..."
```

⚠️ **Jangan** memakai URL `/v/<id>` — itu URL proxy server Lunar, bukan URL CDN.

## Membaca hasil

| Keluaran | Arti |
|---|---|
| `[ok] initTLS() berhasil` | mesin kompatibel (butuh x86_64) |
| `✅ status 200` + `video: true` | **berhasil** — TLS impersonate menembus 429 |
| semua `❌ 429` | perlu cara lain |
| `[GAGAL] initTLS()` | arch tidak didukung (mis. ARM) |

## Catatan

- Butuh **Node.js >= 18** dan **x86_64**.
- Berdiri sendiri; tidak menyentuh apa pun di server Lunar.
