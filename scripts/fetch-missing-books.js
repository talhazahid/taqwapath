import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'sunnah');

// Try different path variations for the missing books
const bookVariations = {
  'abu-daud': [
    'by_chapter/the_9_books/abu_dawud',
    'by_chapter/the_9_books/abudawud',
    'by_chapter/the_9_books/abu-dawud',
    'by_book/the_9_books/abu_dawud',
    'by_book/the_9_books/abudawud'
  ],
  'ibnu-majah': [
    'by_chapter/the_9_books/ibn_majah',
    'by_chapter/the_9_books/ibnmajah',
    'by_chapter/the_9_books/ibn-majah',
    'by_book/the_9_books/ibn_majah',
    'by_book/the_9_books/ibnmajah'
  ],
  'ahmad': [
    'by_chapter/the_9_books/ahmad',
    'by_book/the_9_books/ahmad'
  ]
};

const bookMeta = {
  'abu-daud': { slug: 'abu-daud', title: 'Sunan Abu Dawud', compiler: 'Imam Abu Dawud' },
  'ibnu-majah': { slug: 'ibnu-majah', title: 'Sunan Ibn Majah', compiler: 'Imam Ibn Majah' },
  'ahmad': { slug: 'ahmad', title: 'Musnad Ahmad', compiler: 'Imam Ahmad ibn Hanbal' }
};

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function tryFetchBook(bookKey, variations) {
  console.log(`\nTrying to fetch ${bookMeta[bookKey].title}...`);

  for (const basePath of variations) {
    console.log(`  Trying path: ${basePath}`);

    // Try to fetch a single book file first
    const bookFileUrl = `${GITHUB_RAW_BASE}/${basePath}.json`;
    let bookData = await fetchJson(bookFileUrl);

    if (bookData) {
      console.log(`  Found book file! Processing...`);
      return processBookFile(bookData, bookMeta[bookKey]);
    }

    // Try chapter-by-chapter approach
    const allHadiths = [];
    let chapterNum = 1;
    let consecutiveFailures = 0;

    while (consecutiveFailures < 5 && chapterNum <= 200) {
      const chapterUrl = `${GITHUB_RAW_BASE}/${basePath}/${chapterNum}.json`;
      const chapterData = await fetchJson(chapterUrl);

      if (chapterData) {
        const hadithArray = chapterData.hadiths || chapterData;

        if (Array.isArray(hadithArray)) {
          hadithArray.forEach(hadith => {
            const englishText = hadith.english || hadith.en || hadith.text || '';
            const narrator = typeof englishText === 'string' && englishText.includes(':')
              ? englishText.split(':')[0] + ':'
              : '';

            allHadiths.push({
              number: hadith.id || hadith.idInBook || hadith.number || chapterNum,
              arab: hadith.arabic || hadith.ar || '',
              text: {
                narrator: narrator,
                text: englishText
              },
              reference: {
                primary: `${bookMeta[bookKey].title} ${hadith.id || hadith.idInBook || chapterNum}`,
                inBook: `Book ${hadith.bookId || 1}, Hadith ${hadith.idInBook || hadith.id || chapterNum}`,
              },
              chapter: hadith.chapterId || hadith.chapter || chapterNum,
              chapterTitle: chapterData.metadata?.english?.introduction || '',
              chapterTitleArabic: chapterData.metadata?.arabic?.introduction || ''
            });
          });
          console.log(`    Chapter ${chapterNum}: ${hadithArray.length} hadiths (Total: ${allHadiths.length})`);
          consecutiveFailures = 0;
        }
      } else {
        consecutiveFailures++;
      }
      chapterNum++;
    }

    if (allHadiths.length > 0) {
      console.log(`  Success! Found ${allHadiths.length} hadiths using path: ${basePath}`);
      return allHadiths;
    }
  }

  console.log(`  Failed to find data for ${bookMeta[bookKey].title}`);
  return [];
}

function processBookFile(bookData, meta) {
  // Process a single book JSON file
  const hadiths = [];
  const hadithArray = bookData.hadiths || bookData;

  if (Array.isArray(hadithArray)) {
    hadithArray.forEach(hadith => {
      const englishText = hadith.english || '';
      const narrator = typeof englishText === 'string' && englishText.includes(':')
        ? englishText.split(':')[0] + ':'
        : '';

      hadiths.push({
        number: hadith.id || hadith.number,
        arab: hadith.arabic || '',
        text: {
          narrator: narrator,
          text: englishText
        },
        reference: {
          primary: `${meta.title} ${hadith.id}`,
          inBook: `Book ${hadith.bookId || 1}, Hadith ${hadith.id}`
        },
        chapter: hadith.chapterId || 1,
        chapterTitle: hadith.chapter || '',
        chapterTitleArabic: ''
      });
    });
  }

  return hadiths;
}

async function saveHadiths(slug, hadiths) {
  const filePath = path.join(OUTPUT_DIR, 'hadiths', `${slug}.json`);
  await fs.writeFile(filePath, JSON.stringify({ hadiths }, null, 2), 'utf-8');
  console.log(`Saved ${hadiths.length} hadiths to ${filePath}`);
}

async function updateCollections(slug, count) {
  const collectionsPath = path.join(OUTPUT_DIR, 'collections.json');
  const data = JSON.parse(await fs.readFile(collectionsPath, 'utf-8'));

  const collection = data.collections.find(c => c.slug === slug);
  if (collection) {
    collection.count = count;
    await fs.writeFile(collectionsPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Updated collection count for ${slug}: ${count}`);
  }
}

async function main() {
  console.log('Fetching missing hadith collections from GitHub...\n');

  for (const [bookKey, variations] of Object.entries(bookVariations)) {
    const hadiths = await tryFetchBook(bookKey, variations);

    if (hadiths.length > 0) {
      await saveHadiths(bookMeta[bookKey].slug, hadiths);
      await updateCollections(bookMeta[bookKey].slug, hadiths.length);
    }

    // Delay between books
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\nAll done!');
}

main().catch(console.error);
