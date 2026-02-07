import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const RECITERS_URL = "https://quranicaudio.com/api/qaris";
const OUTPUT_PATH = path.resolve(process.cwd(), "src", "data", "quran-durations.json");
const PUBLIC_PATH = path.resolve(process.cwd(), "public", "data", "quran-durations.json");
const BASE_URL = "https://download.quranicaudio.com/quran/";
const SURAH_COUNT = 114;

const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY ?? 4));
const SAVE_EVERY = Math.max(1, Number(process.env.SAVE_EVERY ?? 200));
const LOG_EVERY = Math.max(1, Number(process.env.LOG_EVERY ?? 200));
const PROBE_TIMEOUT_MS = Math.max(5000, Number(process.env.PROBE_TIMEOUT_MS ?? 45000));
const FFPROBE_BIN = process.env.FFPROBE_BIN || "ffprobe";

const pad3 = (value) => String(value).padStart(3, "0");
const normalizePath = (input = "") => {
  if (!input) return "";
  return input.endsWith("/") ? input : `${input}/`;
};
const buildUrl = (reciterPath, surahNumber) => `${BASE_URL}${reciterPath}${pad3(surahNumber)}.mp3`;

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
};

const ensureDurationArray = (value) => {
  const next = Array.isArray(value) ? value.slice(0, SURAH_COUNT + 1) : [];
  while (next.length < SURAH_COUNT + 1) {
    next.push(null);
  }
  return next;
};

const loadExisting = async () => {
  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const probeDuration = (url) =>
  new Promise((resolve) => {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      url
    ];
    const proc = spawn(FFPROBE_BIN, args, { windowsHide: true });
    let stdout = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill();
        resolve(null);
      }
    }, PROBE_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(null);
    });

    proc.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const value = Number.parseFloat(stdout.trim());
      if (!Number.isFinite(value) || value <= 0) {
        resolve(null);
        return;
      }
      resolve(Math.floor(value));
    });
  });

const main = async () => {
  const rawReciters = await fetchJson(RECITERS_URL);
  const reciters = rawReciters
    .filter((reciter) => !reciter.file_formats || String(reciter.file_formats).includes("mp3"))
    .map((reciter) => ({
      id: reciter.id ?? reciter.name,
      name: reciter.name || "Reciter",
      path: normalizePath(reciter.relative_path || reciter.relativePath || "")
    }))
    .filter((reciter) => reciter.path);

  const recitersByPath = new Map();
  reciters.forEach((reciter) => {
    if (!recitersByPath.has(reciter.path)) {
      recitersByPath.set(reciter.path, reciter);
    }
  });
  const uniqueReciters = Array.from(recitersByPath.values()).sort((a, b) => a.name.localeCompare(b.name));

  const existing = await loadExisting();
  const data = existing && typeof existing === "object" ? existing : { meta: {}, reciters: {} };
  if (!data.reciters || typeof data.reciters !== "object") {
    data.reciters = {};
  }

  uniqueReciters.forEach((reciter) => {
    data.reciters[reciter.path] = ensureDurationArray(data.reciters[reciter.path]);
  });

  const tasks = [];
  uniqueReciters.forEach((reciter) => {
    const durations = data.reciters[reciter.path];
    for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
      if (Number.isFinite(durations[surah]) && durations[surah] > 0) {
        continue;
      }
      tasks.push({ path: reciter.path, surah });
    }
  });

  const total = tasks.length;
  let completed = 0;
  let failures = 0;
  let savePromise = null;

  const saveData = async (status) => {
    data.meta = {
      generatedAt: new Date().toISOString(),
      source: RECITERS_URL,
      reciterCount: uniqueReciters.length,
      surahCount: SURAH_COUNT,
      durationFormat: "seconds",
      status
    };
    const payload = JSON.stringify(data, null, 2);
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, payload, "utf8");
    await fs.mkdir(path.dirname(PUBLIC_PATH), { recursive: true });
    await fs.writeFile(PUBLIC_PATH, payload, "utf8");
  };

  const requestSave = async (status) => {
    if (savePromise) {
      await savePromise;
    }
    savePromise = saveData(status);
    await savePromise;
    savePromise = null;
  };

  console.log(
    `Scanning ${uniqueReciters.length} reciters * ${SURAH_COUNT} surahs = ${uniqueReciters.length * SURAH_COUNT} files`
  );
  console.log(`Pending tasks: ${total}. Concurrency: ${CONCURRENCY}.`);

  const runWorker = async () => {
    while (true) {
      const index = tasks.shift();
      if (!index) return;
      const url = buildUrl(index.path, index.surah);
      const duration = await probeDuration(url);
      data.reciters[index.path][index.surah] = duration;
      completed += 1;
      if (!duration) failures += 1;

      if (completed % LOG_EVERY === 0 || completed === total) {
        const percent = total ? ((completed / total) * 100).toFixed(1) : "100.0";
        console.log(`Progress: ${completed}/${total} (${percent}%). Missing: ${failures}`);
      }

      if (completed % SAVE_EVERY === 0) {
        await requestSave("partial");
      }
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => runWorker());
  await Promise.all(workers);
  await requestSave("complete");

  console.log(`Done. Missing durations: ${failures}. Saved to ${OUTPUT_PATH}.`);
};

main().catch((error) => {
  console.error("Duration scan failed.", error);
  process.exitCode = 1;
});
