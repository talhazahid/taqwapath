import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://hadithapi.com/api';
const API_KEY = 'hadiths2024$8520'; // Public demo key from their docs
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'sunnah', 'hadiths');

// Book mappings
const books = {
  'abudawud': { slug: 'abu-daud', title: 'Sunan Abu Dawud', compiler: 'Imam Abu Dawud' },
  'ibnmajah': { slug: 'ibnu-majah', title: 'Sunan Ibn Majah', compiler: 'Imam Ibn Majah' },
  // Ahmad is very large, we'll handle it separately
};

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchHadithsForBook(bookSlug, bookInfo) {
  console.log(`\nFetching ${bookInfo.title}...`);

  let allHadiths = [];
  let page = 1;
  const perPage = 100; // Fetch 100 at a time
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `${API_BASE}/hadiths/?apiKey=${API_KEY}&book=${bookSlug}&paginate=${perPage}&page=${page}`;
      console.log(`  Fetching page ${page}...`);

      const response = await fetch(url);

      if (!response.ok) {
        console.log(`  Failed to fetch page ${page}: ${response.status}`);
        break;
      }

      const data = await response.json();

      // Check the response structure
      const hadiths = data.hadiths?.data || data.data || data.hadiths || [];

      if (!Array.isArray(hadiths) || hadiths.length === 0) {
        console.log(`  No more hadiths found at page ${page}`);
        break;
      }

      // Process and normalize hadiths
      hadiths.forEach(hadith => {
        allHadiths.push({
          number: hadith.hadithNumber || hadith.id || allHadiths.length + 1,
          arab: hadith.hadithArabic || hadith.arabic || '',
          text: {
            narrator: hadith.hadithEnglish?.includes('Narrated')
              ? hadith.hadithEnglish.split(':')[0] + ':'
              : '',
            text: hadith.hadithEnglish || hadith.english || ''
          },
          reference: {
            primary: `${bookInfo.title} ${hadith.hadithNumber || hadith.id}`,
            inBook: `Book ${hadith.bookSlug || bookSlug}, Hadith ${hadith.hadithNumber || hadith.id}`
          },
          chapter: hadith.chapterId || hadith.chapter || 1,
          chapterTitle: hadith.chapterEnglish || '',
          chapterTitleArabic: hadith.chapterArabic || ''
        });
      });

      console.log(`  Fetched ${hadiths.length} hadiths (Total: ${allHadiths.length})`);

      // Check if there are more pages
      if (hadiths.length < perPage) {
        hasMore = false;
      } else {
        page++;
        await delay(1000); // Rate limiting
      }

    } catch (error) {
      console.error(`  Error fetching page ${page}:`, error.message);
      break;
    }
  }

  return allHadiths;
}

async function saveHadiths(slug, hadiths) {
  const filePath = path.join(OUTPUT_DIR, `${slug}.json`);
  await fs.writeFile(filePath, JSON.stringify({ hadiths }, null, 2), 'utf-8');
  console.log(`Saved ${hadiths.length} hadiths to ${filePath}`);
}

async function updateCollections(slug, count) {
  const collectionsPath = path.join(process.cwd(), 'public', 'data', 'sunnah', 'collections.json');
  const data = JSON.parse(await fs.readFile(collectionsPath, 'utf-8'));

  const collection = data.collections.find(c => c.slug === slug);
  if (collection) {
    collection.count = count;
    await fs.writeFile(collectionsPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Updated collection count for ${slug}: ${count}`);
  }
}

async function main() {
  console.log('Starting API fetch for missing collections...\n');

  for (const [apiSlug, bookInfo] of Object.entries(books)) {
    try {
      const hadiths = await fetchHadithsForBook(apiSlug, bookInfo);

      if (hadiths.length > 0) {
        await saveHadiths(bookInfo.slug, hadiths);
        await updateCollections(bookInfo.slug, hadiths.length);
      } else {
        console.log(`No hadiths fetched for ${bookInfo.title}`);
      }

      // Delay between books to avoid rate limiting
      await delay(2000);
    } catch (error) {
      console.error(`Error processing ${bookInfo.title}:`, error.message);
    }
  }

  console.log('\nAPI fetch complete!');
}

main().catch(console.error);
