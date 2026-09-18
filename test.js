/**
 * lunar-tls-test
 * ==============
 * Tujuan: cek apakah CDN video (bcdn*.hakunaymatata.com) bisa diakses
 * pakai TLS impersonate (meniru Chrome), untuk mengatasi 429 dari Cloudflare.
 *
 * Cara pakai:
 *   npm install
 *   node test.js
 *
 * Uji yang dijalankan:
 *   1. https biasa (Node)         → sebagai pembanding
 *   2. node-tls-client (Chrome)   → harapannya 200
 *   3. Beberapa UA/referer
 */
'use strict';

const https = require('https');
const { Session, initTLS } = require('node-tls-client');

// URL contoh: MP4 publik dari sumber yang sama dengan vidlink.
// Ganti kalau perlu — yang penting domainnya bcdn*.hakunaymatata.com
const TEST_URLS = process.argv.slice(2);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/* ---------------------------------------------------------------- */
/* 1. HTTPS biasa (Node) — pembanding                               */
/* ---------------------------------------------------------------- */
function plainHttps(url) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: '*/*', Referer: 'https://vidlink.pro/', Origin: 'https://vidlink.pro' },
        family: 4,
        timeout: 20000,
      },
      (res) => {
        let n = 0;
        res.on('data', (c) => { n += c.length; if (n > 2000) res.destroy(); });
        res.on('end', () => resolve({ status: res.statusCode, bytes: n }));
        res.on('close', () => resolve({ status: res.statusCode, bytes: n }));
      },
    );
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, bytes: 0, note: 'timeout' }); });
    req.on('error', (e) => resolve({ status: 0, bytes: 0, note: e.message }));
    req.end();
  });
}

/* ---------------------------------------------------------------- */
/* 2. TLS impersonate                                               */
/* ---------------------------------------------------------------- */
async function impersonate(url, imp) {
  let s;
  try {
    s = new Session({ impersonate: imp, timeout: 20000 });
    const r = await Promise.race([
      s.get(url, {
        headers: { Referer: 'https://vidlink.pro/', Origin: 'https://vidlink.pro', Accept: '*/*' },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('hard-timeout')), 25000)),
    ]);
    const body = r.body || '';
    return {
      status: r.status,
      bytes: body.length,
      looksLikeVideo: body.length > 100 && !body.slice(0, 30).toLowerCase().includes('<html'),
    };
  } catch (e) {
    return { status: 0, bytes: 0, note: String(e.message).slice(0, 60) };
  } finally {
    try { if (s && s.close) await Promise.race([s.close(), new Promise((r) => setTimeout(r, 3000))]); } catch (_) {}
  }
}

/* ---------------------------------------------------------------- */
/* MAIN                                                             */
/* ---------------------------------------------------------------- */
(async () => {
  console.log('=== lunar-tls-test ===');
  console.log('node :', process.version);
  console.log('arch :', process.arch, '| platform:', process.platform);
  console.log();

  if (TEST_URLS.length === 0) {
    console.log('Tidak ada URL yang diberikan.');
    console.log('Pakai:  node test.js "<URL MP4 contoh>"');
    console.log();
    console.log('Cara dapat URL contoh:');
    console.log('  curl -s "http://127.0.0.1:3000/stream?tmdb=550&type=movie&debug=1"');
    console.log('  lihat bagian _raw.qualities["360"].url');
    process.exit(0);
  }

  try {
    await initTLS();
    console.log('[ok] initTLS() berhasil — library jalan di mesin ini');
  } catch (e) {
    console.error('[GAGAL] initTLS() error:', e.message);
    console.error('Mesin ini kemungkinan tidak kompatibel (arch:', process.arch, ')');
    process.exit(1);
  }
  console.log();

  for (const url of TEST_URLS) {
    console.log('--- URL:', url.slice(0, 90) + (url.length > 90 ? '...' : ''));

    const a = await plainHttps(url);
    console.log('  [1] https biasa        :', JSON.stringify(a));

    for (const imp of ['chrome_131', 'chrome_124', 'chrome_120', 'firefox_133']) {
      const b = await impersonate(url, imp);
      const mark = b.status === 200 ? '  ✅' : '  ❌';
      console.log(`${mark} [2] ${imp.padEnd(13)}:`, JSON.stringify(b));
    }
    console.log();
  }

  console.log('=== KESIMPULAN ===');
  console.log('Kalau ada baris ✅ status 200 + looksLikeVideo true  →  TLS impersonate BERHASIL');
  console.log('Kalau semua ❌ 429                                  →  perlu cara lain (cookie/headless)');
  process.exit(0);
})();
