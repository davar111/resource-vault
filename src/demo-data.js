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
    id: "demo-pinterest",
    url: "https://ru.pinterest.com/pin/1139199668273118074/",
    title: "Pinterest: креативная типографика",
    type: "inspiration",
    source: "pinterest",
    tags: ["типографика", "плакат", "графический дизайн"],
    favorite: false,
    note: "Интересный пример шрифтовой композиции"
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
    id: "demo-humane",
    url: "https://humanebydesign.ru/principles/empowering/index.html#best-practices",
    title: "Humane by Design: Расширение возможностей",
    type: "article",
    source: "site",
    tags: ["этика", "ux", "гуманный дизайн"],
    favorite: false,
    note: "Принципы человеко-ориентированного дизайна"
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
  },
  {
    id: "demo-smashing",
    url: "https://www.smashingmagazine.com/category/web-design/",
    title: "Smashing Magazine — Web Design",
    type: "article",
    source: "site",
    tags: ["статьи", "ui", "туториалы"],
    favorite: false,
    note: "Кладезь полезных материалов"
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

