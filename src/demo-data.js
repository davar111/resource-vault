import { previewFallbackUrl } from "./filter.js";

const now = Date.now();

const BASE_DEMO_LINKS = [
  {
    id: "demo-behance",
    url: "https://www.behance.net/",
    title: "Behance — главная",
    type: "inspiration",
    source: "behance",
    tags: ["портал", "вдохновение", "проекты"],
    favorite: true,
    note: "Лучшее для поиска идей"
  },
  {
    id: "demo-cssda",
    url: "https://www.cssdesignawards.com/",
    title: "CSS Design Awards — сайт дня",
    type: "inspiration",
    source: "site",
    tags: ["награды", "интерактив", "тренды"],
    favorite: true,
    note: "Свежие вау-сайты"
  },
  {
    id: "demo-lawsofux",
    url: "https://lawsofux.com/",
    title: "Laws of UX",
    type: "article",
    source: "site",
    tags: ["психология", "юзабилити", "законы"],
    favorite: true,
    note: "База, которую надо знать"
  },
  {
    id: "demo-gsap",
    url: "https://gsap.com/showcase/?page=3",
    title: "GSAP Showcase",
    type: "case",
    source: "site",
    tags: ["анимация", "javascript", "портфолио"],
    favorite: true,
    note: "Примеры крутой веб-анимации"
  }
];

export function makeDemoLinks() {
  return BASE_DEMO_LINKS.map((item, idx) => ({
    ...item,
    hidden: false,
    isDemo: true,
    createdAt: now - idx * 60_000,
    updatedAt: now - idx * 60_000,
    previewImage: previewFallbackUrl(item.url),
    collectionIds: []
  }));
}
