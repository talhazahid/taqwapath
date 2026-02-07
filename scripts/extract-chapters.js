import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'public', 'data', 'sunnah', 'hadiths');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'data', 'sunnah', 'chapters');

async function extractChaptersFromBook(bookSlug) {
  const filePath = path.join(DATA_DIR, `${bookSlug}.json`);

  try {
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    const hadiths = data.hadiths || [];

    // Group hadiths by chapter
    const chapterMap = new Map();

    hadiths.forEach(hadith => {
      const chapterId = hadith.chapter || 1;

      if (!chapterMap.has(chapterId)) {
        chapterMap.set(chapterId, {
          id: chapterId,
          title: hadith.chapterTitle || `Chapter ${chapterId}`,
          titleArabic: hadith.chapterTitleArabic || '',
          hadiths: []
        });
      }

      chapterMap.get(chapterId).hadiths.push(hadith.number);
    });

    // Convert to array and calculate ranges
    const chapters = Array.from(chapterMap.values()).map(chapter => {
      const hadithNumbers = chapter.hadiths.sort((a, b) => a - b);
      return {
        id: chapter.id,
        title: chapter.title,
        titleArabic: chapter.titleArabic,
        hadithRange: {
          start: hadithNumbers[0],
          end: hadithNumbers[hadithNumbers.length - 1]
        },
        hadithCount: hadithNumbers.length
      };
    });

    // Sort by chapter ID
    chapters.sort((a, b) => a.id - b.id);

    return chapters;
  } catch (error) {
    console.error(`Error processing ${bookSlug}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('Extracting chapter metadata from all books...\n');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const books = [
    'bukhari',
    'muslim',
    'abu-daud',
    'tirmidzi',
    'nasai',
    'ibnu-majah',
    'malik',
    'darimi'
  ];

  for (const bookSlug of books) {
    console.log(`Processing ${bookSlug}...`);
    const chapters = await extractChaptersFromBook(bookSlug);

    if (chapters.length > 0) {
      const outputPath = path.join(OUTPUT_DIR, `${bookSlug}.json`);
      await fs.writeFile(outputPath, JSON.stringify({ chapters }, null, 2), 'utf-8');
      console.log(`  Extracted ${chapters.length} chapters`);
    }
  }

  console.log('\nChapter extraction complete!');
}

main().catch(console.error);
