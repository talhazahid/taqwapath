import fs from "node:fs/promises";
import path from "node:path";

const SITE_BASE = "https://sunnah.com";
const DATA_ROOT = path.join(process.cwd(), "public", "data", "sunnah");
const HADITH_DIR = path.join(DATA_ROOT, "hadiths");
const CHAPTER_DIR = path.join(DATA_ROOT, "chapters");
const COLLECTIONS_PATH = path.join(DATA_ROOT, "collections.json");
const DAILY_PATH = path.join(DATA_ROOT, "daily.json");

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return null;
};

const parseNumberArg = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const selectedCollections = getArgValue("--collection");
const sleepMs = parseNumberArg(getArgValue("--sleep-ms"), 200);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeHtml = (value) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const htmlToText = (html) => {
  if (!html) return "";
  const text = decodeHtml(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  );
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

const fetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TaqwaPathScraper/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.text();
};

const parseSubChapters = (html) => {
  const chapters = [];
  const regex = /<div class=chapter>[\s\S]*?<div class=echapno>\((\d+)\)<\/div>\s*<div class=englishchapter>([\s\S]*?)<\/div>[\s\S]*?(?:<div class="arabicchapter arabic">([\s\S]*?)<\/div>)?/g;
  for (const match of html.matchAll(regex)) {
    const number = Number.parseInt(match[1], 10);
    const titleRaw = htmlToText(match[2] || "");
    const title = titleRaw.replace(/^Chapter:\s*/i, "");
    const arabicTitle = htmlToText(match[3] || "");
    chapters.push({
      index: match.index ?? 0,
      number: Number.isFinite(number) ? number : null,
      title,
      arabicTitle
    });
  }
  return chapters;
};

const parseHadithNumber = (block) => {
  const hrefMatch = block.match(/href="\/[^:]+:(\d+)"/);
  if (hrefMatch) return Number.parseInt(hrefMatch[1], 10);
  const stickyMatch = block.match(/class="hadith_reference_sticky">([^<]+)</);
  if (stickyMatch) {
    const numberMatch = stickyMatch[1].match(/(\d+)\s*$/);
    if (numberMatch) return Number.parseInt(numberMatch[1], 10);
  }
  return null;
};

const readJson = async (filePath) => {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const enrichCollection = async (collection) => {
  const hadithPath = path.join(HADITH_DIR, `${collection.id}.json`);
  const chapterPath = path.join(CHAPTER_DIR, `${collection.id}.json`);
  const hadithPayload = await readJson(hadithPath);
  const chapterPayload = await readJson(chapterPath);
  const hadiths = Array.isArray(hadithPayload?.hadiths)
    ? hadithPayload.hadiths
    : Array.isArray(hadithPayload)
      ? hadithPayload
      : [];
  const books = Array.isArray(chapterPayload?.chapters) ? chapterPayload.chapters : [];
  const subChapterMap = new Map();
  const sourceSlug = collection.sourceSlug || collection.id;

  for (const book of books) {
    if (!book?.id) continue;
    const bookUrl = `${SITE_BASE}/${sourceSlug}/${book.id}`;
    console.log(`Fetching subchapters: ${collection.id} book ${book.id}`);
    const html = await fetchHtml(bookUrl);
    const subChapters = parseSubChapters(html);
    const hadithBlocks = [...html.matchAll(/<div class="actualHadithContainer[\s\S]*?<!-- end actual hadith container -->/g)];
    let subChapterIndex = 0;
    let activeSubChapter = null;

    for (const block of hadithBlocks) {
      const blockIndex = Number.isFinite(block.index) ? block.index : html.indexOf(block[0]);
      while (subChapterIndex < subChapters.length && subChapters[subChapterIndex].index < blockIndex) {
        activeSubChapter = subChapters[subChapterIndex];
        subChapterIndex += 1;
      }
      if (!activeSubChapter) continue;
      const number = parseHadithNumber(block[0]);
      if (!Number.isFinite(number)) continue;
      subChapterMap.set(number, {
        subChapter: activeSubChapter.number,
        subChapterTitle: activeSubChapter.title,
        subChapterTitleArabic: activeSubChapter.arabicTitle
      });
    }

    if (sleepMs) await sleep(sleepMs);
  }

  let updated = 0;
  for (const hadith of hadiths) {
    const subChapter = subChapterMap.get(hadith?.number);
    if (!subChapter) continue;
    hadith.subChapter = subChapter.subChapter;
    hadith.subChapterTitle = subChapter.subChapterTitle;
    hadith.subChapterTitleArabic = subChapter.subChapterTitleArabic;
    updated += 1;
  }

  await writeJson(hadithPath, {
    ...hadithPayload,
    hadiths
  });

  return {
    updated,
    hadiths
  };
};

const updateDaily = async (daily, hadiths, collectionId) => {
  if (!daily?.items?.length) return daily;
  const dailyId = daily.collection?.id || daily.collection?.slug;
  if (!dailyId || dailyId !== collectionId) return daily;
  const hadithMap = new Map(hadiths.map((entry) => [Number(entry.number), entry]));
  const items = daily.items.map((item) => {
    const match = hadithMap.get(Number(item.number));
    if (!match) return item;
    return {
      ...item,
      subChapter: match.subChapter,
      subChapterTitle: match.subChapterTitle,
      subChapterTitleArabic: match.subChapterTitleArabic
    };
  });
  return {
    ...daily,
    items
  };
};

const main = async () => {
  const collectionsPayload = await readJson(COLLECTIONS_PATH);
  const collections = Array.isArray(collectionsPayload)
    ? collectionsPayload
    : collectionsPayload?.collections || [];
  const selected = selectedCollections
    ? collections.filter((collection) => selectedCollections.split(",").includes(collection.id))
    : collections;

  if (!selected.length) {
    console.error("No collections found to enrich.");
    return;
  }

  let daily = null;
  try {
    daily = await readJson(DAILY_PATH);
  } catch {
    daily = null;
  }

  for (const collection of selected) {
    const { updated, hadiths } = await enrichCollection(collection);
    console.log(`Updated ${updated} hadith entries for ${collection.id}.`);
    if (daily) {
      daily = await updateDaily(daily, hadiths, collection.id);
    }
  }

  if (daily) {
    await writeJson(DAILY_PATH, daily);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
