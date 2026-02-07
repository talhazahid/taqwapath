import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sitemapPath = path.join(__dirname, '../dist/sitemap.xml');
const distPath = path.join(__dirname, '../dist');
const content = fs.readFileSync(sitemapPath, 'utf-8');

// Extract all URLs
const urlMatches = content.match(/<url>[\s\S]*?<\/url>/g) || [];

// Categorize URLs
const categories = {
  main: [],
  bukhari: [],
  muslim: [],
  abudaud: [],
  nasai: [],
  tirmidzi: [],
  malik: [],
  ibnumajah: [],
  darimi: [],
  ahmad: [],
};

urlMatches.forEach(urlBlock => {
  const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
  if (!locMatch) return;

  const url = locMatch[1];

  if (url.includes('hadees/bukhari')) {
    categories.bukhari.push(urlBlock);
  } else if (url.includes('hadees/muslim')) {
    categories.muslim.push(urlBlock);
  } else if (url.includes('hadees/abu-daud')) {
    categories.abudaud.push(urlBlock);
  } else if (url.includes('hadees/nasai')) {
    categories.nasai.push(urlBlock);
  } else if (url.includes('hadees/tirmidzi')) {
    categories.tirmidzi.push(urlBlock);
  } else if (url.includes('hadees/malik')) {
    categories.malik.push(urlBlock);
  } else if (url.includes('hadees/ibnu-majah')) {
    categories.ibnumajah.push(urlBlock);
  } else if (url.includes('hadees/darimi')) {
    categories.darimi.push(urlBlock);
  } else if (url.includes('hadees/ahmad')) {
    categories.ahmad.push(urlBlock);
  } else {
    categories.main.push(urlBlock);
  }
});

// Generate individual sitemaps
const sitemapHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const sitemapFooter = '</urlset>';

Object.keys(categories).forEach(category => {
  if (categories[category].length === 0) return;

  const filename = `sitemap-${category}.xml`;
  const filepath = path.join(distPath, filename);
  const content = sitemapHeader + categories[category].join('\n') + '\n' + sitemapFooter;

  fs.writeFileSync(filepath, content, 'utf-8');
  console.log(`Created ${filename} with ${categories[category].length} URLs`);
});

// Generate sitemap index
const sitemapIndexHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const sitemapIndexFooter = '</sitemapindex>';

const today = new Date().toISOString().split('T')[0];
let sitemapIndexContent = sitemapIndexHeader;

Object.keys(categories).forEach(category => {
  if (categories[category].length === 0) return;

  sitemapIndexContent += `  <sitemap>\n`;
  sitemapIndexContent += `    <loc>https://taqwapath.com/sitemap-${category}.xml</loc>\n`;
  sitemapIndexContent += `    <lastmod>${today}</lastmod>\n`;
  sitemapIndexContent += `  </sitemap>\n`;
});

sitemapIndexContent += sitemapIndexFooter;

fs.writeFileSync(path.join(distPath, 'sitemap.xml'), sitemapIndexContent, 'utf-8');
console.log('\nCreated sitemap.xml (index file)');
console.log('\nSummary:');
Object.keys(categories).forEach(category => {
  if (categories[category].length > 0) {
    console.log(`  ${category}: ${categories[category].length} URLs`);
  }
});
