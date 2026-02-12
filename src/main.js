import "./styles.css";
import { state, uid } from "./state.js";
import { load, save } from "./storage.js";
import { normalizeTags, detectSource, domainFromUrl, tryFetchTitle, tryFetchPreview, previewFallbackUrl } from "./filter.js";
import { render } from "./ui.js";
import { t } from "./i18n.js";

const els = {
  langRu: document.getElementById("langRu"),
  langEn: document.getElementById("langEn"),
  brand: document.getElementById("brand"),
  collectionsList: document.getElementById("collectionsList"),
  grid: document.getElementById("grid"),
  chips: document.getElementById("chips"),
  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  searchInput: document.getElementById("searchInput"),
  btnAddLink: document.getElementById("btnAddLink"),
  btnNewCollection: document.getElementById("btnNewCollection"),
  btnExport: document.getElementById("btnExport"),
  btnImport: document.getElementById("btnImport"),
  fileImport: document.getElementById("fileImport"),
  localHint: document.getElementById("localHint"),
  modalAddLink: document.getElementById("modalAddLink"),
  modalCollection: document.getElementById("modalCollection"),
  formAddLink: document.getElementById("formAddLink"),
  formCollection: document.getElementById("formCollection"),
  addCloseX: document.getElementById("addCloseX"),
  addCancel: document.getElementById("addCancel"),
  addSave: document.getElementById("addSave"),
  colCloseX: document.getElementById("colCloseX"),
  colCancel: document.getElementById("colCancel"),
  colCreate: document.getElementById("colCreate"),
  modalAddTitle: document.getElementById("modalAddTitle"),
  labelAddUrl: document.getElementById("labelAddUrl"),
  labelAddTitle: document.getElementById("labelAddTitle"),
  labelAddTags: document.getElementById("labelAddTags"),
  labelAddType: document.getElementById("labelAddType"),
  labelAddSource: document.getElementById("labelAddSource"),
  labelAddNote: document.getElementById("labelAddNote"),
  inputAddTitle: document.getElementById("inputAddTitle"),
  inputAddTags: document.getElementById("inputAddTags"),
  inputAddNote: document.getElementById("inputAddNote"),
  modalCollectionTitle: document.getElementById("modalCollectionTitle"),
  labelColName: document.getElementById("labelColName"),
  labelColTypes: document.getElementById("labelColTypes"),
  labelColTypesHint: document.getElementById("labelColTypesHint"),
  labelColSources: document.getElementById("labelColSources"),
  labelColSourcesHint: document.getElementById("labelColSourcesHint"),
  labelColAllTags: document.getElementById("labelColAllTags"),
  labelColAnyTags: document.getElementById("labelColAnyTags"),
  labelColQuery: document.getElementById("labelColQuery"),
  labelColFavOnly: document.getElementById("labelColFavOnly"),
  inputColAllTags: document.getElementById("inputColAllTags"),
  inputColAnyTags: document.getElementById("inputColAnyTags"),
  inputColQuery: document.getElementById("inputColQuery")
};

function persist() {
  save({
    items: state.items,
    collections: state.collections,
    lang: state.lang
  });
}

function updateLangButtons() {
  const L = state.lang || "ru";
  els.langRu?.classList.toggle("lang__btn--active", L === "ru");
  els.langEn?.classList.toggle("lang__btn--active", L === "en");
}

function applyI18n() {
  const L = state.lang || "ru";

  const all = state.collections?.find((c) => c.id === "all");
  const fav = state.collections?.find((c) => c.id === "fav");
  if (all) all.name = t(L, "all");
  if (fav) fav.name = t(L, "favorites");

  if (els.brand) els.brand.textContent = t(L, "brand");
  if (els.btnAddLink) els.btnAddLink.textContent = t(L, "addLink");
  if (els.btnNewCollection) els.btnNewCollection.textContent = t(L, "newCollection");
  if (els.btnExport) els.btnExport.textContent = t(L, "exportJson");
  if (els.btnImport) els.btnImport.textContent = t(L, "importJson");
  if (els.localHint) els.localHint.textContent = t(L, "localHint");
  if (els.searchInput) els.searchInput.placeholder = t(L, "searchPlaceholder");

  if (els.modalAddTitle) els.modalAddTitle.textContent = t(L, "modalAddTitle");
  if (els.labelAddUrl) els.labelAddUrl.textContent = t(L, "modalUrl");
  if (els.labelAddTitle) els.labelAddTitle.textContent = t(L, "modalTitle");
  if (els.labelAddTags) els.labelAddTags.textContent = t(L, "modalTags");
  if (els.labelAddType) els.labelAddType.textContent = t(L, "modalType");
  if (els.labelAddSource) els.labelAddSource.textContent = t(L, "modalSource");
  if (els.labelAddNote) els.labelAddNote.textContent = t(L, "modalNote");
  if (els.inputAddTitle) els.inputAddTitle.placeholder = t(L, "modalTitleHint");
  if (els.inputAddTags) els.inputAddTags.placeholder = L === "ru" ? "тёмный, fintech, landing" : "dark, fintech, landing";
  if (els.inputAddNote) els.inputAddNote.placeholder = L === "ru" ? "Почему сохраняем?" : "Why saved?";
  if (els.addCancel) els.addCancel.textContent = t(L, "cancel");
  if (els.addSave) els.addSave.textContent = t(L, "save");

  if (els.modalCollectionTitle) els.modalCollectionTitle.textContent = t(L, "modalNewColTitle");
  if (els.labelColName) els.labelColName.textContent = t(L, "name");
  if (els.labelColTypes) els.labelColTypes.textContent = t(L, "types");
  if (els.labelColTypesHint) els.labelColTypesHint.textContent = L === "ru" ? "Ctrl/Shift для выбора" : "Ctrl/Shift to select";
  if (els.labelColSources) els.labelColSources.textContent = t(L, "sources");
  if (els.labelColSourcesHint) els.labelColSourcesHint.textContent = L === "ru" ? "Ctrl/Shift для выбора" : "Ctrl/Shift to select";
  if (els.labelColAllTags) els.labelColAllTags.textContent = t(L, "allTags");
  if (els.labelColAnyTags) els.labelColAnyTags.textContent = t(L, "anyTags");
  if (els.labelColQuery) els.labelColQuery.textContent = t(L, "contains");
  if (els.labelColFavOnly) els.labelColFavOnly.textContent = t(L, "favOnly");
  if (els.inputColAllTags) els.inputColAllTags.placeholder = L === "ru" ? "тёмный, fintech" : "dark, fintech";
  if (els.inputColAnyTags) els.inputColAnyTags.placeholder = L === "ru" ? "landing, typography" : "landing, typography";
  if (els.inputColQuery) els.inputColQuery.placeholder = L === "ru" ? "например: saas, serif, motion" : "e.g. saas, serif, motion";
  if (els.colCancel) els.colCancel.textContent = t(L, "cancel");
  if (els.colCreate) els.colCreate.textContent = t(L, "create");
}

const saved = load();

state.items = Array.isArray(state.items) ? state.items : [];
state.collections = Array.isArray(state.collections) ? state.collections : [];

if (saved?.lang) state.lang = saved.lang;
if (Array.isArray(saved?.items)) state.items = saved.items;
if (Array.isArray(saved?.collections)) state.collections = saved.collections;

if (!state.collections.find((c) => c.id === "all")) {
  state.collections.unshift({ id: "all", name: "All", rules: {} });
}
if (!state.collections.find((c) => c.id === "fav")) {
  state.collections.push({ id: "fav", name: "Favorites", rules: { favoriteOnly: true } });
}

els.searchInput?.addEventListener("input", (e) => {
  state.search = e.target.value || "";
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

if (els.btnAddLink && els.formAddLink && els.modalAddLink) {
  els.btnAddLink.addEventListener("click", () => {
    els.formAddLink.reset();
    els.modalAddLink.showModal();
  });

  els.formAddLink.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(els.formAddLink);

    const url = String(fd.get("url") || "").trim();
    const titleRaw = String(fd.get("title") || "").trim();
    const tags = normalizeTags(fd.get("tags"));
    const type = String(fd.get("type") || "project");
    const sourcePick = String(fd.get("source") || "site");
    const note = String(fd.get("note") || "").trim();

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
      favorite: false,
      createdAt: Date.now()
    });

    persist();
    els.modalAddLink.close();
    render(state, els, persist);

    // Metadata enrichment in background: keeps UI snappy on slow networks.
    void (async () => {
      const [fetchedTitle, fetchedPreview] = await Promise.allSettled([
        titleRaw ? Promise.resolve("") : tryFetchTitle(url),
        tryFetchPreview(url),
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
}

if (els.btnNewCollection && els.formCollection && els.modalCollection) {
  els.btnNewCollection.addEventListener("click", () => {
    els.formCollection.reset();
    els.modalCollection.showModal();
  });

  els.formCollection.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(els.formCollection);

    const name = String(fd.get("name") || "").trim();
    if (!name) return;

    const typesSel = [...els.formCollection.elements.types.selectedOptions].map((o) => o.value);
    const sourcesSel = [...els.formCollection.elements.sources.selectedOptions].map((o) => o.value);

    const allTags = normalizeTags(fd.get("allTags"));
    const anyTags = normalizeTags(fd.get("anyTags"));
    const query = String(fd.get("query") || "").trim();
    const favoriteOnly = !!fd.get("favoriteOnly");

    state.collections.push({
      id: uid("col"),
      name,
      rules: {
        types: typesSel.length ? typesSel : undefined,
        sources: sourcesSel.length ? sourcesSel : undefined,
        allTags: allTags.length ? allTags : undefined,
        anyTags: anyTags.length ? anyTags : undefined,
        query: query || undefined,
        favoriteOnly: favoriteOnly || undefined
      }
    });

    persist();
    els.modalCollection.close();
    render(state, els, persist);
  });
}

els.btnExport?.addEventListener("click", () => {
  const payload = {
    version: 2,
    items: state.items,
    collections: state.collections,
    lang: state.lang
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `vault_export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

if (els.btnImport && els.fileImport) {
  els.btnImport.addEventListener("click", () => {
    els.fileImport.value = "";
    els.fileImport.click();
  });

  els.fileImport.addEventListener("change", async () => {
    const file = els.fileImport.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      if (!Array.isArray(json.items) || !Array.isArray(json.collections)) {
        alert("Invalid file format");
        return;
      }

      if (json.lang === "ru" || json.lang === "en") state.lang = json.lang;

      const byItemId = new Set(state.items.map((x) => x.id));
      for (const it of json.items) {
        if (!it?.id || byItemId.has(it.id)) continue;
        state.items.push(it);
        byItemId.add(it.id);
      }

      const byColId = new Set(state.collections.map((x) => x.id));
      for (const c of json.collections) {
        if (!c?.id || byColId.has(c.id)) continue;
        state.collections.push(c);
        byColId.add(c.id);
      }

      if (!state.collections.find((c) => c.id === "all")) {
        state.collections.unshift({ id: "all", name: "All", rules: {} });
      }
      if (!state.collections.find((c) => c.id === "fav")) {
        state.collections.push({ id: "fav", name: "Favorites", rules: { favoriteOnly: true } });
      }

      persist();
      applyI18n();
      updateLangButtons();
      render(state, els, persist);
    } catch {
      alert("Failed to import JSON");
    }
  });
}

function wireModalCloseButtons() {
  els.addCloseX?.addEventListener("click", () => els.modalAddLink?.close());
  els.addCancel?.addEventListener("click", () => els.modalAddLink?.close());
  els.colCloseX?.addEventListener("click", () => els.modalCollection?.close());
  els.colCancel?.addEventListener("click", () => els.modalCollection?.close());
}

applyI18n();
updateLangButtons();
render(state, els, persist);
wireModalCloseButtons();
