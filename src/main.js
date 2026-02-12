import "./styles.css";
import { state, uid } from "./state.js";
import { load, save } from "./storage.js";
import { normalizeTags, detectSource, domainFromUrl, tryFetchTitle, tryFetchPreview, previewFallbackUrl } from "./filter.js";
import { render } from "./ui.js";
import { t } from "./i18n.js";

const TYPE_OPTIONS = ["project", "studio", "designer", "inspiration"];
const SOURCE_OPTIONS = ["site", "behance", "awwwards", "pinterest", "dribbble", "other"];

const els = {
  langRu: document.getElementById("langRu"),
  langEn: document.getElementById("langEn"),
  brand: document.getElementById("brand"),

  navAll: document.getElementById("navAll"),
  navFav: document.getElementById("navFav"),
  labelNav: document.getElementById("labelNav"),
  labelCollections: document.getElementById("labelCollections"),
  collectionsList: document.getElementById("collectionsList"),

  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  btnFilters: document.getElementById("btnFilters"),
  filtersPanel: document.getElementById("filtersPanel"),
  activeFilters: document.getElementById("activeFilters"),

  filterTypes: document.getElementById("filterTypes"),
  filterSources: document.getElementById("filterSources"),
  filterTagInput: document.getElementById("filterTagInput"),
  filterFavoriteOnly: document.getElementById("filterFavoriteOnly"),
  labelFilterTypes: document.getElementById("labelFilterTypes"),
  labelFilterSources: document.getElementById("labelFilterSources"),
  labelFilterTag: document.getElementById("labelFilterTag"),
  labelFilterFavorite: document.getElementById("labelFilterFavorite"),

  grid: document.getElementById("grid"),

  btnAddLink: document.getElementById("btnAddLink"),
  btnNewCollection: document.getElementById("btnNewCollection"),

  btnSettings: document.getElementById("btnSettings"),
  settingsMenu: document.getElementById("settingsMenu"),
  btnExport: document.getElementById("btnExport"),
  btnImport: document.getElementById("btnImport"),
  fileImport: document.getElementById("fileImport"),
  localHint: document.getElementById("localHint"),

  modalAddLink: document.getElementById("modalAddLink"),
  formAddLink: document.getElementById("formAddLink"),
  addCloseX: document.getElementById("addCloseX"),
  addCancel: document.getElementById("addCancel"),
  addSave: document.getElementById("addSave"),
  modalAddTitle: document.getElementById("modalAddTitle"),
  labelAddUrl: document.getElementById("labelAddUrl"),
  labelAddTitle: document.getElementById("labelAddTitle"),
  labelAddTags: document.getElementById("labelAddTags"),
  labelAddType: document.getElementById("labelAddType"),
  labelAddSource: document.getElementById("labelAddSource"),
  labelAddNote: document.getElementById("labelAddNote"),
  labelAddTo: document.getElementById("labelAddTo"),
  labelAddFavorite: document.getElementById("labelAddFavorite"),
  sectionAddClassify: document.getElementById("sectionAddClassify"),
  inputAddTitle: document.getElementById("inputAddTitle"),
  inputAddTags: document.getElementById("inputAddTags"),
  inputAddNote: document.getElementById("inputAddNote"),
  addCollectionsList: document.getElementById("addCollectionsList"),
  addFavorite: document.getElementById("addFavorite"),

  modalCollection: document.getElementById("modalCollection"),
  formCollection: document.getElementById("formCollection"),
  colCloseX: document.getElementById("colCloseX"),
  colCancel: document.getElementById("colCancel"),
  colCreate: document.getElementById("colCreate"),
  modalCollectionTitle: document.getElementById("modalCollectionTitle"),
  labelColName: document.getElementById("labelColName"),
  labelColDescription: document.getElementById("labelColDescription"),
  labelRulesEnabled: document.getElementById("labelRulesEnabled"),
  sectionColRules: document.getElementById("sectionColRules"),
  labelColTypes: document.getElementById("labelColTypes"),
  labelColSources: document.getElementById("labelColSources"),
  labelColAllTags: document.getElementById("labelColAllTags"),
  labelColAnyTags: document.getElementById("labelColAnyTags"),
  labelColQuery: document.getElementById("labelColQuery"),
  labelColFavOnly: document.getElementById("labelColFavOnly"),
  rulesEnabled: document.getElementById("rulesEnabled"),
  collectionRules: document.getElementById("collectionRules"),
  colTypesChips: document.getElementById("colTypesChips"),
  colSourcesChips: document.getElementById("colSourcesChips")
};

function persist() {
  save({
    items: state.items,
    collections: state.collections,
    lang: state.lang,
    sortBy: state.sortBy
  });
}

function normalizeState(raw) {
  state.lang = raw?.lang === "en" ? "en" : "ru";
  state.sortBy = typeof raw?.sortBy === "string" ? raw.sortBy : "newest";

  state.items = Array.isArray(raw?.items) ? raw.items.map((it) => ({
    id: String(it.id || uid("item")),
    url: String(it.url || ""),
    title: String(it.title || ""),
    previewImage: String(it.previewImage || ""),
    tags: Array.isArray(it.tags) ? it.tags.map((x) => String(x)) : [],
    type: String(it.type || "project"),
    source: String(it.source || "site"),
    note: String(it.note || ""),
    favorite: !!it.favorite,
    createdAt: Number(it.createdAt || Date.now()),
    collections: Array.isArray(it.collections) ? [...new Set(it.collections.map((x) => String(x)))] : []
  })).filter((it) => it.url) : [];

  state.collections = Array.isArray(raw?.collections) ? raw.collections.map((c) => ({
    id: String(c.id || uid("col")),
    name: String(c.name || "Collection"),
    description: String(c.description || ""),
    manual: true,
    rulesEnabled: !!c.rulesEnabled,
    rules: {
      types: Array.isArray(c.rules?.types) ? c.rules.types.map((x) => String(x)) : [],
      sources: Array.isArray(c.rules?.sources) ? c.rules.sources.map((x) => String(x)) : [],
      tagsAll: Array.isArray(c.rules?.tagsAll) ? c.rules.tagsAll.map((x) => String(x)) : [],
      tagsAny: Array.isArray(c.rules?.tagsAny) ? c.rules.tagsAny.map((x) => String(x)) : [],
      textContains: String(c.rules?.textContains || ""),
      onlyFavorite: !!c.rules?.onlyFavorite
    }
  })) : [];

  state.activeCollectionId = "all";
  state.search = "";
  state.filters = { types: [], sources: [], tag: "", favoriteOnly: false };
  state.ui = { filtersOpen: false };
}

function updateLangButtons() {
  const L = state.lang;
  els.langRu?.classList.toggle("lang__btn--active", L === "ru");
  els.langEn?.classList.toggle("lang__btn--active", L === "en");
}

function applyI18n() {
  const L = state.lang;

  if (els.brand) els.brand.textContent = t(L, "brand");
  if (els.labelNav) els.labelNav.textContent = t(L, "nav");
  if (els.labelCollections) els.labelCollections.textContent = t(L, "collections");

  if (els.btnAddLink) els.btnAddLink.textContent = t(L, "addLink");
  if (els.btnNewCollection) {
    els.btnNewCollection.textContent = "+";
    els.btnNewCollection.setAttribute("aria-label", t(L, "newCollection"));
    els.btnNewCollection.setAttribute("title", t(L, "newCollection"));
  }
  if (els.btnSettings) els.btnSettings.textContent = t(L, "settings");
  if (els.btnExport) els.btnExport.textContent = t(L, "exportJson");
  if (els.btnImport) els.btnImport.textContent = t(L, "importJson");
  if (els.localHint) els.localHint.textContent = t(L, "localHint");

  if (els.searchInput) els.searchInput.placeholder = t(L, "searchPlaceholder");
  if (els.btnFilters) els.btnFilters.textContent = t(L, "filters");
  if (els.sortSelect) {
    const labels = {
      newest: t(L, "sortNewest"),
      oldest: t(L, "sortOldest"),
      title_asc: t(L, "sortTitleAsc"),
      title_desc: t(L, "sortTitleDesc"),
      source_asc: t(L, "sortSource")
    };
    for (const opt of els.sortSelect.options) {
      opt.textContent = labels[opt.value] || opt.value;
    }
  }

  if (els.labelFilterTypes) els.labelFilterTypes.textContent = t(L, "filterTypes");
  if (els.labelFilterSources) els.labelFilterSources.textContent = t(L, "filterSources");
  if (els.labelFilterTag) els.labelFilterTag.textContent = t(L, "filterTag");
  if (els.labelFilterFavorite) els.labelFilterFavorite.textContent = t(L, "filterFavoriteOnly");

  if (els.modalAddTitle) els.modalAddTitle.textContent = t(L, "modalAddTitle");
  if (els.labelAddUrl) els.labelAddUrl.textContent = t(L, "modalUrl");
  if (els.labelAddTitle) els.labelAddTitle.textContent = t(L, "modalTitle");
  if (els.labelAddTags) els.labelAddTags.textContent = t(L, "modalTags");
  if (els.labelAddType) els.labelAddType.textContent = t(L, "modalType");
  if (els.labelAddSource) els.labelAddSource.textContent = t(L, "modalSource");
  if (els.labelAddNote) els.labelAddNote.textContent = t(L, "modalNote");
  if (els.labelAddTo) els.labelAddTo.textContent = t(L, "addTo");
  if (els.labelAddFavorite) els.labelAddFavorite.textContent = t(L, "markFavorite");
  if (els.sectionAddClassify) els.sectionAddClassify.textContent = t(L, "filters");
  if (els.inputAddTitle) els.inputAddTitle.placeholder = t(L, "modalTitleHint");
  if (els.addCancel) els.addCancel.textContent = t(L, "cancel");
  if (els.addSave) els.addSave.textContent = t(L, "save");

  if (els.modalCollectionTitle) els.modalCollectionTitle.textContent = t(L, "modalCollectionTitle");
  if (els.labelColName) els.labelColName.textContent = t(L, "name");
  if (els.labelColDescription) els.labelColDescription.textContent = t(L, "description");
  if (els.labelRulesEnabled) els.labelRulesEnabled.textContent = t(L, "rulesEnabled");
  if (els.sectionColRules) els.sectionColRules.textContent = t(L, "rulesTitle");
  if (els.labelColTypes) els.labelColTypes.textContent = t(L, "types");
  if (els.labelColSources) els.labelColSources.textContent = t(L, "sources");
  if (els.labelColAllTags) els.labelColAllTags.textContent = t(L, "allTags");
  if (els.labelColAnyTags) els.labelColAnyTags.textContent = t(L, "anyTags");
  if (els.labelColQuery) els.labelColQuery.textContent = t(L, "contains");
  if (els.labelColFavOnly) els.labelColFavOnly.textContent = t(L, "favOnly");
  if (els.colCancel) els.colCancel.textContent = t(L, "cancel");
  if (els.colCreate) els.colCreate.textContent = t(L, "create");

  renderFilterChips();
  renderCollectionRuleChips();
  renderAddCollectionChoices();
}

function renderFilterChips() {
  if (els.filterTypes) {
    els.filterTypes.innerHTML = TYPE_OPTIONS.map((v) => chipCheckHtml("filterType", v, t(state.lang, `type_${v}`))).join("");
  }
  if (els.filterSources) {
    els.filterSources.innerHTML = SOURCE_OPTIONS.map((v) => chipCheckHtml("filterSource", v, t(state.lang, `source_${v}`))).join("");
  }

  els.filterTypes?.querySelectorAll("input").forEach((x) => {
    x.checked = state.filters.types.includes(x.value);
    x.addEventListener("change", () => {
      state.filters.types = [...els.filterTypes.querySelectorAll("input:checked")].map((el) => el.value);
      render(state, els, persist);
    });
  });

  els.filterSources?.querySelectorAll("input").forEach((x) => {
    x.checked = state.filters.sources.includes(x.value);
    x.addEventListener("change", () => {
      state.filters.sources = [...els.filterSources.querySelectorAll("input:checked")].map((el) => el.value);
      render(state, els, persist);
    });
  });
}

function renderCollectionRuleChips() {
  if (els.colTypesChips) {
    els.colTypesChips.innerHTML = TYPE_OPTIONS.map((v) => chipCheckHtml("types", v, t(state.lang, `type_${v}`))).join("");
  }
  if (els.colSourcesChips) {
    els.colSourcesChips.innerHTML = SOURCE_OPTIONS.map((v) => chipCheckHtml("sources", v, t(state.lang, `source_${v}`))).join("");
  }
}

function renderAddCollectionChoices() {
  if (!els.addCollectionsList) return;
  const custom = state.collections;
  const activeId = state.activeCollectionId;

  const inbox = chipCheckHtml("collections", "", t(state.lang, "addToInbox"), activeId === "all" || activeId === "fav");
  const cols = custom.map((c) => chipCheckHtml("collections", c.id, c.name, activeId === c.id)).join("");
  els.addCollectionsList.innerHTML = inbox + cols;
}

function chipCheckHtml(name, value, label, checked = false) {
  return `<label class="chip-check"><input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}/><span>${escapeHtml(label)}</span></label>`;
}

function toggleSettingsMenu(show) {
  if (!els.settingsMenu) return;
  els.settingsMenu.hidden = !show;
}

function updateRulesVisibility() {
  if (!els.collectionRules || !els.rulesEnabled) return;
  els.collectionRules.hidden = !els.rulesEnabled.checked;
}

function setupEvents() {
  els.navAll?.addEventListener("click", () => {
    state.activeCollectionId = "all";
    render(state, els, persist);
  });

  els.navFav?.addEventListener("click", () => {
    state.activeCollectionId = "fav";
    render(state, els, persist);
  });

  els.searchInput?.addEventListener("input", (e) => {
    state.search = String(e.target.value || "");
    render(state, els, persist);
  });

  els.sortSelect?.addEventListener("change", (e) => {
    state.sortBy = String(e.target.value || "newest");
    persist();
    render(state, els, persist);
  });

  els.btnFilters?.addEventListener("click", () => {
    state.ui.filtersOpen = !state.ui.filtersOpen;
    els.filtersPanel.hidden = !state.ui.filtersOpen;
  });

  els.filterTagInput?.addEventListener("input", (e) => {
    state.filters.tag = String(e.target.value || "").trim().toLowerCase();
    render(state, els, persist);
  });

  els.filterFavoriteOnly?.addEventListener("change", (e) => {
    state.filters.favoriteOnly = !!e.target.checked;
    render(state, els, persist);
  });

  els.langRu?.addEventListener("click", () => {
    state.lang = "ru";
    persist();
    applyI18n();
    updateLangButtons();
    render(state, els, persist);
  });

  els.langEn?.addEventListener("click", () => {
    state.lang = "en";
    persist();
    applyI18n();
    updateLangButtons();
    render(state, els, persist);
  });

  els.btnSettings?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettingsMenu(els.settingsMenu.hidden);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".settings")) toggleSettingsMenu(false);
  });

  els.btnAddLink?.addEventListener("click", () => {
    els.formAddLink?.reset();
    renderAddCollectionChoices();
    if (els.addFavorite) els.addFavorite.checked = state.activeCollectionId === "fav";
    els.modalAddLink?.showModal();
  });

  els.formAddLink?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.formAddLink);

    const url = String(fd.get("url") || "").trim();
    const titleRaw = String(fd.get("title") || "").trim();
    const tags = normalizeTags(fd.get("tags"));
    const type = String(fd.get("type") || "project");
    const sourcePick = String(fd.get("source") || "site");
    const note = String(fd.get("note") || "").trim();
    const favorite = !!fd.get("favorite");

    const selectedCollections = fd.getAll("collections").map((x) => String(x)).filter(Boolean);

    try {
      new URL(url);
    } catch {
      alert("Bad URL");
      return;
    }

    const domain = domainFromUrl(url);
    const source = sourcePick === "site" ? detectSource(url) : sourcePick;

    const itemId = uid("item");
    const fallbackPreview = previewFallbackUrl(url);
    const initialTitle = titleRaw || domain || url;

    state.items.push({
      id: itemId,
      url,
      title: initialTitle,
      previewImage: fallbackPreview,
      tags,
      type,
      source,
      note,
      favorite,
      createdAt: Date.now(),
      collections: selectedCollections
    });

    persist();
    els.modalAddLink?.close();
    render(state, els, persist);

    void (async () => {
      const [fetchedTitle, fetchedPreview] = await Promise.allSettled([
        titleRaw ? Promise.resolve("") : tryFetchTitle(url),
        tryFetchPreview(url)
      ]);

      const item = state.items.find((x) => x.id === itemId);
      if (!item) return;

      let changed = false;
      const bestTitle = fetchedTitle.status === "fulfilled" ? String(fetchedTitle.value || "").trim() : "";
      if (!titleRaw && bestTitle && bestTitle !== item.title) {
        item.title = bestTitle;
        changed = true;
      }

      const bestPreview = fetchedPreview.status === "fulfilled" ? String(fetchedPreview.value || "").trim() : "";
      if (bestPreview && bestPreview !== item.previewImage) {
        item.previewImage = bestPreview;
        changed = true;
      }

      if (changed) {
        persist();
        render(state, els, persist);
      }
    })();
  });

  els.btnNewCollection?.addEventListener("click", () => {
    els.formCollection?.reset();
    updateRulesVisibility();
    els.modalCollection?.showModal();
  });

  els.rulesEnabled?.addEventListener("change", updateRulesVisibility);

  els.formCollection?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.formCollection);

    const name = String(fd.get("name") || "").trim();
    if (!name) return;

    const description = String(fd.get("description") || "").trim();
    const rulesEnabled = !!fd.get("rulesEnabled");

    const types = fd.getAll("types").map((x) => String(x));
    const sources = fd.getAll("sources").map((x) => String(x));
    const tagsAll = normalizeTags(fd.get("allTags"));
    const tagsAny = normalizeTags(fd.get("anyTags"));
    const textContains = String(fd.get("query") || "").trim();
    const onlyFavorite = !!fd.get("favoriteOnly");

    const id = uid("col");
    state.collections.push({
      id,
      name,
      description,
      manual: true,
      rulesEnabled,
      rules: {
        types,
        sources,
        tagsAll,
        tagsAny,
        textContains,
        onlyFavorite
      }
    });

    state.activeCollectionId = id;
    persist();
    els.modalCollection?.close();
    render(state, els, persist);
  });

  els.btnExport?.addEventListener("click", () => {
    const payload = {
      version: 3,
      items: state.items,
      collections: state.collections,
      lang: state.lang,
      sortBy: state.sortBy
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vault_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  els.btnImport?.addEventListener("click", () => {
    els.fileImport.value = "";
    els.fileImport.click();
  });

  els.fileImport?.addEventListener("change", async () => {
    const file = els.fileImport.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      normalizeState(json);
      persist();
      applyI18n();
      updateLangButtons();
      render(state, els, persist);
    } catch {
      alert("Failed to import JSON");
    }
  });

  els.addCloseX?.addEventListener("click", () => els.modalAddLink?.close());
  els.addCancel?.addEventListener("click", () => els.modalAddLink?.close());
  els.colCloseX?.addEventListener("click", () => els.modalCollection?.close());
  els.colCancel?.addEventListener("click", () => els.modalCollection?.close());
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const saved = load();
normalizeState(saved || {});
setupEvents();
applyI18n();
updateLangButtons();
if (els.sortSelect) els.sortSelect.value = state.sortBy || "newest";
if (els.filterTagInput) els.filterTagInput.value = state.filters.tag || "";
if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
updateRulesVisibility();
render(state, els, persist);
