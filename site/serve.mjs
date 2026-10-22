// Local preview of site/_site. Run `npm --prefix site start`, which builds first.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '_site');
const port = Number(process.env.PORT) || 4180;
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png',
};

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(out, path.endsWith('/') ? join(path, 'index.html') : path);
  try {
    const body = await readFile(file);
    response.writeHead(200, {'content-type': types[extname(file)] || 'application/octet-stream'});
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Maestro site: http://localhost:${port}/`));
