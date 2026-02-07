import fs from "node:fs/promises";
import path from "node:path";

const SITE_BASE = "https://sunnah.com";
const OUTPUT_ROOT = path.join(process.cwd(), "public", "data", "sunnah");
const HADITH_DIR = path.join(OUTPUT_ROOT, "hadiths");
const CHAPTER_DIR = path.join(OUTPUT_ROOT, "chapters");

const COLLECTIONS = [
  {
    id: "bukhari",
    sourceSlug: "bukhari",
    title: "Sahih al-Bukhari",
    compiler: "Imam al-Bukhari",
    summary: "One of the most authentic collections of prophetic traditions.",
    tags: ["popular"]
  },
  {
    id: "muslim",
    sourceSlug: "muslim",
    title: "Sahih Muslim",
    compiler: "Imam Muslim",
    summary: "A comprehensive collection focused on authenticity and rigor.",
    tags: ["popular"]
  },
  {
    id: "abu-daud",
    sourceSlug: "abudawud",
    title: "Sunan Abu Dawud",
    compiler: "Imam Abu Dawud",
    summary: "A juristic collection covering worship and daily conduct.",
    tags: ["fiqh"]
  },
  {
    id: "tirmidzi",
    sourceSlug: "tirmidhi",
    title: "Jami at-Tirmidhi",
    compiler: "Imam al-Tirmidhi",
    summary: "Hadith covering belief, worship, and character.",
    tags: ["ethics"]
  },
  {
    id: "ibnu-majah",
    sourceSlug: "ibnmajah",
    title: "Sunan Ibn Majah",
    compiler: "Imam Ibn Majah",
    summary: "Well known collection covering worship and conduct.",
    tags: ["fiqh"]
  },
  {
    id: "malik",
    sourceSlug: "malik",
    title: "Muwatta Malik",
    compiler: "Imam Malik",
    summary: "Early collection blending hadith with legal rulings.",
    tags: ["fiqh"]
  },
  {
    id: "ahmad",
    sourceSlug: "ahmad",
    title: "Musnad Ahmad",
    compiler: "Imam Ahmad ibn Hanbal",
    summary: "An expansive collection organized by companion.",
    tags: ["ethics"]
  },
  {
    id: "darimi",
    sourceSlug: "darimi",
    title: "Sunan al-Darimi",
    compiler: "Imam al-Darimi",
    summary: "A foundational collection with a focus on law and guidance.",
    tags: ["fiqh"]
  },
  {
    id: "nasai",
    sourceSlug: "nasai",
    title: "Sunan an-Nasa'i",
    compiler: "Imam an-Nasa'i",
    summary: "Detailed narrations with a focus on legal chapters.",
    tags: ["fiqh"]
  }
];

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.split("=").slice(1).join("=");
  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return null;
};

const selectedCollections = getArgValue("--collection");
const parseNumberArg = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const maxBooks = parseNumberArg(getArgValue("--max-books"), Number.POSITIVE_INFINITY);
const maxHadiths = parseNumberArg(getArgValue("--max-hadiths"), Number.POSITIVE_INFINITY);
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

const extractDivByClass = (html, className) => {
  const marker = `class="${className}`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return "";
  const openTagStart = html.lastIndexOf("<div", markerIndex);
  if (openTagStart === -1) return "";
  const contentStart = html.indexOf(">", markerIndex);
  if (contentStart === -1) return "";
  let depth = 1;
  let cursor = contentStart + 1;
  while (depth > 0) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
    } else {
      depth -= 1;
      cursor = nextClose + 6;
    }
  }
  return html.slice(contentStart + 1, Math.max(contentStart + 1, cursor - 6));
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

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TaqwaPathScraper/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return response.json();
};

const parseCollectionInfo = (html) => {
  const arabicMatch = html.match(/<div class="collection_info">[\s\S]*?<div class="arabic">([\s\S]*?)<\/div>/);
  const englishMatch = html.match(/<div class="collection_info">[\s\S]*?<div class="english">([\s\S]*?)<\/div>/);
  return {
    arabicTitle: htmlToText(arabicMatch?.[1] || ""),
    englishTitle: htmlToText(englishMatch?.[1] || "")
  };
};

const parseBookList = (html) => {
  const books = [];
  const matches = html.matchAll(/<div class="book_title title"[\s\S]*?<\/div><!-- end book_title div -->/g);
  for (const match of matches) {
    const block = match[0];
    const hrefMatch = block.match(/href="\/[^/]+\/(\d+)"/);
    if (!hrefMatch) continue;
    const englishMatch = block.match(/class="english english_book_name">([\s\S]*?)<\/div>/);
    const arabicMatch = block.match(/class="arabic arabic_book_name">([\s\S]*?)<\/div>/);
    const rangeMatch = block.match(/class=book_range>\s*<div>(\d+)<\/div>\s*<div>\s*to\s*<\/div>\s*<div>(\d+)<\/div>/i);
    books.push({
      id: Number.parseInt(hrefMatch[1], 10),
      title: htmlToText(englishMatch?.[1] || ""),
      arabicTitle: htmlToText(arabicMatch?.[1] || ""),
      rangeStart: rangeMatch ? Number.parseInt(rangeMatch[1], 10) : null,
      rangeEnd: rangeMatch ? Number.parseInt(rangeMatch[2], 10) : null
    });
  }
  return books;
};

const parseReferenceTable = (block) => {
  const tableMatch = block.match(/<table class=hadith_reference[\s\S]*?<\/table>/);
  if (!tableMatch) return null;
  const rows = tableMatch[0].matchAll(/<tr>([\s\S]*?)<\/tr>/g);
  const reference = {};
  const extra = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => htmlToText(cell[1]))
      .filter(Boolean);
    if (cells.length < 2) continue;
    const label = cells[0];
    const value = cells[1];
    const lower = label.toLowerCase();
    if (lower.startsWith("reference")) {
      reference.primary = value;
      const linkMatch = row[1].match(/href="([^"]+)"/);
      if (linkMatch) {
        reference.link = linkMatch[1].startsWith("http")
          ? linkMatch[1]
          : `${SITE_BASE}${linkMatch[1]}`;
      }
    } else if (lower.includes("in-book")) {
      reference.inBook = value;
    } else if (lower.includes("usc-msa")) {
      reference.uscMsa = value;
    } else {
      extra.push({ label, value });
    }
  }
  if (extra.length) reference.extra = extra;
  return Object.keys(reference).length ? reference : null;
};

const parseHadithNumber = (reference, block) => {
  if (reference?.link) {
    const match = reference.link.match(/:([0-9]+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  const hrefMatch = block.match(/href="\/[^:]+:(\d+)"/);
  if (hrefMatch) return Number.parseInt(hrefMatch[1], 10);
  const stickyMatch = block.match(/class="hadith_reference_sticky">([^<]+)</);
  if (stickyMatch) {
    const numberMatch = stickyMatch[1].match(/(\d+)\s*$/);
    if (numberMatch) return Number.parseInt(numberMatch[1], 10);
  }
  return null;
};

const parseEnglishText = (englishHtml) => {
  if (!englishHtml) return { narrator: "", text: "" };
  const narratorMatch = englishHtml.match(/class=hadith_narrated[^>]*>([\s\S]*?)<\/div>/);
  const textMatch = englishHtml.match(/class=text_details[^>]*>([\s\S]*?)<\/div>/);
  const narrator = htmlToText(narratorMatch?.[1] || "");
  const text = htmlToText(textMatch?.[1] || englishHtml);
  return { narrator, text };
};

const parseSubChapters = (html) => {
  const chapters = [];
  const regex = /<div class=chapter>[\s\S]*?<div class=echapno>\((\d+)\)<\/div>\s*<div class=englishchapter>([\s\S]*?)<\/div>[\s\S]*?(?:<div class="arabicchapter arabic">([\s\S]*?)<\/div>)?/g;
  for (const match of html.matchAll(regex)) {
    const number = Number.parseInt(match[1], 10);
    const titleRaw = htmlToText(match[2] || "");
    const title = titleRaw.replace(/^Chapter:\s*/i, "");
    const arabicTitle = htmlToText(match[3] || "");
    if (!Number.isFinite(number) && !title && !arabicTitle) continue;
    chapters.push({
      index: match.index ?? 0,
      number: Number.isFinite(number) ? number : null,
      title,
      arabicTitle
    });
  }
  return chapters;
};

const parseHadithBlock = (block) => {
  const englishHtml = extractDivByClass(block, "english_hadith_full");
  const arabicHtml = extractDivByClass(block, "arabic_hadith_full");
  const { narrator, text } = parseEnglishText(englishHtml);
  if (!text) return null;
  const reference = parseReferenceTable(block);
  const number = parseHadithNumber(reference, block);
  if (!number) return null;
  const urnMatch = block.match(/id=h(\d+)/);
  const urn = urnMatch ? Number.parseInt(urnMatch[1], 10) : null;
  return {
    number,
    urn,
    text: { narrator, text },
    arab: htmlToText(arabicHtml),
    reference
  };
};

const normalizeTranslationEntry = (entry) => {
  if (!entry) return null;
  const sanad = htmlToText(entry.hadithSanad || "");
  const text = htmlToText(entry.hadithText || "");
  if (!sanad && !text) return null;
  return { sanad, text };
};

const buildTranslationMap = (payload) => {
  const map = new Map();
  const items = Array.isArray(payload) ? payload : [];
  for (const entry of items) {
    const key = entry?.matchingArabicURN || entry?.hadithNumber || entry?.ourHadithNumber;
    if (!key) continue;
    const normalized = normalizeTranslationEntry(entry);
    if (!normalized) continue;
    map.set(Number.parseInt(key, 10), normalized);
  }
  return map;
};

const fetchTranslationPayload = async (url) => {
  try {
    return await fetchJson(url);
  } catch (error) {
    console.warn(`Translation fetch failed: ${url}`);
    return [];
  }
};

const fetchTranslations = async (collectionSlug, bookId) => {
  const urduUrl = `${SITE_BASE}/ajax/urdu/${collectionSlug}/${bookId}`;
  const banglaUrl = `${SITE_BASE}/ajax/bangla/${collectionSlug}/${bookId}`;
  const [urduPayload, banglaPayload] = await Promise.all([
    fetchTranslationPayload(urduUrl),
    fetchTranslationPayload(banglaUrl)
  ]);
  return {
    urduMap: buildTranslationMap(urduPayload),
    banglaMap: buildTranslationMap(banglaPayload)
  };
};

const writeJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
};

const buildChapterRange = (book, hadithsInBook) => {
  const start = Number.isFinite(book.rangeStart)
    ? book.rangeStart
    : hadithsInBook[0]?.number ?? null;
  const end = Number.isFinite(book.rangeEnd)
    ? book.rangeEnd
    : hadithsInBook[hadithsInBook.length - 1]?.number ?? null;
  return {
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0
  };
};

const scrapeCollection = async (collection) => {
  const url = `${SITE_BASE}/${collection.sourceSlug}`;
  console.log(`Scraping ${collection.title} (${url})`);
  const html = await fetchHtml(url);
  const info = parseCollectionInfo(html);
  const books = parseBookList(html);
  const hadiths = [];
  const chapters = [];
  const seen = new Set();

  for (const [index, book] of books.entries()) {
    if (index >= maxBooks) break;
    const bookUrl = `${SITE_BASE}/${collection.sourceSlug}/${book.id}`;
    console.log(`  Fetching book ${book.id} ${book.title} (${bookUrl})`);
    const bookHtml = await fetchHtml(bookUrl);
    const hadithBlocks = [...bookHtml.matchAll(/<div class="actualHadithContainer[\s\S]*?<!-- end actual hadith container -->/g)];
    const subChapters = parseSubChapters(bookHtml);
    let subChapterIndex = 0;
    let activeSubChapter = null;
    const bookHadiths = [];
    for (const block of hadithBlocks) {
      const blockIndex = Number.isFinite(block.index) ? block.index : bookHtml.indexOf(block[0]);
      while (subChapterIndex < subChapters.length && subChapters[subChapterIndex].index < blockIndex) {
        activeSubChapter = subChapters[subChapterIndex];
        subChapterIndex += 1;
      }
      const hadith = parseHadithBlock(block[0]);
      if (!hadith || seen.has(hadith.number)) continue;
      seen.add(hadith.number);
      hadith.chapter = book.id;
      hadith.chapterTitle = book.title;
      hadith.chapterTitleArabic = book.arabicTitle;
      if (activeSubChapter) {
        hadith.subChapter = activeSubChapter.number;
        hadith.subChapterTitle = activeSubChapter.title;
        hadith.subChapterTitleArabic = activeSubChapter.arabicTitle;
      }
      bookHadiths.push(hadith);
      if (hadiths.length + bookHadiths.length >= maxHadiths) break;
    }

    const { urduMap, banglaMap } = await fetchTranslations(collection.sourceSlug, book.id);
    for (const hadith of bookHadiths) {
      const key = hadith.urn || hadith.number;
      const urdu = urduMap.get(key) || urduMap.get(hadith.number);
      const bangla = banglaMap.get(key) || banglaMap.get(hadith.number);
      if (urdu || bangla) {
        hadith.translations = {};
        if (urdu) hadith.translations.urdu = urdu;
        if (bangla) hadith.translations.bangla = bangla;
      }
    }

    hadiths.push(...bookHadiths);

    const range = buildChapterRange(book, bookHadiths);
    chapters.push({
      id: book.id,
      title: book.title,
      titleArabic: book.arabicTitle,
      hadithRange: range,
      hadithCount: range.start && range.end ? range.end - range.start + 1 : bookHadiths.length
    });

    if (hadiths.length >= maxHadiths) break;
    if (sleepMs) await sleep(sleepMs);
  }

  hadiths.sort((a, b) => a.number - b.number);

  return {
    collection: {
      id: collection.id,
      slug: collection.id,
      sourceSlug: collection.sourceSlug,
      title: collection.title,
      arabicTitle: info.arabicTitle,
      compiler: collection.compiler,
      summary: collection.summary,
      tags: collection.tags || [],
      chapterCount: chapters.length,
      count: hadiths.length
    },
    hadiths,
    chapters
  };
};

const main = async () => {
  const selected = selectedCollections
    ? selectedCollections.split(",").map((value) => value.trim())
    : null;
  const collections = selected
    ? COLLECTIONS.filter((collection) => selected.includes(collection.id))
    : COLLECTIONS;

  if (!collections.length) {
    console.error("No collections selected.");
    process.exit(1);
  }

  await fs.mkdir(HADITH_DIR, { recursive: true });
  await fs.mkdir(CHAPTER_DIR, { recursive: true });

  const collectionsOutput = [];
  const hadithByCollection = {};

  for (const collection of collections) {
    const result = await scrapeCollection(collection);
    collectionsOutput.push(result.collection);
    hadithByCollection[result.collection.id] = result.hadiths;
    await writeJson(path.join(HADITH_DIR, `${result.collection.id}.json`), {
      collection: result.collection,
      hadiths: result.hadiths
    });
    await writeJson(path.join(CHAPTER_DIR, `${result.collection.id}.json`), {
      chapters: result.chapters
    });
  }

  await writeJson(path.join(OUTPUT_ROOT, "collections.json"), collectionsOutput);

  const dailySource =
    collectionsOutput.find((collection) => collection.id === "bukhari") || collectionsOutput[0];
  const dailyHadiths = hadithByCollection[dailySource?.id] || [];
  if (dailySource && dailyHadiths.length) {
    const items = dailyHadiths.slice(0, 366).map((hadith) => ({
      number: hadith.number,
      text: hadith.text,
      arab: hadith.arab,
      reference: hadith.reference,
      translations: hadith.translations || null,
      subChapter: hadith.subChapter,
      subChapterTitle: hadith.subChapterTitle,
      subChapterTitleArabic: hadith.subChapterTitleArabic
    }));
    await writeJson(path.join(OUTPUT_ROOT, "daily.json"), {
      collection: dailySource,
      items
    });
  }

  console.log("Scrape complete.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
