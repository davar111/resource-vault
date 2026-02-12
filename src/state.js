export const state = {
  lang: "ru",
  activeCollectionId: "all",
  search: "",
  activeTag: "",
  items: [],
  collections: [
    { id: "all", name: "All", rules: {} },
    { id: "fav", name: "Favorites", rules: { favoriteOnly: true } }
  ]
};

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
