import { fallbackBooks, fallbackHadithByBook } from "../data/hadith.js";
import fs from "node:fs/promises";
import path from "node:path";

const bookMeta = {
  "abu-daud": {
    title: "Sunan Abu Dawud",
    arabicTitle: "سنن أبي داود",
    compiler: "Imam Abu Dawud",
    summary: "A juristic collection covering worship and daily conduct.",
    tags: ["fiqh"]
  },
  ahmad: {
    title: "Musnad Ahmad",
    arabicTitle: "مسند أحمد",
    compiler: "Imam Ahmad ibn Hanbal",
    summary: "An expansive collection organized by companion.",
    tags: ["ethics"]
  },
  bukhari: {
    title: "Sahih al-Bukhari",
    arabicTitle: "صحيح البخاري",
    compiler: "Imam al-Bukhari",
    summary: "One of the most authentic collections of prophetic traditions.",
    tags: ["popular"]
  },
  darimi: {
    title: "Sunan al-Darimi",
    arabicTitle: "سنن الدارمي",
    compiler: "Imam al-Darimi",
    summary: "A foundational collection with a focus on law and guidance.",
    tags: ["fiqh"]
  },
  "ibnu-majah": {
    title: "Sunan Ibn Majah",
    arabicTitle: "سنن ابن ماجه",
    compiler: "Imam Ibn Majah",
    summary: "Well known collection covering worship and conduct.",
    tags: ["fiqh"]
  },
  malik: {
    title: "Muwatta Malik",
    arabicTitle: "موطأ مالك",
    compiler: "Imam Malik",
    summary: "Early collection blending hadith with legal rulings.",
    tags: ["fiqh"]
  },
  muslim: {
    title: "Sahih Muslim",
    arabicTitle: "صحيح مسلم",
    compiler: "Imam Muslim",
    summary: "A comprehensive collection focused on authenticity and rigor.",
    tags: ["popular"]
  },
  nasai: {
    title: "Sunan an-Nasa'i",
    arabicTitle: "سنن النسائي",
    compiler: "Imam an-Nasa'i",
    summary: "Detailed narrations with a focus on legal chapters.",
    tags: ["fiqh"]
  },
  tirmidzi: {
    title: "Jami at-Tirmidhi",
    arabicTitle: "جامع الترمذي",
    compiler: "Imam al-Tirmidhi",
    summary: "Hadith covering belief, worship, and character.",
    tags: ["ethics"]
  }
};

const DATA_ROOT = path.join(process.cwd(), "public", "data", "sunnah");

const readJson = async (relativePath) => {
  try {
    const raw = await fs.readFile(path.join(DATA_ROOT, relativePath), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const normalizeBook = (book) => {
  const meta = bookMeta[book.id] || {};
  const types = book.tags || book.types || meta.tags || [];
  return {
    id: book.id,
    slug: book.slug || book.id,
    title: meta.title || book.title || book.name || book.id,
    arabicTitle: book.arabicTitle || meta.arabicTitle || "",
    compiler: meta.compiler || book.compiler || "Hadith collection",
    summary: meta.summary || book.summary || "Trusted collection of prophetic traditions.",
    count: book.count || book.available || 0,
    chapterCount: book.chapterCount || book.chapters || 0,
    types: Array.isArray(types) ? types : types ? [types] : []
  };
};

const buildLocalHadithLink = (bookSlug, number) => {
  if (!bookSlug || number === undefined || number === null) return "";
  return `/hadees/${bookSlug}-${number}`;
};

const normalizeReference = (reference, bookTitle, number, bookSlug) => {
  const localLink = buildLocalHadithLink(bookSlug, number);
  if (!reference && bookTitle && number) {
    return { primary: `${bookTitle} ${number}`, link: localLink || undefined };
  }
  if (!reference) return null;
  if (typeof reference === "string") {
    return { primary: reference, link: localLink || undefined };
  }
  const { link: ignoredLink, ...rest } = reference;
  const primary = reference.primary || reference.reference || reference.main;
  return {
    ...rest,
    primary: primary || (bookTitle && number ? `${bookTitle} ${number}` : undefined),
    link: localLink || undefined
  };
};

const normalizeHadithText = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.text === "object" && typeof value.text.text === "string") return value.text.text;
    if (typeof value.english === "string") return value.english;
  }
  return String(value);
};

const normalizeNarrator = (value) => {
  if (!value || typeof value !== "object") return "";
  return value.narrator || "";
};

const normalizeHadith = (hadith, bookTitle, bookSlug) => {
  if (!hadith) return null;
  const englishText = normalizeHadithText(hadith.text || hadith.english);
  return {
    number: hadith.number,
    arab: hadith.arab || "",
    text: englishText,
    narrator: normalizeNarrator(hadith.text),
    translations: hadith.translations || null,
    reference: normalizeReference(hadith.reference, bookTitle, hadith.number, bookSlug),
    chapter: hadith.chapter,
    chapterTitle: hadith.chapterTitle,
    chapterTitleArabic: hadith.chapterTitleArabic,
    subChapter: hadith.subChapter,
    subChapterTitle: hadith.subChapterTitle,
    subChapterTitleArabic: hadith.subChapterTitleArabic
  };
};

const parseRange = (range) => {
  if (typeof range !== "string") return { start: 1, end: Number.POSITIVE_INFINITY };
  const [startRaw, endRaw] = range.split("-");
  const start = Number.parseInt(startRaw, 10);
  const end = Number.parseInt(endRaw ?? startRaw, 10);
  const safeStart = Number.isFinite(start) ? start : 1;
  const safeEnd = Number.isFinite(end) ? end : safeStart;
  return { start: safeStart, end: safeEnd };
};

const getDayOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
};

const mergeChapterInfo = (hadith, chapterMap) => {
  if (!hadith || !chapterMap) return hadith;
  const entry = chapterMap[hadith.number];
  if (!entry) return hadith;
  return {
    ...hadith,
    chapter: hadith.chapter ?? entry.chapter,
    chapterTitle: hadith.chapterTitle ?? entry.chapterTitle,
    chapterTitleArabic: hadith.chapterTitleArabic ?? entry.chapterTitleArabic,
    subChapter: hadith.subChapter ?? entry.subChapter,
    subChapterTitle: hadith.subChapterTitle ?? entry.subChapterTitle,
    subChapterTitleArabic: hadith.subChapterTitleArabic ?? entry.subChapterTitleArabic
  };
};

const buildDailyChapterMap = async (bookSlug, items) => {
  if (!bookSlug || !Array.isArray(items) || !items.length) return {};
  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const numbers = new Set(items.map((item) => toNumber(item?.number)).filter((value) => value !== null));
  if (!numbers.size) return {};
  const payload = await readJson(path.join("hadiths", `${bookSlug}.json`));
  const hadiths = Array.isArray(payload?.hadiths)
    ? payload.hadiths
    : Array.isArray(payload)
      ? payload
      : [];
  const map = {};
  let found = 0;
  for (const entry of hadiths) {
    const number = toNumber(entry?.number);
    if (number === null) continue;
    if (!numbers.has(number)) continue;
    map[number] = {
      chapter: entry.chapter,
      chapterTitle: entry.chapterTitle,
      chapterTitleArabic: entry.chapterTitleArabic,
      subChapter: entry.subChapter,
      subChapterTitle: entry.subChapterTitle,
      subChapterTitleArabic: entry.subChapterTitleArabic
    };
    found += 1;
    if (found >= numbers.size) break;
  }
  return map;
};

export const fetchHadithBooks = async () => {
  const payload = await readJson("collections.json");
  const data = Array.isArray(payload) ? payload : payload?.collections;
  if (Array.isArray(data) && data.length) {
    return data.map(normalizeBook);
  }
  return fallbackBooks.map(normalizeBook);
};

export const fetchHadiths = async (bookId, range = "1-12", bookTitle = "Hadith") => {
  const payload = await readJson(path.join("hadiths", `${bookId}.json`));
  const hadiths = Array.isArray(payload?.hadiths)
    ? payload.hadiths
    : Array.isArray(payload)
      ? payload
      : [];
  if (hadiths.length) {
    const { start, end } = parseRange(range);
    return hadiths
      .filter((hadith) => hadith.number >= start && hadith.number <= end)
      .map((hadith) => normalizeHadith(hadith, bookTitle, bookId));
  }
  const fallback = fallbackHadithByBook[bookId] || [];
  return fallback.map((hadith) => normalizeHadith(hadith, bookTitle, bookId));
};

export const fetchHadithOfDay = async () => {
  const daily = await readJson("daily.json");
  if (daily?.items?.length) {
    const bookTitle = daily.collection?.title || "Hadith";
    const bookSlug = daily.collection?.slug || daily.collection?.id || daily.collection?.sourceSlug || "";
    const chapterMap = await buildDailyChapterMap(bookSlug, daily.items);
    const normalizedItems = daily.items
      .map((item) => mergeChapterInfo(normalizeHadith(item, bookTitle, bookSlug), chapterMap))
      .filter(Boolean);
    const filteredItems = normalizedItems.filter((item) => {
      const text = (item.text || "").replace(/\s+/g, " ").trim();
      return text.length >= 140 && text.length <= 200;
    });
    const pool = filteredItems.length ? filteredItems : normalizedItems;
    const index = getDayOfYear();
    const hadith = pool[index % pool.length];
    return {
      book: normalizeBook(daily.collection || {}),
      hadith,
      chapterMap
    };
  }
  const books = await fetchHadithBooks();
  const preferred = books.find((book) => book.id === "bukhari") || books[0];
  if (!preferred) return null;

  const total = preferred.count || 1;
  const index = (getDayOfYear() % total) + 1;
  const range = `${index}-${index}`;

  const hadiths = await fetchHadiths(preferred.id, range, preferred.title);
  const hadith = hadiths[0] || (fallbackHadithByBook[preferred.id] || [])[0];
  const bookSlug = preferred.slug || preferred.id;

  return {
    book: preferred,
    hadith: normalizeHadith(hadith, preferred.title, bookSlug),
    chapterMap: {}
  };
};

export const fetchChapters = async (bookSlug) => {
  const payload = await readJson(path.join("chapters", `${bookSlug}.json`));
  const chapters = payload?.chapters || [];
  return chapters;
};
