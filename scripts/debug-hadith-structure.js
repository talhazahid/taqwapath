// Debug script to check actual JSON structure
const testUrls = [
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_chapter/the_9_books/bukhari/1.json',
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_chapter/the_9_books/muslim/1.json',
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_chapter/the_9_books/tirmidhi/1.json'
];

async function debugStructure() {
  for (const url of testUrls) {
    console.log(`\nFetching: ${url}`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Response type:', typeof data);
        console.log('Is array:', Array.isArray(data));
        if (Array.isArray(data)) {
          console.log('Array length:', data.length);
          if (data.length > 0) {
            console.log('First item keys:', Object.keys(data[0]));
            console.log('First item sample:', JSON.stringify(data[0], null, 2));
          }
        } else if (typeof data === 'object') {
          console.log('Object keys:', Object.keys(data));
          console.log('Sample:', JSON.stringify(data, null, 2).substring(0, 500));
        }
      } else {
        console.log('Status:', response.status);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

debugStructure();
