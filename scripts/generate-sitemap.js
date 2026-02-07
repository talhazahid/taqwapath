import fs from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://taqwapath.com";
const OUTPUT_PATH = path.resolve(process.cwd(), "public", "sitemap.xml");
const DATA_ROOT = path.resolve(process.cwd(), "public", "data", "sunnah");
const HADITHS_PER_PAGE = 200;

const readJson = async (relativePath) => {
  try {
    const raw = await fs.readFile(path.join(DATA_ROOT, relativePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toUrl = (pathPart) => {
  if (!pathPart || pathPart === "/") return `${SITE_URL}/`;
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return `${SITE_URL}${normalized.endsWith("/") ? normalized : `${normalized}/`}`;
};

const formatDate = (date = new Date()) => date.toISOString().split("T")[0];

const addUrl = (urls, seen, loc) => {
  if (!loc || seen.has(loc)) return;
  seen.add(loc);
  urls.push(loc);
};

const mainPaths = [
  "/",
  "/salah-namaz-timings",
  "/listen-quran",
  "/zakat-calculator",
  "/islamic-calendar-2026",
  "/ramzan-2026",
  "/hadees"
];

const generate = async () => {
  const urls = [];
  const seen = new Set();
  const today = formatDate();

  mainPaths.forEach((pathPart) => addUrl(urls, seen, toUrl(pathPart)));

  const collectionsPayload = await readJson("collections.json");
  const collections = Array.isArray(collectionsPayload)
    ? collectionsPayload
    : collectionsPayload?.collections || [];

  for (const book of collections) {
    const slug = book.slug || book.id;
    if (!slug) continue;

    addUrl(urls, seen, toUrl(`/hadees/${slug}`));
    addUrl(urls, seen, toUrl(`/hadees/${slug}/chapters`));

    const chaptersPayload = await readJson(path.join("chapters", `${slug}.json`));
    const chapters = chaptersPayload?.chapters || [];
    chapters.forEach((chapter) => {
      if (!chapter?.id) return;
      addUrl(urls, seen, toUrl(`/hadees/${slug}/chapter/${chapter.id}`));
    });

    const hadithPayload = await readJson(path.join("hadiths", `${slug}.json`));
    const hadiths = Array.isArray(hadithPayload?.hadiths)
      ? hadithPayload.hadiths
      : Array.isArray(hadithPayload)
        ? hadithPayload
        : [];

    const totalPages = Math.ceil(hadiths.length / HADITHS_PER_PAGE);
    for (let page = 2; page <= totalPages; page += 1) {
      addUrl(urls, seen, toUrl(`/hadees/${slug}/${page}`));
    }

    hadiths.forEach((entry) => {
      if (!entry || entry.number === undefined || entry.number === null) return;
      addUrl(urls, seen, toUrl(`/hadees/${slug}-${entry.number}`));
    });
  }

  const body = urls
    .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`;

  await fs.writeFile(OUTPUT_PATH, xml, "utf8");
  console.log(`Sitemap written with ${urls.length} URLs.`);
};

generate().catch((error) => {
  console.error("Sitemap generation failed.", error);
  process.exitCode = 1;
});
