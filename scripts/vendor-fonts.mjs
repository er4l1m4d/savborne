// Vendors the app's two font families as local woff2 files.
//
// Why: `next/font/google` downloads stylesheets and font files at BUILD time.
// A Vercel production build failed on that fetch (2026-11-03) with
// "next/font/google queries have exactly one entry" and no code change to blame.
// Self-hosting removes fonts.googleapis.com / fonts.gstatic.com from the release
// path entirely, so the build cannot fail that way again.
//
// This script is the only place that talks to Google. It fetches the latin
// subset of each family, writes it into src/app/fonts, and asserts the bytes are
// real woff2 before finishing. Run `npm run fonts:vendor` to re-pin.
//
// Not part of `next build`, not run on Vercel.
import fs from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const OUT_DIR = path.join(process.cwd(), "src", "app", "fonts");

// The `wght@200..800` form is what makes Google return the variable file; the
// per-weight form returns the same latin URL five times.
const FAMILIES = [
  {
    css: "family=Plus+Jakarta+Sans:wght@200..800&display=swap",
    files: [{ name: "plus-jakarta-sans-latin-var.woff2", weight: "200 800" }],
  },
  {
    css: "family=Silkscreen:wght@400;700&display=swap",
    files: [
      { name: "silkscreen-400-latin.woff2", weight: "400" },
      { name: "silkscreen-700-latin.woff2", weight: "700" },
    ],
  },
];

async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

// Pull the `/* latin */` block(s) out of a Google Fonts stylesheet and return
// one entry per font weight, in the order the CSS declares them. The pattern is
// anchored on the comment so `/* latin-ext */` and the other subsets are skipped.
const LATIN_FACE = /\/\*\s*latin\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;

function latinFaces(css) {
  return [...css.matchAll(LATIN_FACE)].flatMap(([, body]) => {
    const weight = body.match(/font-weight:\s*([\d ]+);/)?.[1]?.trim();
    const url = body.match(/src:\s*url\(([^)]+)\)/)?.[1];
    return weight && url ? [{ weight, url }] : [];
  });
}

await fs.mkdir(OUT_DIR, { recursive: true });

for (const family of FAMILIES) {
  const css = await getText(`https://fonts.googleapis.com/css2?${family.css}`);
  const faces = latinFaces(css);

  for (const file of family.files) {
    const face = faces.find((f) => f.weight === file.weight);
    if (!face) throw new Error(`no latin @font-face for weight ${file.weight}`);

    const res = await fetch(face.url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} downloading ${face.url}`);
    const buf = Buffer.from(await res.arrayBuffer());

    if (buf.subarray(0, 4).toString("ascii") !== "wOF2") {
      throw new Error(`${file.name} is not a woff2 file`);
    }

    await fs.writeFile(path.join(OUT_DIR, file.name), buf);
    console.log(`${file.name}  ${buf.length}B  weight ${file.weight}  <- ${face.url}`);
  }
}

console.log(`\nvendored into ${path.relative(process.cwd(), OUT_DIR)}`);
