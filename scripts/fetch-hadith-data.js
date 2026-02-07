import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'sunnah');

// Book collections mapping
const bookCollections = {
  'bukhari': { slug: 'bukhari', path: 'by_chapter/the_9_books/bukhari', title: 'Sahih al-Bukhari', compiler: 'Imam al-Bukhari' },
  'muslim': { slug: 'muslim', path: 'by_chapter/the_9_books/muslim', title: 'Sahih Muslim', compiler: 'Imam Muslim' },
  'abu-dawud': { slug: 'abu-daud', path: 'by_chapter/the_9_books/abu_dawud', title: 'Sunan Abu Dawud', compiler: 'Imam Abu Dawud' },
  'tirmidhi': { slug: 'tirmidzi', path: 'by_chapter/the_9_books/tirmidhi', title: 'Jami at-Tirmidhi', compiler: 'Imam al-Tirmidhi' },
  'nasai': { slug: 'nasai', path: 'by_chapter/the_9_books/nasai', title: "Sunan an-Nasa'i", compiler: "Imam an-Nasa'i" },
  'ibn-majah': { slug: 'ibnu-majah', path: 'by_chapter/the_9_books/ibn_majah', title: 'Sunan Ibn Majah', compiler: 'Imam Ibn Majah' },
  'malik': { slug: 'malik', path: 'by_chapter/the_9_books/malik', title: 'Muwatta Malik', compiler: 'Imam Malik' },
  'ahmad': { slug: 'ahmad', path: 'by_chapter/the_9_books/ahmad', title: 'Musnad Ahmad', compiler: 'Imam Ahmad ibn Hanbal' },
  'darimi': { slug: 'darimi', path: 'by_chapter/the_9_books/darimi', title: 'Sunan al-Darimi', compiler: 'Imam al-Darimi' }
};

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error.message);
  }
}

async function saveJson(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved: ${filePath}`);
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error.message);
  }
}

async function fetchBookChapters(bookKey, maxChapters = 100) {
  const book = bookCollections[bookKey];
  const allHadiths = [];
  let chapterNum = 1;
  let consecutiveFailures = 0;

  console.log(`\nFetching ${book.title}...`);

  while (chapterNum <= maxChapters && consecutiveFailures < 5) {
    const url = `${GITHUB_RAW_BASE}/${book.path}/${chapterNum}.json`;
    const chapterData = await fetchJson(url);

    if (chapterData) {
      // Process hadiths from this chapter
      const hadithArray = chapterData.hadiths || chapterData;

      if (Array.isArray(hadithArray)) {
        hadithArray.forEach(hadith => {
          allHadiths.push({
            number: hadith.id || hadith.idInBook || hadith.number || chapterNum,
            arab: hadith.arabic || hadith.ar || '',
            text: hadith.english || hadith.en || hadith.text || '',
            reference: {
              primary: `${book.title} ${hadith.id || hadith.idInBook || chapterNum}`,
              inBook: `Book ${hadith.bookId || 1}, Hadith ${hadith.idInBook || hadith.id || chapterNum}`,
            },
            chapter: hadith.chapterId || hadith.chapter || chapterNum,
            chapterTitle: chapterData.metadata?.english?.introduction || '',
            chapterTitleArabic: chapterData.metadata?.arabic?.introduction || ''
          });
        });
      }
      consecutiveFailures = 0;
      console.log(`  Chapter ${chapterNum}: ${hadithArray.length || 0} hadiths`);
    } else {
      consecutiveFailures++;
    }

    chapterNum++;
  }

  console.log(`Total hadiths fetched for ${book.title}: ${allHadiths.length}`);
  return allHadiths;
}

async function generateCollectionsFile() {
  const collections = Object.values(bookCollections).map(book => ({
    id: book.slug,
    slug: book.slug,
    title: book.title,
    compiler: book.compiler,
    summary: `Authentic collection of hadith compiled by ${book.compiler}`,
    count: 0 // Will be updated after fetching
  }));

  const filePath = path.join(OUTPUT_DIR, 'collections.json');
  await saveJson(filePath, { collections });
}

async function main() {
  console.log('Starting hadith data fetch...');

  // Ensure output directory exists
  await ensureDir(OUTPUT_DIR);
  await ensureDir(path.join(OUTPUT_DIR, 'hadiths'));

  // Generate collections file
  await generateCollectionsFile();

  // Fetch each book
  for (const [bookKey, book] of Object.entries(bookCollections)) {
    const hadiths = await fetchBookChapters(bookKey, 200); // Fetch up to 200 chapters

    if (hadiths.length > 0) {
      const outputPath = path.join(OUTPUT_DIR, 'hadiths', `${book.slug}.json`);
      await saveJson(outputPath, { hadiths });

      // Update collection count
      const collectionsPath = path.join(OUTPUT_DIR, 'collections.json');
      const collectionsData = JSON.parse(await fs.readFile(collectionsPath, 'utf-8'));
      const collection = collectionsData.collections.find(c => c.id === book.slug);
      if (collection) {
        collection.count = hadiths.length;
        await saveJson(collectionsPath, collectionsData);
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\nAll data fetched successfully!');
}

main().catch(console.error);
