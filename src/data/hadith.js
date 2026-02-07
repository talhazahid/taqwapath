export const fallbackBooks = [
  {
    id: "bukhari",
    slug: "bukhari",
    title: "Sahih al-Bukhari",
    compiler: "Imam al-Bukhari",
    count: 7563,
    summary: "One of the most authentic collections of prophetic traditions."
  },
  {
    id: "muslim",
    slug: "muslim",
    title: "Sahih Muslim",
    compiler: "Imam Muslim",
    count: 5362,
    summary: "A comprehensive collection focused on authenticity and rigor."
  },
  {
    id: "abu-daud",
    slug: "abu-daud",
    title: "Sunan Abu Dawud",
    compiler: "Imam Abu Dawud",
    count: 4419,
    summary: "A juristic collection covering worship and daily conduct."
  },
  {
    id: "tirmidzi",
    slug: "tirmidzi",
    title: "Jami at-Tirmidhi",
    compiler: "Imam al-Tirmidhi",
    count: 3891,
    summary: "Hadith covering belief, worship, and character."
  }
];

export const fallbackHadithByBook = {
  bukhari: [
    {
      number: 1,
      arab: "",
      text: "Actions are judged by intentions, and each person will have what they intended.",
      reference: {
        primary: "Sahih al-Bukhari 1"
      }
    },
    {
      number: 8,
      arab: "",
      text: "Make things easy and do not make them difficult, and give glad tidings.",
      reference: {
        primary: "Sahih al-Bukhari 8"
      }
    }
  ],
  muslim: [
    {
      number: 1,
      arab: "",
      text: "Purity is half of faith, and remembrance of Allah fills the scale.",
      reference: {
        primary: "Sahih Muslim 1"
      }
    }
  ],
  "abu-daud": [
    {
      number: 1,
      arab: "",
      text: "When the Prophet wanted to relieve himself, he would go far away.",
      reference: {
        primary: "Sunan Abu Dawud 1"
      }
    }
  ],
  tirmidzi: [
    {
      number: 1,
      arab: "",
      text: "The best among you are those who learn the Quran and teach it.",
      reference: {
        primary: "Jami at-Tirmidhi 1"
      }
    }
  ]
};
