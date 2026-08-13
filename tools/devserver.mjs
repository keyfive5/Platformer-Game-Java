/**
 * devserver.mjs — local preview server for docs/, plus a POST /__shot endpoint
 * that writes a canvas data-URL to disk so screenshots can be reviewed while
 * developing. Development only; GitHub Pages just serves docs/ statically.
 *
 * Usage: node tools/devserver.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const port = +(process.argv[2] || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.tmx': 'application/xml',
  '.tsx': 'application/xml',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/__shot') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString();
    const { name = 'shot', data } = JSON.parse(body);
    const b64 = data.replace(/^data:image\/png;base64,/, '');
    const out = join(root, '.shots', `${name.replace(/[^\w.-]/g, '_')}.png`);
    await writeFile(out, Buffer.from(b64, 'base64')).catch(async (e) => {
      if (e.code !== 'ENOENT') throw e;
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(root, '.shots'), { recursive: true });
      await writeFile(out, Buffer.from(b64, 'base64'));
    });
    res.writeHead(200, { 'access-control-allow-origin': '*' });
    res.end(out);
    return;
  }

  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = normalize(join(docs, p));
  if (!file.startsWith(docs)) { res.writeHead(403).end(); return; }

  try {
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found: ' + p);
  }
}).listen(port, () => console.log(`prison-revelations dev server on http://localhost:${port}`));
