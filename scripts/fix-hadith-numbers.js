import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = 'public/data/sunnah/hadiths';

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

async function fixHadithNumbers() {
  for (const book of books) {
    try {
      const filePath = path.join(DATA_DIR, `${book}.json`);
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

      if (!data.hadiths || !Array.isArray(data.hadiths)) {
        console.log(`❌ ${book}: No hadiths array found`);
        continue;
      }

      // Renumber hadiths sequentially based on array order
      data.hadiths.forEach((hadith, index) => {
        hadith.number = index + 1;
      });

      // Write back to file
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

      console.log(`✅ ${book}: Fixed ${data.hadiths.length} hadith numbers`);
    } catch (error) {
      console.log(`❌ ${book}: ${error.message}`);
    }
  }
}

console.log('Fixing hadith numbers to sequential/global numbering...\n');
fixHadithNumbers().then(() => {
  console.log('\nDone!');
});
