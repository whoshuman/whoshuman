import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");

await mkdir(distDir, { recursive: true });
await writeFile(
  resolve(distDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Who's Human</title>
  </head>
  <body>
    <main>
      <h1>Who's Human</h1>
      <p>Frontend placeholder. Backend services are being scaffolded.</p>
    </main>
  </body>
</html>
`
);
