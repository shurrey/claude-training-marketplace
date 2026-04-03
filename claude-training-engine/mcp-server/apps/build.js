// Builds each MCP App source file into a self-contained HTML file
import { build } from "esbuild";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, "src");
const DIST_DIR = path.join(__dirname, "dist");

// Each app has: name.js (logic) and name.html (template)
const apps = readdirSync(SRC_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((f) => f.replace(".js", ""));

for (const app of apps) {
  const jsPath = path.join(SRC_DIR, `${app}.js`);
  const htmlPath = path.join(SRC_DIR, `${app}.html`);
  const outPath = path.join(DIST_DIR, `${app}.html`);

  // Bundle JS with all dependencies
  const result = await build({
    entryPoints: [jsPath],
    bundle: true,
    format: "esm",
    write: false,
    minify: false,
    platform: "browser",
  });

  const bundledJs = result.outputFiles[0].text;
  let html = readFileSync(htmlPath, "utf-8");
  html = html.replace("<!-- BUNDLE -->", `<script type="module">\n${bundledJs}\n</script>`);
  writeFileSync(outPath, html, "utf-8");
  console.log(`Built: ${app}.html (${Math.round(html.length / 1024)}KB)`);
}
