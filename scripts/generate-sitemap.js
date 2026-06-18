import fs from "node:fs/promises";
import path from "node:path";
import { buildPrayerPath, prayerLocations } from "../src/data/prayerLocations.js";

const SITE_URL = "https://taqwapath.com";
const OUTPUT_PATH = path.resolve(process.cwd(), "public", "sitemap.xml");
const DATA_ROOT = path.resolve(process.cwd(), "public", "data", "sunnah");
const HADITHS_PER_PAGE = 200;
const CHAPTER_HADITHS_PER_PAGE = 200;

const readJson = async (relativePath) => {
  try {
    const raw = await fs.readFile(path.join(DATA_ROOT, relativePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toUrl = (pathPart) => {
  // Production URLs are canonical without a trailing slash.
  if (!pathPart || pathPart === "/") return SITE_URL;
  const normalized = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  // Remove any trailing slashes (except for the root path handled above).
  const trimmed = normalized.replace(/\/+$/, "");
  return `${SITE_URL}${trimmed}`;
};

const formatDate = (date = new Date()) => date.toISOString().split("T")[0];

const getFileDate = async (relativePath, fallback = new Date()) => {
  try {
    const stat = await fs.stat(path.resolve(process.cwd(), relativePath));
    return formatDate(stat.mtime);
  } catch {
    return formatDate(fallback);
  }
};

const addUrl = (urls, seen, loc, lastmod) => {
  if (!loc || seen.has(loc)) return;
  seen.add(loc);
  urls.push({ loc, lastmod });
};

const mainPaths = [
  "/",
  "/about",
  "/privacy-policy",
  "/salah-namaz-timings",
  "/world",
  "/quran-online",
  "/zakat-calculator",
  "/calendar",
  "/ramadhan",
  "/islamic-calendar-2026",
  "/islamic-calendar-2027",
  "/islamic-calendar-2028",
  "/islamic-calendar-2029",
  "/islamic-calendar-2030",
  "/islamic-calendar-2031",
  "/ramadan-2027",
  "/ramadan-2028",
  "/ramadan-2029",
  "/ramadan-2030",
  "/ramadan-2031",
  "/hadith"
];

const generate = async () => {
  const urls = [];
  const seen = new Set();
  const today = formatDate();
  const sourceDates = {
    pages: await getFileDate("src/pages/index.astro"),
    about: await getFileDate("src/pages/about.astro"),
    privacy: await getFileDate("src/pages/privacy-policy.astro"),
    quran: await getFileDate("src/pages/quran-online.astro"),
    zakat: await getFileDate("src/pages/zakat-calculator.astro"),
    calendar: await getFileDate("src/components/IslamicCalendarPage.astro"),
    ramadan: await getFileDate("src/components/RamadanCalendarPage.astro"),
    prayer: await getFileDate("src/data/prayerLocations.js"),
    hadith: await getFileDate("public/data/sunnah/collections.json")
  };
  const getLastmod = (pathPart) => {
    if (pathPart === "/" || pathPart === "") return sourceDates.pages;
    if (pathPart.startsWith("/about")) return sourceDates.about;
    if (pathPart.startsWith("/privacy-policy")) return sourceDates.privacy;
    if (pathPart.startsWith("/quran-online")) return sourceDates.quran;
    if (pathPart.startsWith("/zakat-calculator")) return sourceDates.zakat;
    if (pathPart.startsWith("/calendar") || pathPart.startsWith("/islamic-calendar")) return sourceDates.calendar;
    if (pathPart.startsWith("/ramadhan") || pathPart.startsWith("/ramadan")) return sourceDates.ramadan;
    if (pathPart.startsWith("/world") || pathPart.startsWith("/salah-namaz-timings")) return sourceDates.prayer;
    if (pathPart.startsWith("/hadith")) return sourceDates.hadith;
    return today;
  };

  mainPaths.forEach((pathPart) => addUrl(urls, seen, toUrl(pathPart), getLastmod(pathPart)));

  prayerLocations.forEach((country) => {
    addUrl(urls, seen, toUrl(`/world/${country.countrySlug}`), sourceDates.prayer);
    country.cities.forEach((city) => {
      addUrl(urls, seen, toUrl(buildPrayerPath(country.countrySlug, city.slug)), sourceDates.prayer);
    });
  });

  const collectionsPayload = await readJson("collections.json");
  const collections = Array.isArray(collectionsPayload)
    ? collectionsPayload
    : collectionsPayload?.collections || [];

  for (const book of collections) {
    const slug = book.slug || book.id;
    if (!slug) continue;

    const bookLastmod = await getFileDate(path.join("public", "data", "sunnah", "hadiths", `${slug}.json`), sourceDates.hadith);
    addUrl(urls, seen, toUrl(`/hadith/${slug}`), bookLastmod);
    addUrl(urls, seen, toUrl(`/hadith/${slug}/chapters`), bookLastmod);

    const hadithPayload = await readJson(path.join("hadiths", `${slug}.json`));
    const hadiths = Array.isArray(hadithPayload?.hadiths)
      ? hadithPayload.hadiths
      : Array.isArray(hadithPayload)
        ? hadithPayload
        : [];
    const chapterCounts = hadiths.reduce((counts, hadith) => {
      const chapterId = hadith?.chapter;
      if (chapterId === undefined || chapterId === null || chapterId === "") return counts;
      const chapterKey = String(chapterId);
      counts.set(chapterKey, (counts.get(chapterKey) || 0) + 1);
      return counts;
    }, new Map());

    const chaptersPayload = await readJson(path.join("chapters", `${slug}.json`));
    const chapters = chaptersPayload?.chapters || [];
    chapters.forEach((chapter) => {
      if (!chapter?.id) return;
      addUrl(urls, seen, toUrl(`/hadith/${slug}/chapter/${chapter.id}`), bookLastmod);
      const totalChapterPages = Math.ceil((chapterCounts.get(String(chapter.id)) || 0) / CHAPTER_HADITHS_PER_PAGE);
      for (let page = 2; page <= totalChapterPages; page += 1) {
        addUrl(urls, seen, toUrl(`/hadith/${slug}/chapter/${chapter.id}/${page}`), bookLastmod);
      }
    });

    const totalPages = Math.ceil(hadiths.length / HADITHS_PER_PAGE);
    for (let page = 2; page <= totalPages; page += 1) {
      addUrl(urls, seen, toUrl(`/hadith/${slug}/${page}`), bookLastmod);
    }
  }

  const body = urls
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod || today}</lastmod>\n  </url>`)
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
