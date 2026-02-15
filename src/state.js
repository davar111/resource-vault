export const state = {
  lang: "ru",
  activeCollectionId: "all",
  activeSavedFilterId: null,
  sortBy: "newest",
  search: "",
  filters: {
    types: [],
    sources: [],
    tag: "",
    favoriteOnly: false
  },
  ui: {
    filtersOpen: false
  },
  recentViewedIds: [],
  items: [],
  collections: [],
  savedFilters: []
};

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
