/**
 * lunar-tls-test — versi OTOMATIS
 * ================================
 * Ambil URL CDN asli dari server Lunar (butuh debug=1), lalu tes TLS impersonate.
 *
 * Pakai:
 *   node auto.js                          # pakai server lokal :3000, film 550
 *   node auto.js 3000 603                 # port 3000, tmdb 603
 *   node auto.js https://api-lunar.zone.id 550
 */
'use strict';

const https = require('https');
const http = require('http');
const { Session, initTLS } = require('node-tls-client');

const arg1 = process.argv[2] || '3000';
const tmdb = process.argv[3] || '550';
const BASE = /^https?:/.test(arg1) ? arg1.replace(/\/$/, '') : `http://127.0.0.1:${arg1}`;

function getJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
        path: u.pathname + u.search, method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'lunar-tls-test' },
        family: 4, timeout: 90000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('bukan JSON: ' + d.slice(0, 200))); }
        });
      },
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout ambil stream')); });
    req.on('error', reject);
    req.end();
  });
}

async function impersonate(url, imp) {
  let s;
  try {
    s = new Session({ impersonate: imp, timeout: 20000 });
    const r = await Promise.race([
      s.get(url, { headers: { Referer: 'https://vidlink.pro/', Origin: 'https://vidlink.pro', Accept: '*/*' } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('hard-timeout')), 25000)),
    ]);
    const body = r.body || '';
    return { status: r.status, bytes: body.length, video: body.length > 100 && !body.slice(0, 30).toLowerCase().includes('<html'), head: body.slice(0, 12) };
  } catch (e) {
    return { status: 0, bytes: 0, note: String(e.message).slice(0, 60) };
  } finally {
    try { if (s && s.close) await Promise.race([s.close(), new Promise((r) => setTimeout(r, 3000))]); } catch (_) {}
  }
}

(async () => {
  console.log('=== lunar-tls-test (otomatis) ===');
  console.log('server :', BASE);
  console.log('tmdb   :', tmdb);
  console.log();

  const url = `${BASE}/stream?tmdb=${tmdb}&type=movie&debug=1`;
  console.log('ambil stream dari:', url);

  let j;
  try {
    j = await getJson(url);
  } catch (e) {
    console.error('❌ Gagal ambil stream:', e.message);
    console.error('   Kalau "debug=1" tidak ada _raw (kena cache), restart server atau pakai tmdb lain:');
    console.error('   node auto.js 3000 603');
    process.exit(1);
  }

  const q = (j._raw && j._raw.qualities) || {};
  const keys = Object.keys(q);
  console.log('kualitas tersedia:', keys.join(', ') || '(kosong)');
  if (keys.length === 0) {
    console.error('❌ Tidak ada URL asli di _raw. Kemungkinan:');
    console.error('   - respons ini dari CACHE (tanpa debug) → pakai tmdb lain atau restart server');
    console.error('   - struktur respons berubah');
    console.log('   isi respons:', JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  console.log();

  try {
    await initTLS();
    console.log('[ok] initTLS() berhasil');
  } catch (e) {
    console.error('[GAGAL] initTLS():', e.message, '| arch:', process.arch);
    process.exit(1);
  }
  console.log();

  for (const k of keys) {
    const cdnUrl = q[k].url;
    console.log(`--- ${k}p : ${cdnUrl.slice(0, 88)}...`);
    for (const imp of ['chrome_131', 'chrome_124', 'chrome_120']) {
      const r = await impersonate(cdnUrl, imp);
      const mark = r.status === 200 ? '✅' : '❌';
      console.log(`  ${mark} ${imp.padEnd(12)}`, JSON.stringify(r));
    }
    console.log();
  }

  console.log('=== KESIMPULAN ===');
  console.log('Ada ✅ status 200 + video true → TLS impersonate BERHASIL, gua lanjut upgrade lunar-cdn.js');
  console.log('Semua ❌ 429                    → gua pakai rencana cadangan');
  process.exit(0);
})();
