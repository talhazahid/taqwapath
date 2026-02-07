import fs from "node:fs/promises";
import path from "node:path";

const START_YEAR = Number(process.env.START_YEAR ?? 2026);
const YEARS = Number(process.env.YEARS ?? 5);
const OUTPUT_DIR = path.resolve(process.cwd(), "public", "data", "islamic-calendar");
const API_BASE = "https://api.aladhan.com/v1/gToHCalendar";

const toAscii = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/[^\x20-\x7E]/g, "").trim();
};

const normalizeDay = (day) => ({
  gregorian: {
    day: toAscii(day?.gregorian?.day || "")
  },
  hijri: {
    day: toAscii(day?.hijri?.day || ""),
    month: {
      en: toAscii(day?.hijri?.month?.en || "")
    },
    year: toAscii(day?.hijri?.year || ""),
    holidays: Array.isArray(day?.hijri?.holidays)
      ? day.hijri.holidays.map(toAscii).filter(Boolean)
      : []
  }
});

const fetchMonth = async (month, year) => {
  const url = `${API_BASE}/${month}/${year}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${month}/${year}`);
  }
  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map(normalizeDay);
};

const generateYear = async (year) => {
  const months = {};
  for (let month = 1; month <= 12; month += 1) {
    const days = await fetchMonth(month, year);
    months[String(month)] = days;
    console.log(`Fetched ${year}-${String(month).padStart(2, "0")}`);
  }

  const output = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: API_BASE,
      year
    },
    months
  };

  const filePath = path.join(OUTPUT_DIR, `${year}.json`);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Saved ${filePath}`);
};

const main = async () => {
  for (let i = 0; i < YEARS; i += 1) {
    const year = START_YEAR + i;
    await generateYear(year);
  }
};

main().catch((error) => {
  console.error("Calendar generation failed.", error);
  process.exitCode = 1;
});
