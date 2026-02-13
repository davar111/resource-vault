import "./styles.css";
import { state, uid } from "./state.js";
import { load, save, migrateToV4 } from "./storage.js";
import {
  normalizeTags,
  normalizeSearchText,
  detectSource,
  domainFromUrl,
  tryFetchTitle,
  tryFetchPreview,
  previewFallbackUrl
} from "./filter.js";
import { render } from "./ui.js";
import { t } from "./i18n.js";

const TYPE_OPTIONS = ["Project", "Studio", "Designer", "Inspiration", "Source"];
const SOURCE_OPTIONS = ["Site", "Behance", "Awwwards", "Pinterest", "Dribbble", "Other"];

const els = {
  langRu: document.getElementById("langRu"),
  langEn: document.getElementById("langEn"),
  brand: document.getElementById("brand"),

  navAll: document.getElementById("navAll"),
  navFav: document.getElementById("navFav"),
  labelNav: document.getElementById("labelNav"),
  labelCollections: document.getElementById("labelCollections"),
  collectionsList: document.getElementById("collectionsList"),
  sidebar: document.getElementById("sidebar"),
  btnMobileMenu: document.getElementById("btnMobileMenu"),
  btnMobileClose: document.getElementById("btnMobileClose"),
  mobileOverlay: document.getElementById("mobileOverlay"),

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
  inputAddUrl: document.querySelector('#formAddLink input[name="url"]'),
  inputAddTags: document.getElementById("inputAddTags"),
  inputAddNote: document.getElementById("inputAddNote"),
  inputAddSource: document.getElementById("inputAddSource"),
  addSourceField: document.getElementById("addSourceField"),
  addSourceAuto: document.getElementById("addSourceAuto"),
  addCollectionsList: document.getElementById("addCollectionsList"),
  addFavorite: document.getElementById("addFavorite"),
  addTagsSuggestions: document.getElementById("addTagsSuggestions"),

  modalCollection: document.getElementById("modalCollection"),
  formCollection: document.getElementById("formCollection"),
  colCloseX: document.getElementById("colCloseX"),
  colCancel: document.getElementById("colCancel"),
  colCreate: document.getElementById("colCreate"),
  modalCollectionTitle: document.getElementById("modalCollectionTitle"),
  labelColName: document.getElementById("labelColName"),
  labelColDescription: document.getElementById("labelColDescription"),
  labelCollectionKind: document.getElementById("labelCollectionKind"),
  labelKindManual: document.getElementById("labelKindManual"),
  labelKindSmart: document.getElementById("labelKindSmart"),
  smartHint: document.getElementById("smartHint"),
  sectionColRules: document.getElementById("sectionColRules"),
  labelColTypes: document.getElementById("labelColTypes"),
  labelColSources: document.getElementById("labelColSources"),
  labelColAllTags: document.getElementById("labelColAllTags"),
  labelColAnyTags: document.getElementById("labelColAnyTags"),
  labelColQuery: document.getElementById("labelColQuery"),
  labelColFavOnly: document.getElementById("labelColFavOnly"),
  kindManual: document.getElementById("kindManual"),
  kindSmart: document.getElementById("kindSmart"),
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
  const data = migrateToV4(raw || {});

  state.lang = data?.lang === "en" ? "en" : "ru";
  state.sortBy = typeof data?.sortBy === "string" ? data.sortBy : "newest";

  state.items = Array.isArray(data?.items) ? data.items.map(normalizeLink) : [];
  state.collections = Array.isArray(data?.collections) ? data.collections.map(normalizeCollection) : [];

  state.activeCollectionId = "all";
  state.search = "";
  state.filters = { types: [], sources: [], tag: "", favoriteOnly: false };
  state.ui = { filtersOpen: false, mobileMenuOpen: false };
}

function normalizeLink(item) {
  const now = Date.now();
  const createdAt = Number(item?.createdAt || now);
  return {
    id: String(item?.id || uid("item")),
    url: String(item?.url || ""),
    title: String(item?.title || ""),
    previewImage: String(item?.previewImage || ""),
    tags: normalizeTags(item?.tags || []),
    type: normalizeType(item?.type),
    source: normalizeSource(item?.source),
    note: String(item?.note || ""),
    favorite: !!item?.favorite,
    createdAt,
    updatedAt: Number(item?.updatedAt || createdAt),
    collectionIds: Array.isArray(item?.collectionIds) ? [...new Set(item.collectionIds.map((x) => String(x)))] : []
  };
}

function normalizeCollection(col) {
  const now = Date.now();
  const createdAt = Number(col?.createdAt || now);
  const kind = col?.kind === "smart" ? "smart" : "manual";

  return {
    id: String(col?.id || uid("col")),
    name: String(col?.name || "Collection"),
    description: String(col?.description || ""),
    kind,
    rules: kind === "smart" ? normalizeRules(col?.rules) : undefined,
    createdAt,
    updatedAt: Number(col?.updatedAt || createdAt)
  };
}

function normalizeRules(rules) {
  return {
    types: Array.isArray(rules?.types) ? [...new Set(rules.types.map(normalizeType).filter(Boolean))] : [],
    sources: Array.isArray(rules?.sources) ? [...new Set(rules.sources.map(normalizeSource).filter(Boolean))] : [],
    requiredTags: normalizeTags(rules?.requiredTags || []),
    anyTags: normalizeTags(rules?.anyTags || []),
    containsText: normalizeSearchText(rules?.containsText || ""),
    onlyFavorites: !!rules?.onlyFavorites
  };
}

function normalizeType(value) {
  const map = {
    project: "Project",
    studio: "Studio",
    designer: "Designer",
    inspiration: "Inspiration",
    source: "Source"
  };
  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim();
  return TYPE_OPTIONS.includes(normalized) ? normalized : null;
}

function normalizeSource(value) {
  const map = {
    site: "Site",
    behance: "Behance",
    awwwards: "Awwwards",
    pinterest: "Pinterest",
    dribbble: "Dribbble",
    other: "Other"
  };
  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim();
  return SOURCE_OPTIONS.includes(normalized) ? normalized : null;
}

function updateLangButtons() {
  const L = state.lang;
  els.langRu?.classList.toggle("lang__btn--active", L === "ru");
  els.langEn?.classList.toggle("lang__btn--active", L === "en");
}

function optionKey(value) {
  return String(value || "").toLowerCase();
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
    for (const opt of els.sortSelect.options) opt.textContent = labels[opt.value] || opt.value;
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
  if (els.labelCollectionKind) els.labelCollectionKind.textContent = t(L, "collectionKind");
  if (els.labelKindManual) els.labelKindManual.textContent = t(L, "kindManual");
  if (els.labelKindSmart) els.labelKindSmart.textContent = t(L, "kindSmart");
  if (els.smartHint) els.smartHint.textContent = t(L, "smartHint");
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
  renderTagSuggestions();
  renderSelectLabels();
  updateAddSourceUi();
}

function renderSelectLabels() {
  const typeSelect = els.formAddLink?.querySelector('select[name="type"]');
  const sourceSelect = els.formAddLink?.querySelector('select[name="source"]');

  if (typeSelect) {
    for (const option of typeSelect.options) {
      if (option.value === "") option.textContent = t(state.lang, "anyOption");
      else option.textContent = t(state.lang, `type_${optionKey(option.value)}`);
    }
  }

  if (sourceSelect) {
    for (const option of sourceSelect.options) {
      option.textContent = t(state.lang, `source_${optionKey(option.value)}`);
    }
  }
}

function getDetectedSourceFromUrl(rawUrl) {
  try {
    new URL(String(rawUrl || "").trim());
  } catch {
    return null;
  }
  const detected = detectSource(rawUrl);
  return detected === "Site" ? null : detected;
}

function updateAddSourceUi() {
  const detected = getDetectedSourceFromUrl(els.inputAddUrl?.value || "");
  const L = state.lang || "ru";

  if (detected) {
    if (els.addSourceField) els.addSourceField.hidden = true;
    if (els.inputAddSource) els.inputAddSource.disabled = true;
    if (els.inputAddSource) els.inputAddSource.value = detected;
    if (els.addSourceAuto) {
      els.addSourceAuto.hidden = false;
      els.addSourceAuto.textContent = `${t(L, "sourceAutoDetected")}: ${t(L, `source_${optionKey(detected)}`)}`;
    }
    return;
  }

  if (els.addSourceField) els.addSourceField.hidden = false;
  if (els.inputAddSource) {
    els.inputAddSource.disabled = false;
    if (!els.inputAddSource.value) els.inputAddSource.value = "Other";
  }
  if (els.addSourceAuto) {
    els.addSourceAuto.hidden = false;
    els.addSourceAuto.textContent = t(L, "sourceManualPrompt");
  }
}

function renderFilterChips() {
  if (els.filterTypes) {
    els.filterTypes.innerHTML = TYPE_OPTIONS.map((v) => chipCheckHtml("filterType", v, t(state.lang, `type_${optionKey(v)}`))).join("");
  }
  if (els.filterSources) {
    els.filterSources.innerHTML = SOURCE_OPTIONS.map((v) => chipCheckHtml("filterSource", v, t(state.lang, `source_${optionKey(v)}`))).join("");
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
    els.colTypesChips.innerHTML = TYPE_OPTIONS.map((v) => chipCheckHtml("types", v, t(state.lang, `type_${optionKey(v)}`))).join("");
  }
  if (els.colSourcesChips) {
    els.colSourcesChips.innerHTML = SOURCE_OPTIONS.map((v) => chipCheckHtml("sources", v, t(state.lang, `source_${optionKey(v)}`))).join("");
  }
}

function renderAddCollectionChoices() {
  if (!els.addCollectionsList) return;
  const manualCollections = state.collections.filter((col) => col.kind === "manual");
  const activeId = state.activeCollectionId;

  const chips = manualCollections.map((col) =>
    chipCheckHtml("collections", col.id, col.name, activeId === col.id && col.kind === "manual")
  );

  els.addCollectionsList.innerHTML = chips.join("");
}

function renderTagSuggestions() {
  if (!els.addTagsSuggestions) return;
  const tags = [...new Set(state.items.flatMap((item) => normalizeTags(item.tags || [])))].sort((a, b) => a.localeCompare(b, state.lang));
  els.addTagsSuggestions.innerHTML = tags.map((tag) => `<option value="${escapeHtml(tag)}"></option>`).join("");
}

function chipCheckHtml(name, value, label, checked = false) {
  return `<label class="chip-check"><input type="checkbox" name="${name}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}/><span>${escapeHtml(label)}</span></label>`;
}

function toggleSettingsMenu(show) {
  if (!els.settingsMenu) return;
  els.settingsMenu.hidden = !show;
}

function updateRulesVisibility() {
  if (!els.collectionRules) return;
  const kind = els.kindSmart?.checked ? "smart" : "manual";
  els.collectionRules.hidden = kind !== "smart";
}

function setupEvents() {
  const mobileMq = window.matchMedia("(max-width: 700px)");

  function setMobileMenu(open) {
    state.ui.mobileMenuOpen = !!open;
    document.body.classList.toggle("mobile-menu-open", !!open);
    els.btnMobileMenu?.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closeMobileMenuIfNeeded() {
    if (!mobileMq.matches) return;
    setMobileMenu(false);
  }

  els.navAll?.addEventListener("click", () => {
    state.activeCollectionId = "all";
    render(state, els, persist);
    closeMobileMenuIfNeeded();
  });

  els.navFav?.addEventListener("click", () => {
    state.activeCollectionId = "fav";
    render(state, els, persist);
    closeMobileMenuIfNeeded();
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
    state.filters.tag = normalizeSearchText(e.target.value);
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

  els.btnMobileMenu?.addEventListener("click", () => {
    if (!mobileMq.matches) return;
    setMobileMenu(!state.ui.mobileMenuOpen);
  });

  els.btnMobileClose?.addEventListener("click", () => setMobileMenu(false));
  els.mobileOverlay?.addEventListener("click", () => setMobileMenu(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMobileMenu(false);
  });

  els.sidebar?.addEventListener("click", (e) => {
    const actionable = e.target.closest("#navAll, #navFav, .collection, #btnAddLink, #btnNewCollection");
    if (!actionable) return;
    closeMobileMenuIfNeeded();
  });

  mobileMq.addEventListener("change", (ev) => {
    if (!ev.matches) setMobileMenu(false);
  });

  els.btnAddLink?.addEventListener("click", () => {
    els.formAddLink?.reset();
    renderAddCollectionChoices();
    renderTagSuggestions();
    if (els.inputAddSource) els.inputAddSource.value = "Other";
    updateAddSourceUi();
    if (els.addFavorite) els.addFavorite.checked = state.activeCollectionId === "fav";
    els.modalAddLink?.showModal();
    closeMobileMenuIfNeeded();
  });

  els.inputAddUrl?.addEventListener("input", updateAddSourceUi);

  els.formAddLink?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.formAddLink);

    const url = String(fd.get("url") || "").trim();
    const titleRaw = String(fd.get("title") || "").trim();
    const tags = normalizeTags(fd.get("tags"));
    const type = normalizeType(fd.get("type"));
    const sourcePick = normalizeSource(fd.get("source"));
    const note = String(fd.get("note") || "").trim();
    const favorite = !!fd.get("favorite");

    const manualCollectionIds = new Set(state.collections.filter((col) => col.kind === "manual").map((col) => col.id));
    const selectedCollections = fd.getAll("collections")
      .map((x) => String(x))
      .filter((id) => manualCollectionIds.has(id));

    try {
      new URL(url);
    } catch {
      alert("Bad URL");
      return;
    }

    const domain = domainFromUrl(url);
    const source = getDetectedSourceFromUrl(url) || sourcePick || "Other";
    const now = Date.now();
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
      createdAt: now,
      updatedAt: now,
      collectionIds: selectedCollections
    });

    persist();
    els.modalAddLink?.close();
    renderTagSuggestions();
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
        item.updatedAt = Date.now();
        persist();
        render(state, els, persist);
      }
    })();
  });

  els.btnNewCollection?.addEventListener("click", () => {
    els.formCollection?.reset();
    if (els.kindManual) els.kindManual.checked = true;
    updateRulesVisibility();
    els.modalCollection?.showModal();
    closeMobileMenuIfNeeded();
  });

  els.kindManual?.addEventListener("change", updateRulesVisibility);
  els.kindSmart?.addEventListener("change", updateRulesVisibility);

  els.formCollection?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.formCollection);

    const name = String(fd.get("name") || "").trim();
    if (!name) return;

    const description = String(fd.get("description") || "").trim();
    const kind = fd.get("kind") === "smart" ? "smart" : "manual";
    const now = Date.now();
    const id = uid("col");

    const nextCollection = {
      id,
      name,
      description,
      kind,
      rules: kind === "smart" ? {
        types: fd.getAll("types").map(normalizeType).filter(Boolean),
        sources: fd.getAll("sources").map(normalizeSource).filter(Boolean),
        requiredTags: normalizeTags(fd.get("requiredTags")),
        anyTags: normalizeTags(fd.get("anyTags")),
        containsText: normalizeSearchText(fd.get("containsText")),
        onlyFavorites: !!fd.get("onlyFavorites")
      } : undefined,
      createdAt: now,
      updatedAt: now
    };

    state.collections.push(nextCollection);
    state.activeCollectionId = id;
    persist();
    els.modalCollection?.close();
    renderAddCollectionChoices();
    render(state, els, persist);
  });

  els.btnExport?.addEventListener("click", () => {
    const payload = {
      version: 4,
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
els.btnMobileMenu?.setAttribute("aria-expanded", "false");
if (els.sortSelect) els.sortSelect.value = state.sortBy || "newest";
if (els.filterTagInput) els.filterTagInput.value = state.filters.tag || "";
if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
updateRulesVisibility();
render(state, els, persist);
