import "./styles.css";
import "./styles/monoFeedback.css";
import { state } from "./state.js";
import { loadLegacyVault, loadUiSettings, saveUiSettings } from "./storage.js";
import { TAG_MAX_LEN, TAG_MIN_LEN, detectSourceFromUrl, domainFromUrl, normalizeSearchText, normalizeTags, previewFallbackUrl, toHttpUrl, tryFetchPreview, tryFetchTitle } from "./filter.js";
import { t } from "./i18n.js";
import { render } from "./ui.js";
import { flashStatus, startSpinner } from "./ui/monoFeedback.js";
import { promptDialog, toast } from "./ui/feedback.js";
import { showDialogWithA11y } from "./ui/dialogA11y.js";
import { scheduleRender } from "./renderScheduler.js";
import { debounce } from "./utils/debounce.js";
import { SOURCE_CODES, TYPE_CODES } from "./domain.js";
import { makeDemoLinks } from "./demo-data.js";
import { initAuth, loginWithGoogle, logout } from "./useAuth.js";
import { createLink, deleteLink, listLinks, updateLink } from "./useLinks.js";
import { addLinkCollections, createCollection, createCollectionInvite, deleteCollection, listCollections, listLinkCollections, replaceLinkCollections, updateCollection } from "./useCollections.js";
import { createSavedFilter, deleteSavedFilter, listSavedFilters } from "./useSavedFilters.js";
import { getSpaceStats, upsertSpaceStats } from "./useSpaceStats.js";
import { getAuthIssue, getSessionAccessToken } from "./supabase.js";
import { initOnboarding } from "./Onboarding.js";

const TITLE_MIN_LEN = 2;
const TITLE_MAX_LEN = 120;
const NOTE_MAX_LEN = 500;
const FILTER_SORTS = new Set(["newest", "oldest", "title_asc", "title_desc", "source_asc"]);
const THEME_MODES = new Set(["system", "light", "dark"]);
const HIDDEN_PASSWORD_KEY = "resource_vault_hidden_password_v1";
const DEMO_PREFS_KEY = "resource_vault_demo_prefs_v1";
const ENABLE_AI_ONBOARDING = true;

const els = {
  langSelect: document.getElementById("langSelect"),
  btnTheme: document.getElementById("btnTheme"),
  appRoot: document.getElementById("appRoot"),
  authGate: document.getElementById("authGate"),
  authGateBrandName: document.getElementById("authGateBrandName"),
  authGateBrandInline: document.getElementById("authGateBrandInline"),
  authGateShowcaseTitle: document.getElementById("authGateShowcaseTitle"),
  authGateShowcaseText: document.getElementById("authGateShowcaseText"),
  authGateTitle: document.getElementById("authGateTitle"),
  authGateText: document.getElementById("authGateText"),
  authGateBtn: document.getElementById("authGateBtn"),
  authGateBtnLabel: document.getElementById("authGateBtnLabel"),
  authGateGuestBtn: document.getElementById("authGateGuestBtn"),
  brand: document.getElementById("brand"),
  navAll: document.getElementById("navAll"),
  navFav: document.getElementById("navFav"),
  navHidden: document.getElementById("navHidden"),
  navRecent: document.getElementById("navRecent"),
  navSpace: document.getElementById("navSpace"),
  labelNav: document.getElementById("labelNav"),
  labelCollections: document.getElementById("labelCollections"),
  labelSavedFilters: document.getElementById("labelSavedFilters"),
  savedFiltersSection: document.getElementById("savedFiltersSection"),
  collectionsList: document.getElementById("collectionsList"),
  savedFiltersList: document.getElementById("savedFiltersList"),
  sidebar: document.getElementById("sidebar"),
  btnMobileMenu: document.getElementById("btnMobileMenu"),
  btnMobileClose: document.getElementById("btnMobileClose"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  statusLine: document.getElementById("statusLine"),
  searchInput: document.getElementById("searchInput"),
  searchPanel: document.getElementById("searchPanel"),
  searchPanelFilters: document.getElementById("searchPanelFilters"),
  searchPanelResults: document.getElementById("searchPanelResults"),
  searchPanelCount: document.getElementById("searchPanelCount"),
  sortSelect: document.getElementById("sortSelect"),
  btnFilters: document.getElementById("btnFilters"),
  topbarRight: document.getElementById("topbarRight"),
  filtersPanel: document.getElementById("filtersPanel"),
  chipsBar: document.getElementById("chipsBar"),
  activeFilters: document.getElementById("activeFilters"),
  demoHint: document.getElementById("demoHint"),
  demoHintText: document.getElementById("demoHintText"),
  demoHintAdd: document.getElementById("demoHintAdd"),
  liquidLab: document.getElementById("liquidLab"),
  liquidCanvas: document.getElementById("liquidCanvas"),
  liquidFallback: document.getElementById("liquidFallback"),
  liquidFallbackTitle: document.getElementById("liquidFallbackTitle"),
  liquidFallbackText: document.getElementById("liquidFallbackText"),
  spaceView: document.getElementById("spaceView"),
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
  btnAiOnboarding: document.getElementById("btnAiOnboarding"),
  btnNewCollection: document.getElementById("btnNewCollection"),
  btnSaveFilterInline: document.getElementById("btnSaveFilterInline"),
  btnAuth: document.getElementById("btnAuth"),
  btnAuthLabel: document.getElementById("btnAuthLabel"),
  authStatus: document.getElementById("authStatus"),
  localHint: document.getElementById("localHint"),
  modalAddLink: document.getElementById("modalAddLink"),
  formAddLink: document.getElementById("formAddLink"),
  addCloseX: document.getElementById("addCloseX"),
  addCancel: document.getElementById("addCancel"),
  addSave: document.getElementById("addSave"),
  addBack: document.getElementById("addBack"),
  addSkip: document.getElementById("addSkip"),
  addStep1: document.getElementById("addStep1"),
  addStep2: document.getElementById("addStep2"),
  addStep3: document.getElementById("addStep3"),
  addPanelUrl: document.getElementById("addPanelUrl"),
  addPanelDetails: document.getElementById("addPanelDetails"),
  addPanelDone: document.getElementById("addPanelDone"),
  modalAddTitle: document.getElementById("modalAddTitle"),
  labelAddUrl: document.getElementById("labelAddUrl"),
  labelAddTitle: document.getElementById("labelAddTitle"),
  labelAddTags: document.getElementById("labelAddTags"),
  labelAddType: document.getElementById("labelAddType"),
  labelAddSource: document.getElementById("labelAddSource"),
  labelAddNote: document.getElementById("labelAddNote"),
  labelAddTo: document.getElementById("labelAddTo"),
  addToSection: document.getElementById("addToSection"),
  labelAddFavorite: document.getElementById("labelAddFavorite"),
  inputAddUrl: document.querySelector('#formAddLink input[name="url"]'),
  inputAddTitle: document.getElementById("inputAddTitle"),
  inputAddTags: document.getElementById("inputAddTags"),
  inputAddNote: document.getElementById("inputAddNote"),
  inputAddSource: document.getElementById("inputAddSource"),
  addCollectionHidden: document.getElementById("addCollectionHidden"),
  addTagsWrap: document.getElementById("addTagsWrap"),
  addTagInput: document.getElementById("addTagInput"),
  addParsedCard: document.getElementById("addParsedCard"),
  addParsedThumb: document.getElementById("addParsedThumb"),
  addParsedThumbEmoji: document.querySelector("#addParsedThumb .modal-add-flow__parse-thumb-emoji"),
  addParsedShimmer: document.getElementById("addParsedShimmer"),
  addParsedSource: document.getElementById("addParsedSource"),
  addParsedTitle: document.getElementById("addParsedTitle"),
  addParseStatus: document.getElementById("addParseStatus"),
  addParseStatusText: document.getElementById("addParseStatusText"),
  addAutoTags: document.getElementById("addAutoTags"),
  addFavorite: document.getElementById("addFavorite"),
  addCollectionsList: document.getElementById("addCollectionsList"),
  addTagsMenu: document.getElementById("addTagsMenu"),
  modalCollection: document.getElementById("modalCollection"),
  formCollection: document.getElementById("formCollection"),
  colCloseX: document.getElementById("colCloseX"),
  colCancel: document.getElementById("colCancel"),
  colCreate: document.getElementById("colCreate"),
  modalCollectionTitle: document.getElementById("modalCollectionTitle"),
  labelColName: document.getElementById("labelColName"),
  labelColDescription: document.getElementById("labelColDescription"),
  labelColShared: document.getElementById("labelColShared"),
  colShared: document.getElementById("colShared"),
  modalDeleteLink: document.getElementById("modalDeleteLink"),
  modalDeleteTitle: document.getElementById("modalDeleteTitle"),
  modalDeleteText: document.getElementById("modalDeleteText"),
  deleteCancel: document.getElementById("deleteCancel"),
  deleteConfirm: document.getElementById("deleteConfirm"),
  modalHiddenAuth: document.getElementById("modalHiddenAuth"),
  formHiddenAuth: document.getElementById("formHiddenAuth"),
  hiddenAuthTitle: document.getElementById("hiddenAuthTitle"),
  hiddenAuthText: document.getElementById("hiddenAuthText"),
  hiddenAuthPasswordLabel: document.getElementById("hiddenAuthPasswordLabel"),
  hiddenAuthPassword: document.getElementById("hiddenAuthPassword"),
  hiddenAuthConfirmField: document.getElementById("hiddenAuthConfirmField"),
  hiddenAuthConfirmLabel: document.getElementById("hiddenAuthConfirmLabel"),
  hiddenAuthConfirm: document.getElementById("hiddenAuthConfirm"),
  hiddenAuthCancel: document.getElementById("hiddenAuthCancel"),
  hiddenAuthSubmit: document.getElementById("hiddenAuthSubmit"),
  modalOnboarding: document.getElementById("modalOnboarding")
};

const CRITICAL_ELS = ["appRoot", "authGate", "grid", "spaceView", "modalAddLink"];
CRITICAL_ELS.forEach((key) => {
  if (!els[key]) console.warn(`[Vault] Missing critical element: #${key}`);
});

let currentUser = null;
let knownTags = [];
let activeTagMenuIndex = -1;
let sourceAutofillEnabled = true;
let addFlowStep = 1;
let addFlowAutoTags = [];
let addFlowManualTags = [];
let addFlowSelectedCollectionId = "";
let addFlowParseToken = 0;
let prevGateVisible = null;
const pendingLinkOps = new Set();
const pendingCollectionOps = new Set();
const pendingSavedFilterOps = new Set();
const feedback = {
  pageSpinner: null,
  addSpinner: null,
  addFlashCancel: null,
  addCloseTimer: null,
  collectionSpinner: null,
  collectionFlashCancel: null,
  collectionCloseTimer: null,
  savedFilterSpinner: null,
  savedFilterFlashCancel: null
};
let onboardingController = null;
let authIssueNotice = "";
let spaceStatsPersistTimer = null;
let spaceStatsPersistInFlight = false;
let spaceStatsPersistQueued = false;

function notify(text, kind = "info", target = null) {
  return toast(target || els.authStatus, text, { kind, timeoutMs: 1500 });
}

function ensureAuth() {
  if (currentUser?.id) return true;
  notify(t(state.lang, state.isGuestMode ? "authRequiredGuest" : "authRequired"), "error");
  return false;
}

function persistUiSettings() {
  saveUiSettings({
    lang: state.lang,
    sortBy: state.sortBy,
    themeMode: state.themeMode,
    collectionOrderIds: state.ui.collectionOrderIds,
    pinnedCollectionIds: state.ui.pinnedCollectionIds
  });
}

function normalizeCollectionUiSettings() {
  const ids = new Set(state.collections.map((c) => c.id));
  const ordered = [...new Set((state.ui.collectionOrderIds || []).filter((id) => ids.has(id)))];
  const missing = state.collections.map((c) => c.id).filter((id) => !ordered.includes(id));
  state.ui.collectionOrderIds = [...ordered, ...missing];
  state.ui.pinnedCollectionIds = [...new Set((state.ui.pinnedCollectionIds || []).filter((id) => ids.has(id)))];
}

function applyCollectionUiSettings() {
  normalizeCollectionUiSettings();
  const byId = new Map(state.collections.map((c) => [c.id, c]));
  const pinned = new Set(state.ui.pinnedCollectionIds || []);
  const ordered = (state.ui.collectionOrderIds || [])
    .map((id) => byId.get(id))
    .filter(Boolean);

  state.collections = [
    ...ordered.filter((c) => pinned.has(c.id)),
    ...ordered.filter((c) => !pinned.has(c.id))
  ];
}

function syncSaveFilterButton() {
  if (!els.btnSaveFilterInline) return;
  els.btnSaveFilterInline.hidden = !isFilterActive();
}

function syncSavedFiltersSection() {
  if (!els.savedFiltersSection) return;
  const hasSaved = Array.isArray(state.savedFilters) && state.savedFilters.length > 0;
  els.savedFiltersSection.hidden = !state.isAuthenticated || !hasSaved;
}

function syncAuthGate() {
  const showGate = !state.isAuthenticated && !state.isGuestMode;
  const wasGateVisible = prevGateVisible;
  prevGateVisible = showGate;
  if (els.appRoot) els.appRoot.hidden = showGate;
  if (els.authGate) els.authGate.hidden = !showGate;
  if (els.appRoot && wasGateVisible === true && showGate === false) {
    els.appRoot.classList.remove("app--enter");
    // Force reflow so repeated login transitions replay animation.
    void els.appRoot.offsetWidth;
    els.appRoot.classList.add("app--enter");
  }
}

function syncGuestModeUi() {
  const guestReadOnly = !!(state.isGuestMode && !state.isAuthenticated);
  if (els.btnAddLink) els.btnAddLink.disabled = guestReadOnly;
  if (els.btnAiOnboarding) els.btnAiOnboarding.disabled = !ENABLE_AI_ONBOARDING || guestReadOnly;
  if (els.btnNewCollection) els.btnNewCollection.disabled = guestReadOnly;
  if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = guestReadOnly;
  if (els.navHidden) els.navHidden.disabled = guestReadOnly;
  if (els.localHint && guestReadOnly) els.localHint.textContent = t(state.lang, "guestModeHint");
}

function renderApp() {
  persistUiSettings();
  syncSaveFilterButton();
  syncSavedFiltersSection();
  syncAuthGate();
  syncGuestModeUi();
  render(state, els, persistUiSettings, actions);
  syncContentViews();
}

function requestRender() {
  scheduleRender(renderApp);
}

function authEmail(user) {
  return String(user?.email || user?.user_metadata?.email || "").trim();
}

function preferredBrowserTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode) {
  return mode === "system" ? preferredBrowserTheme() : (mode === "light" ? "light" : "dark");
}

function applyTheme(mode) {
  const nextMode = THEME_MODES.has(mode) ? mode : "system";
  const nextTheme = resolveTheme(nextMode);
  state.themeMode = nextMode;
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
}

function syncLanguageSelect() {
  if (!els.langSelect) return;
  els.langSelect.value = state.lang === "en" ? "en" : "ru";
}

function syncThemeToggle() {
  if (!els.btnTheme) return;
  const nextIsDark = state.theme !== "dark";
  const isDark = state.theme === "dark";
  els.btnTheme.innerHTML = isDark
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  els.btnTheme.setAttribute("title", nextIsDark ? t(state.lang, "switchThemeToDark") : t(state.lang, "switchThemeToLight"));
  els.btnTheme.setAttribute("aria-label", nextIsDark ? t(state.lang, "switchThemeToDark") : t(state.lang, "switchThemeToLight"));
}

function renderAuthStatus() {
  const email = authEmail(currentUser);
  if (!email && state.isGuestMode && !state.isAuthenticated) {
    if (els.btnAuthLabel) els.btnAuthLabel.textContent = t(state.lang, "signInGoogle");
    if (els.authStatus) els.authStatus.textContent = authIssueNotice || t(state.lang, "guestModeStatus");
    return;
  }
  if (els.btnAuthLabel) els.btnAuthLabel.textContent = email ? t(state.lang, "signOut") : t(state.lang, "signInGoogle");
  if (els.authStatus) {
    els.authStatus.textContent = email ? `${t(state.lang, "authSignedInAs")}: ${email}` : (authIssueNotice || t(state.lang, "authSignedOut"));
  }
  if (!email && els.authGateText && authIssueNotice) {
    els.authGateText.textContent = authIssueNotice;
  }
}

function optionKey(value) {
  return String(value || "").toLowerCase();
}

function chipCheckHtml(name, value, label, checked = false) {
  return `<label class="chip-check"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}/><span>${escapeHtml(label)}</span></label>`;
}

function renderFilterChips() {
  if (els.filterTypes) els.filterTypes.innerHTML = TYPE_CODES.map((x) => chipCheckHtml("filterType", x, t(state.lang, `type_${x}`))).join("");
  if (els.filterSources) els.filterSources.innerHTML = SOURCE_CODES.map((x) => chipCheckHtml("filterSource", x, t(state.lang, `source_${x}`))).join("");

  els.filterTypes?.querySelectorAll("input").forEach((input) => {
    input.checked = state.filters.types.includes(input.value);
    input.addEventListener("change", () => {
      state.activeSavedFilterId = null;
      state.filters.types = [...els.filterTypes.querySelectorAll("input:checked")].map((x) => x.value);
      requestRender();
    });
  });
  els.filterSources?.querySelectorAll("input").forEach((input) => {
    input.checked = state.filters.sources.includes(input.value);
    input.addEventListener("change", () => {
      state.activeSavedFilterId = null;
      state.filters.sources = [...els.filterSources.querySelectorAll("input:checked")].map((x) => x.value);
      requestRender();
    });
  });
}

function renderAddCollectionChoices(selectedIds = []) {
  if (!els.addCollectionsList) return;
  addFlowSelectedCollectionId = String(selectedIds?.[0] || "");
  const allOptions = [
    {
      id: "",
      name: t(state.lang, "addToInbox"),
      dot: "#8a8880",
      count: "",
      isInbox: true
    },
    ...(state.collections || []).map((col) => ({
      id: String(col.id),
      name: String(col.name || ""),
      dot: "#5b73ff",
      count: visibleCollectionItemCount(String(col.id)),
      isInbox: false
    }))
  ];
  const html = allOptions.map((opt) => {
    const selected = opt.id === addFlowSelectedCollectionId;
    const right = opt.isInbox
      ? `<span class="modal-add-flow__collection-check">${selected ? "✓" : ""}</span>`
      : `<span class="modal-add-flow__collection-count">${escapeHtml(String(opt.count))}</span><span class="modal-add-flow__collection-check">${selected ? "✓" : ""}</span>`;
    return `
      <button
        type="button"
        class="modal-add-flow__collection-option ${selected ? "modal-add-flow__collection-option--selected" : ""}"
        data-add-col-option="${escapeHtml(opt.id || "__inbox__")}"
      >
        <span class="modal-add-flow__collection-dot" style="background:${escapeHtml(opt.dot)};"></span>
        <span class="modal-add-flow__collection-name">${escapeHtml(opt.name)}</span>
        <span class="modal-add-flow__collection-right">${right}</span>
      </button>
    `;
  }).join("");
  els.addCollectionsList.innerHTML = html;
  if (els.addCollectionHidden) els.addCollectionHidden.value = addFlowSelectedCollectionId;
  els.addCollectionsList.querySelectorAll("[data-add-col-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const raw = String(btn.getAttribute("data-add-col-option") || "");
      addFlowSelectedCollectionId = raw === "__inbox__" ? "" : raw;
      if (els.addCollectionHidden) els.addCollectionHidden.value = addFlowSelectedCollectionId;
      renderAddCollectionChoices(addFlowSelectedCollectionId ? [addFlowSelectedCollectionId] : []);
    });
  });
}

function normalizeUrlForCompare(rawUrl) {
  const normalized = toHttpUrl(rawUrl);
  if (!normalized) return String(rawUrl || "").trim();
  try {
    const u = new URL(normalized);
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return String(rawUrl || "").trim();
  }
}

function findDuplicateLink(url) {
  const target = normalizeUrlForCompare(url);
  const pool = state.isUsingDemoData ? state.items.filter((item) => !item.isDemo) : state.items;
  return pool.find((item) => normalizeUrlForCompare(item.url) === target) || null;
}

function canMutateItem(item) {
  if (!item || item.isDemo) return false;
  if (!state.currentUserId) return false;
  const ownerId = String(item.ownerId || "");
  return !ownerId || ownerId === state.currentUserId;
}

function ensureSpaceState() {
  const space = state.space && typeof state.space === "object" ? state.space : {};
  if (!Array.isArray(space.dismissedIds)) space.dismissedIds = [];
  if (!Number.isFinite(space.dailyDone)) space.dailyDone = 0;
  if (typeof space.lastActionDate !== "string") space.lastActionDate = "";
  if (!Number.isFinite(space.streakDays)) space.streakDays = 0;
  if (typeof space.lastStreakDate !== "string") space.lastStreakDate = "";
  state.space = space;
  return space;
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dayDiff(fromKey, toKey) {
  const from = Date.parse(`${String(fromKey || "").trim()}T00:00:00Z`);
  const to = Date.parse(`${String(toKey || "").trim()}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function pruneSpaceDismissedIds() {
  const space = ensureSpaceState();
  const allowed = new Set(
    (state.items || [])
      .map((item) => String(item.id || "").trim())
      .filter(Boolean)
  );
  space.dismissedIds = [...new Set(space.dismissedIds.map((id) => String(id || "").trim()).filter(Boolean))]
    .filter((id) => allowed.has(id));
  return space.dismissedIds;
}

function registerSpaceDecision(itemId) {
  const id = String(itemId || "").trim();
  if (!id) return;
  const space = ensureSpaceState();
  const dismissed = pruneSpaceDismissedIds();
  if (!dismissed.includes(id)) dismissed.push(id);
  space.dismissedIds = dismissed;

  const today = dayKey();
  if (space.lastActionDate !== today) {
    if (space.lastActionDate && dayDiff(space.lastActionDate, today) > 1) {
      space.streakDays = 0;
    }
    space.dailyDone = 0;
    space.lastActionDate = today;
  }
  space.dailyDone += 1;

  if (space.dailyDone >= 3 && space.lastStreakDate !== today) {
    if (!space.lastStreakDate) {
      space.streakDays = 1;
    } else if (dayDiff(space.lastStreakDate, today) === 1) {
      space.streakDays += 1;
    } else {
      space.streakDays = 1;
    }
    space.lastStreakDate = today;
  }
}

function spaceStatsPayload() {
  const space = ensureSpaceState();
  return {
    dailyDone: Math.max(0, Math.floor(Number(space.dailyDone || 0))),
    streakDays: Math.max(0, Math.floor(Number(space.streakDays || 0))),
    lastActionDate: String(space.lastActionDate || "").trim(),
    lastStreakDate: String(space.lastStreakDate || "").trim()
  };
}

async function persistSpaceStatsNow() {
  if (!state.isAuthenticated || !currentUser?.id) return;
  if (spaceStatsPersistInFlight) {
    spaceStatsPersistQueued = true;
    return;
  }
  spaceStatsPersistInFlight = true;
  try {
    await upsertSpaceStats(currentUser.id, spaceStatsPayload());
  } catch (err) {
    console.warn("Space stats save failed", err?.message || err);
  } finally {
    spaceStatsPersistInFlight = false;
    if (spaceStatsPersistQueued) {
      spaceStatsPersistQueued = false;
      void persistSpaceStatsNow();
    }
  }
}

function queueSpaceStatsPersist() {
  if (!state.isAuthenticated || !currentUser?.id) return;
  if (spaceStatsPersistTimer) clearTimeout(spaceStatsPersistTimer);
  spaceStatsPersistTimer = setTimeout(() => {
    spaceStatsPersistTimer = null;
    void persistSpaceStatsNow();
  }, 180);
}

function visibleCollectionItemCount(collectionId) {
  return state.items.filter((item) => {
    if (item.hidden) return false;
    return Array.isArray(item.collectionIds) && item.collectionIds.includes(collectionId);
  }).length;
}

function invalidTagChunks(rawInput) {
  return String(rawInput || "").split(",").map((x) => String(x || "").trim().toLowerCase()).filter(Boolean).filter((x) => x.length < TAG_MIN_LEN || x.length > TAG_MAX_LEN);
}

function updateAddSourceUi() {
  if (!els.inputAddSource || !els.inputAddUrl || !sourceAutofillEnabled) return;
  const detected = detectSourceFromUrl(els.inputAddUrl.value || "");
  els.inputAddSource.value = SOURCE_CODES.includes(detected) ? detected : "other";
}

function inferAutoTags(url, title, sourceCode) {
  void sourceCode;
  const host = String(domainFromUrl(url) || "").toLowerCase();
  const titleLower = String(title || "").toLowerCase();
  const base = [];
  const hasHost = (...domains) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  const hasWord = (word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, "i").test(titleLower);

  if (hasHost("github.com")) base.push("код", "инструмент");
  if (hasHost("youtube.com", "youtu.be")) base.push("видео");
  if (hasHost("medium.com", "substack.com", "habr.com")) base.push("статья");
  if (hasHost("figma.com")) base.push("дизайн", "инструмент");
  if (hasHost("notion.so")) base.push("продуктивность");
  if (hasHost("twitter.com", "x.com")) base.push("соцсети");

  if (
    titleLower.includes("tutorial")
    || titleLower.includes("туториал")
    || titleLower.includes("гайд")
    || titleLower.includes("guide")
  ) {
    base.push("туториал");
  }
  if (hasWord("ux")) base.push("ux");
  if (hasWord("ui")) base.push("ui");

  return normalizeTags(base).slice(0, 5);
}

function syncAddTagsInput() {
  if (!els.inputAddTags) return;
  const merged = normalizeTags([...(addFlowAutoTags || []), ...(addFlowManualTags || [])]);
  els.inputAddTags.value = merged.join(", ");
}

function renderAddTagChips() {
  if (!els.addTagsWrap) return;
  const merged = [
    ...(addFlowAutoTags || []).map((tag) => ({ tag, auto: true })),
    ...(addFlowManualTags || []).map((tag) => ({ tag, auto: false }))
  ];
  const chips = merged.map(({ tag, auto }) => `
    <span class="modal-add-flow__tag-chip ${auto ? "modal-add-flow__tag-chip--auto" : ""}">
      ${escapeHtml(tag)}
      <button type="button" data-add-tag-remove="${escapeHtml(tag)}" aria-label="remove tag">
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <path d="M1 1l8 8M9 1L1 9"></path>
        </svg>
      </button>
    </span>
  `).join("");
  const inputHtml = `<input id="addTagInput" class="modal-add-flow__tags-input" type="text" placeholder="${escapeHtml(state.lang === "ru" ? "добавить тег..." : "add tag...")}" />`;
  els.addTagsWrap.innerHTML = `${chips}${inputHtml}`;
  const input = els.addTagsWrap.querySelector("#addTagInput");
  if (input) {
    els.addTagInput = input;
    input.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === ",") && String(input.value || "").trim()) {
        e.preventDefault();
        const next = String(input.value || "").replace(",", "").trim().toLowerCase();
        if (!next) return;
        if (!addFlowAutoTags.includes(next) && !addFlowManualTags.includes(next) && next.length >= TAG_MIN_LEN) {
          addFlowManualTags.push(next.slice(0, TAG_MAX_LEN));
        }
        syncAddTagsInput();
        renderAddTagChips();
      } else if (e.key === "Backspace" && !String(input.value || "").trim() && addFlowManualTags.length) {
        addFlowManualTags.pop();
        syncAddTagsInput();
        renderAddTagChips();
      }
    });
  }
  els.addTagsWrap.querySelectorAll("[data-add-tag-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tag = String(btn.getAttribute("data-add-tag-remove") || "");
      addFlowAutoTags = addFlowAutoTags.filter((x) => x !== tag);
      addFlowManualTags = addFlowManualTags.filter((x) => x !== tag);
      syncAddTagsInput();
      renderAddTagChips();
    });
  });
  syncAddTagsInput();
}

function setAddFlowStep(step) {
  addFlowStep = Math.max(1, Math.min(3, Number(step) || 1));
  const is1 = addFlowStep === 1;
  const is2 = addFlowStep === 2;
  const is3 = addFlowStep === 3;
  if (els.addStep1) els.addStep1.className = `modal-add-flow__step ${is1 ? "modal-add-flow__step--active" : is2 || is3 ? "modal-add-flow__step--done" : ""}`.trim();
  if (els.addStep2) els.addStep2.className = `modal-add-flow__step ${is2 ? "modal-add-flow__step--active" : is3 ? "modal-add-flow__step--done" : ""}`.trim();
  if (els.addStep3) els.addStep3.className = `modal-add-flow__step ${is3 ? "modal-add-flow__step--active" : ""}`.trim();
  if (els.addPanelUrl) els.addPanelUrl.classList.toggle("modal-add-flow__panel--active", is1);
  if (els.addPanelDetails) els.addPanelDetails.classList.toggle("modal-add-flow__panel--active", is2);
  if (els.addPanelDone) els.addPanelDone.classList.toggle("modal-add-flow__panel--active", is3);
  if (els.addBack) els.addBack.hidden = !is2;
  if (els.addSkip) els.addSkip.hidden = !is2;
  if (els.addCancel) els.addCancel.hidden = !is1;
  if (els.addSave) {
    els.addSave.disabled = false;
    els.addSave.textContent = is1 ? (state.lang === "ru" ? "Далее" : "Next") : is2 ? t(state.lang, "save") : (state.lang === "ru" ? "Закрыть" : "Close");
  }
}

async function parseAddUrl(urlRaw) {
  const currentToken = ++addFlowParseToken;
  const raw = String(urlRaw || "").trim();
  const normalized = toHttpUrl(raw);
  if (!normalized) {
    return { ok: false, error: state.lang === "ru" ? "некорректный URL" : "invalid URL" };
  }
  const source = detectSourceFromUrl(normalized);
  if (els.inputAddSource) els.inputAddSource.value = source;
  if (els.addParsedCard) els.addParsedCard.hidden = false;
  if (els.addParseStatus) els.addParseStatus.classList.remove("modal-add-flow__parse-status--done");
  if (els.addParseStatusText) els.addParseStatusText.textContent = state.lang === "ru" ? "Парсим страницу..." : "Parsing page...";
  if (els.addParsedSource) els.addParsedSource.textContent = domainFromUrl(normalized) || source;
  if (els.addParsedTitle) els.addParsedTitle.textContent = state.lang === "ru" ? "Получаю данные..." : "Parsing...";
  if (els.addParsedThumb) {
    els.addParsedThumb.innerHTML = `<span class="modal-add-flow__parse-thumb-emoji">🔎</span><span id="addParsedShimmer" class="modal-add-flow__parse-thumb-shimmer" aria-hidden="true"></span>`;
    els.addParsedThumbEmoji = els.addParsedThumb.querySelector(".modal-add-flow__parse-thumb-emoji");
    els.addParsedShimmer = els.addParsedThumb.querySelector("#addParsedShimmer");
  }

  let fetchedTitle = "";
  let fetchedPreview = "";
  try {
    fetchedTitle = await tryFetchTitle(normalized);
  } catch {}
  try {
    fetchedPreview = await tryFetchPreview(normalized);
  } catch {}
  if (currentToken !== addFlowParseToken) return { ok: false, error: "stale" };

  const finalTitle = String(fetchedTitle || domainFromUrl(normalized) || normalized).trim().slice(0, TITLE_MAX_LEN);
  if (els.inputAddTitle && !String(els.inputAddTitle.value || "").trim()) els.inputAddTitle.value = finalTitle;
  if (els.addParsedTitle) els.addParsedTitle.textContent = finalTitle;
  if (els.addParsedThumb) {
    if (fetchedPreview) {
      els.addParsedThumb.innerHTML = `<img src="${escapeHtml(fetchedPreview)}" alt="" loading="lazy" referrerpolicy="no-referrer" /><span id="addParsedShimmer" class="modal-add-flow__parse-thumb-shimmer" aria-hidden="true" hidden></span>`;
      els.addParsedShimmer = els.addParsedThumb.querySelector("#addParsedShimmer");
      els.addParsedThumbEmoji = null;
    } else {
      const emoji = source === "pinterest" ? "📌" : source === "behance" ? "🎨" : source === "awwwards" ? "🏆" : "🔗";
      if (els.addParsedThumbEmoji) els.addParsedThumbEmoji.textContent = emoji;
    }
  }

  addFlowAutoTags = inferAutoTags(normalized, finalTitle, source);
  if (els.addAutoTags) {
    els.addAutoTags.innerHTML = addFlowAutoTags.map((tag) => `<span class="modal-add-flow__auto-tag"><span>авто</span> ${escapeHtml(tag)}</span>`).join("");
  }
  if (els.addParseStatus) els.addParseStatus.classList.add("modal-add-flow__parse-status--done");
  if (els.addParseStatusText) els.addParseStatusText.textContent = state.lang === "ru" ? "Данные получены автоматически" : "Data parsed automatically";
  renderAddTagChips();
  return { ok: true, url: normalized };
}

function clearFeedbackTimer(key) {
  if (!feedback[key]) return;
  clearTimeout(feedback[key]);
  feedback[key] = null;
}

function stopFeedbackSpinner(key) {
  if (!feedback[key]) return;
  feedback[key].stop();
  feedback[key] = null;
}

function ensureStatusLine() {
  if (els.statusLine?.isConnected) return els.statusLine;
  els.statusLine = document.getElementById("statusLine");
  return els.statusLine || null;
}

function ensureModalStatusLine(form, id) {
  if (!form) return null;
  let line = form.querySelector(`#${id}`);
  if (!line) {
    line = document.createElement("div");
    line.id = id;
    line.className = "status-line status-line--inline mono status-info";
    line.setAttribute("role", "status");
    line.setAttribute("aria-live", "polite");
    line.setAttribute("aria-atomic", "true");
    form.append(line);
  }
  return line;
}

function clearAddModalFeedback() {
  stopFeedbackSpinner("addSpinner");
  if (typeof feedback.addFlashCancel === "function") feedback.addFlashCancel();
  feedback.addFlashCancel = null;
  clearFeedbackTimer("addCloseTimer");
}

function clearCollectionModalFeedback() {
  stopFeedbackSpinner("collectionSpinner");
  if (typeof feedback.collectionFlashCancel === "function") feedback.collectionFlashCancel();
  feedback.collectionFlashCancel = null;
  clearFeedbackTimer("collectionCloseTimer");
}

function closeAddModal() {
  clearAddModalFeedback();
  sourceAutofillEnabled = true;
  activeTagMenuIndex = -1;
  addFlowParseToken += 1;
  if (els.addTagsMenu) els.addTagsMenu.hidden = true;
  els.modalAddLink?.close();
}

function openNewLinkModal(preset = {}) {
  sourceAutofillEnabled = true;
  activeTagMenuIndex = -1;
  els.formAddLink?.reset();
  const lockCollectionTarget = state.activeCollectionId === "hidden" || (
    state.activeCollectionId !== "all"
    && state.activeCollectionId !== "fav"
    && state.activeCollectionId !== "recent"
    && !state.activeSavedFilterId
    && state.collections.some((c) => c.id === state.activeCollectionId)
  );
  if (els.addToSection) els.addToSection.hidden = lockCollectionTarget;
  const presetCollections = state.activeCollectionId === "hidden"
    ? []
    : (lockCollectionTarget ? [state.activeCollectionId] : []);
  addFlowSelectedCollectionId = String(presetCollections[0] || "");
  addFlowAutoTags = [];
  addFlowManualTags = [];
  addFlowParseToken += 1;
  renderAddCollectionChoices(presetCollections);
  renderTagSuggestions();
  if (els.inputAddUrl) els.inputAddUrl.value = String(preset.url || "");
  if (els.inputAddTitle) els.inputAddTitle.value = String(preset.title || "");
  if (els.inputAddSource) els.inputAddSource.value = "other";
  if (els.inputAddTags) els.inputAddTags.value = "";
  if (els.addFavorite) els.addFavorite.checked = state.activeCollectionId === "fav";
  if (els.inputAddNote) els.inputAddNote.value = "";
  if (els.addParsedCard) els.addParsedCard.hidden = true;
  if (els.addParsedTitle) els.addParsedTitle.textContent = "";
  if (els.addParsedSource) els.addParsedSource.textContent = "";
  if (els.addParsedThumb) {
    els.addParsedThumb.innerHTML = `<span class="modal-add-flow__parse-thumb-emoji">🔗</span><span id="addParsedShimmer" class="modal-add-flow__parse-thumb-shimmer" aria-hidden="true"></span>`;
    els.addParsedThumbEmoji = els.addParsedThumb.querySelector(".modal-add-flow__parse-thumb-emoji");
    els.addParsedShimmer = els.addParsedThumb.querySelector("#addParsedShimmer");
  }
  if (els.addParseStatus) els.addParseStatus.classList.remove("modal-add-flow__parse-status--done");
  if (els.addParseStatusText) els.addParseStatusText.textContent = state.lang === "ru" ? "Парсим страницу..." : "Parsing page...";
  if (els.addAutoTags) els.addAutoTags.innerHTML = "";
  renderAddTagChips();
  setAddFlowStep(1);
  updateAddSourceUi();
  if (els.modalAddLink) showDialogWithA11y(els.modalAddLink, { preferredFocus: els.inputAddUrl });
  if (preset.url) void parseAddUrl(String(preset.url));
}

function updateTagsMenu() {
  if (els.addTagsMenu) els.addTagsMenu.hidden = true;
}

function renderTagSuggestions() {
  knownTags = [...new Set(state.items.flatMap((item) => normalizeTags(item.tags || [])))].sort((a, b) => a.localeCompare(b, state.lang));
  updateTagsMenu();
}

function applyTagSuggestion(tag) {
  if (!tag) return;
  if (!addFlowAutoTags.includes(tag) && !addFlowManualTags.includes(tag)) {
    addFlowManualTags.push(String(tag).trim().toLowerCase());
    syncAddTagsInput();
    renderAddTagChips();
  }
}

function applyI18n() {
  const L = state.lang;
  if (els.brand) els.brand.textContent = t(L, "brand");
  if (els.labelNav) els.labelNav.textContent = t(L, "nav");
  if (els.labelCollections) els.labelCollections.textContent = t(L, "collections");
  if (els.labelSavedFilters) els.labelSavedFilters.textContent = t(L, "savedFilters");
  if (els.btnAddLink) els.btnAddLink.textContent = t(L, "addLink");
  if (els.btnAiOnboarding) {
    els.btnAiOnboarding.textContent = ENABLE_AI_ONBOARDING
      ? (L === "ru" ? "AI-онбординг" : "AI onboarding")
      : (L === "ru" ? "AI-онбординг (временно отключен)" : "AI onboarding (temporarily disabled)");
  }
  if (els.btnNewCollection) els.btnNewCollection.setAttribute("aria-label", t(L, "newCollection"));
  if (els.btnSaveFilterInline) {
    els.btnSaveFilterInline.setAttribute("aria-label", t(L, "saveFilter"));
    els.btnSaveFilterInline.textContent = t(L, "saveFilter");
  }
  if (els.localHint) els.localHint.textContent = t(L, "localHint");
  if (els.authGateBrandName) els.authGateBrandName.textContent = t(L, "brand");
  if (els.authGateBrandInline) els.authGateBrandInline.textContent = t(L, "brand");
  if (els.authGateShowcaseTitle) els.authGateShowcaseTitle.textContent = t(L, "authGateShowcaseTitle");
  if (els.authGateShowcaseText) els.authGateShowcaseText.textContent = t(L, "authGateShowcaseText");
  if (els.authGateTitle) els.authGateTitle.textContent = t(L, "authGateTitle");
  if (els.authGateText) els.authGateText.textContent = t(L, "authGateText");
  if (els.authGateBtnLabel) els.authGateBtnLabel.textContent = t(L, "authGateBtn");
  else if (els.authGateBtn) els.authGateBtn.textContent = t(L, "authGateBtn");
  if (els.authGateGuestBtn) els.authGateGuestBtn.textContent = t(L, "authGateGuestBtn");
  if (els.langSelect) els.langSelect.value = L === "en" ? "en" : "ru";
  if (els.searchInput) els.searchInput.placeholder = t(L, "searchPlaceholder");
  if (els.btnFilters) {
    const label = els.btnFilters.querySelector(".btn-filters__label");
    if (label) label.textContent = t(L, "filters");
    else els.btnFilters.textContent = t(L, "filters");
  }
  if (els.labelFilterTypes) els.labelFilterTypes.textContent = t(L, "filterTypes");
  if (els.labelFilterSources) els.labelFilterSources.textContent = t(L, "filterSources");
  if (els.labelFilterTag) els.labelFilterTag.textContent = t(L, "filterTag");
  if (els.labelFilterFavorite) els.labelFilterFavorite.textContent = t(L, "filterFavoriteOnly");
  if (els.liquidFallbackTitle) els.liquidFallbackTitle.textContent = t(L, "liquidFallbackTitle");
  if (els.liquidFallbackText) els.liquidFallbackText.textContent = t(L, "liquidFallbackText");
  if (els.modalAddTitle) els.modalAddTitle.textContent = t(L, "modalAddTitle");
  if (els.labelAddUrl) els.labelAddUrl.textContent = t(L, "modalUrl");
  if (els.labelAddTitle) els.labelAddTitle.textContent = t(L, "modalTitle");
  if (els.labelAddTags) els.labelAddTags.textContent = t(L, "modalTags");
  if (els.labelAddType) els.labelAddType.textContent = t(L, "modalType");
  if (els.labelAddSource) els.labelAddSource.textContent = t(L, "modalSource");
  if (els.labelAddNote) els.labelAddNote.textContent = t(L, "modalNote");
  if (els.labelAddTo) els.labelAddTo.textContent = t(L, "addTo");
  if (els.labelAddFavorite) els.labelAddFavorite.textContent = t(L, "markFavorite");
  if (els.inputAddTitle) els.inputAddTitle.placeholder = t(L, "modalTitleHint");
  if (els.inputAddNote) els.inputAddNote.placeholder = L === "ru" ? "Зачем сохранил?" : "Why saved?";
  if (els.addCancel) els.addCancel.textContent = t(L, "cancel");
  if (els.addBack) els.addBack.textContent = L === "ru" ? "Назад" : "Back";
  if (els.addSkip) els.addSkip.textContent = L === "ru" ? "Пропустить детали →" : "Skip details →";
  if (els.addSave && addFlowStep === 2) els.addSave.textContent = t(L, "save");
  if (els.modalCollectionTitle) els.modalCollectionTitle.textContent = t(L, "modalCollectionTitle");
  if (els.labelColName) els.labelColName.textContent = t(L, "name");
  if (els.labelColDescription) els.labelColDescription.textContent = t(L, "description");
  if (els.labelColShared) els.labelColShared.textContent = t(L, "sharedCollection");
  if (els.colCancel) els.colCancel.textContent = t(L, "cancel");
  if (els.colCreate) els.colCreate.textContent = t(L, "create");
  if (els.modalDeleteTitle) els.modalDeleteTitle.textContent = t(L, "deleteLinkTitle");
  if (els.modalDeleteText) els.modalDeleteText.textContent = t(L, "deleteLinkText");
  if (els.deleteCancel) els.deleteCancel.textContent = t(L, "cancel");
  if (els.deleteConfirm) els.deleteConfirm.textContent = t(L, "del");

  if (els.sortSelect) {
    const labels = {
      newest: t(L, "sortNewest"),
      oldest: t(L, "sortOldest"),
      title_asc: t(L, "sortTitleAsc"),
      title_desc: t(L, "sortTitleDesc"),
      source_asc: t(L, "sortSource")
    };
    for (const option of els.sortSelect.options) option.textContent = labels[option.value] || option.value;
  }
  const typeSelect = els.formAddLink?.querySelector('select[name="type"]');
  if (typeSelect) {
    for (const option of typeSelect.options) option.textContent = option.value ? t(L, `type_${optionKey(option.value)}`) : t(L, "anyOption");
  }
  if (els.inputAddSource && els.inputAddSource.tagName === "SELECT") {
    for (const option of els.inputAddSource.options) option.textContent = t(L, `source_${optionKey(option.value)}`);
  }

  setAddFlowStep(addFlowStep);

  renderFilterChips();
  renderAddCollectionChoices();
  renderTagSuggestions();
  renderAuthStatus();
  syncThemeToggle();
}

function isSpaceActive() {
  return state.activeCollectionId === "space";
}

function syncContentViews() {
  const active = isSpaceActive();
  if (els.topbarRight) els.topbarRight.hidden = active;
  if (els.filtersPanel) els.filtersPanel.hidden = active ? true : !state.ui.filtersOpen;
  if (els.chipsBar) els.chipsBar.hidden = active;
  if (els.demoHint) els.demoHint.hidden = active ? true : !state.isUsingDemoData;
  if (els.grid) els.grid.hidden = active;
  if (els.spaceView) els.spaceView.hidden = !active;
  if (els.liquidLab) els.liquidLab.hidden = true;
}

function filterPayload() {
  return {
    types: [],
    sources: [],
    tag: String(state.filters.tag || ""),
    favoriteOnly: !!state.filters.favoriteOnly,
    search: String(state.search || ""),
    sortBy: FILTER_SORTS.has(state.sortBy) ? state.sortBy : "newest"
  };
}

function isFilterActive() {
  return Boolean(state.filters.tag || state.filters.favoriteOnly || state.search);
}

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function isValidEmail(input) {
  const normalized = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function loadDemoPrefs() {
  try {
    const raw = localStorage.getItem(DEMO_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDemoFavorite(id, favorite) {
  const prefs = loadDemoPrefs();
  prefs[String(id)] = !!favorite;
  localStorage.setItem(DEMO_PREFS_KEY, JSON.stringify(prefs));
}

function applyDemoPrefs(items) {
  const prefs = loadDemoPrefs();
  return (items || []).map((item) => {
    if (!item?.isDemo) return item;
    if (!(item.id in prefs)) return item;
    return { ...item, favorite: !!prefs[item.id] };
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input) {
  const text = String(input || "");
  if (!text) return "";
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function hiddenAuthCopy(mode) {
  const isCreate = mode === "create";
  return {
    title: isCreate ? t(state.lang, "hiddenAuthCreateTitle") : t(state.lang, "hiddenAuthUnlockTitle"),
    text: isCreate ? t(state.lang, "hiddenAuthCreateText") : t(state.lang, "hiddenAuthUnlockText"),
    passwordLabel: t(state.lang, "hiddenAuthPasswordLabel"),
    confirmLabel: t(state.lang, "hiddenAuthConfirmLabel"),
    submit: isCreate ? t(state.lang, "save") : t(state.lang, "open"),
    cancel: t(state.lang, "cancel")
  };
}

function openHiddenAuthDialog(mode = "unlock") {
  const dialog = els.modalHiddenAuth;
  if (!dialog || !els.hiddenAuthPassword || !els.hiddenAuthCancel || !els.hiddenAuthSubmit) return Promise.resolve(null);
  const isCreate = mode === "create";
  const copy = hiddenAuthCopy(mode);
  if (els.hiddenAuthTitle) els.hiddenAuthTitle.textContent = copy.title;
  if (els.hiddenAuthText) els.hiddenAuthText.textContent = copy.text;
  if (els.hiddenAuthPasswordLabel) els.hiddenAuthPasswordLabel.textContent = copy.passwordLabel;
  if (els.hiddenAuthConfirmLabel) els.hiddenAuthConfirmLabel.textContent = copy.confirmLabel;
  if (els.hiddenAuthCancel) els.hiddenAuthCancel.textContent = copy.cancel;
  if (els.hiddenAuthSubmit) els.hiddenAuthSubmit.textContent = copy.submit;
  if (els.hiddenAuthConfirmField) els.hiddenAuthConfirmField.hidden = !isCreate;
  els.hiddenAuthPassword.value = "";
  if (els.hiddenAuthConfirm) els.hiddenAuthConfirm.value = "";
  els.hiddenAuthPassword.setAttribute("autocomplete", isCreate ? "new-password" : "current-password");
  els.hiddenAuthConfirm?.setAttribute("autocomplete", "new-password");

  return new Promise((resolve) => {
    let done = false;
    const cleanup = () => {
      els.formHiddenAuth?.removeEventListener("submit", onSubmit);
      els.hiddenAuthCancel?.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
    const finish = (payload) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(payload);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const password = String(els.hiddenAuthPassword?.value || "");
      const confirm = String(els.hiddenAuthConfirm?.value || "");
      dialog.close();
      finish({ password, confirm });
    };
    const onCancel = (e) => {
      if (e) e.preventDefault();
      dialog.close();
      finish(null);
    };
    const onClose = () => finish(null);
    els.formHiddenAuth?.addEventListener("submit", onSubmit);
    els.hiddenAuthCancel?.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose, { once: true });
    showDialogWithA11y(dialog, { preferredFocus: els.hiddenAuthPassword });
  });
}

async function ensureHiddenAccess() {
  if (state.ui.hiddenUnlocked) return true;

  const existingHash = localStorage.getItem(HIDDEN_PASSWORD_KEY) || "";
  if (!existingHash) {
    const created = await openHiddenAuthDialog("create");
    if (!created) return false;
    const first = String(created.password || "");
    if (first.length < 4) {
      notify(t(state.lang, "hiddenPasswordTooShort"), "error", els.hiddenAuthText);
      return false;
    }
    const confirmPwd = String(created.confirm || "");
    if (first !== confirmPwd) {
      notify(t(state.lang, "hiddenPasswordMismatch"), "error", els.hiddenAuthText);
      return false;
    }
    const hash = await sha256Hex(first);
    localStorage.setItem(HIDDEN_PASSWORD_KEY, hash);
    state.ui.hiddenUnlocked = true;
    return true;
  }

  const enteredData = await openHiddenAuthDialog("unlock");
  if (!enteredData) return false;
  const entered = String(enteredData.password || "");
  if (!entered) return false;
  const enteredHash = await sha256Hex(entered);
  if (enteredHash !== existingHash) {
    notify(t(state.lang, "hiddenWrongPassword"), "error", els.hiddenAuthText);
    return false;
  }
  state.ui.hiddenUnlocked = true;
  return true;
}

async function loadData() {
  const spaceStatsPromise = currentUser?.id ? getSpaceStats(currentUser.id) : Promise.resolve(null);
  const [links, collections, rows, savedFilters, spaceStats] = await Promise.all([
    listLinks(),
    listCollections(),
    listLinkCollections(),
    listSavedFilters(),
    spaceStatsPromise
  ]);
  const relMap = new Map();
  for (const rel of rows || []) {
    const linkId = String(rel.link_id || "");
    const colId = String(rel.collection_id || "");
    if (!linkId || !colId) continue;
    const list = relMap.get(linkId) || [];
    if (!list.includes(colId)) list.push(colId);
    relMap.set(linkId, list);
  }
  state.items = links.map((x) => ({ ...x, isDemo: false, previewImage: previewFallbackUrl(x.url), collectionIds: relMap.get(x.id) || [] }));
  pruneSpaceDismissedIds();
  state.collections = collections;
  applyCollectionUiSettings();
  state.savedFilters = savedFilters;
  const space = ensureSpaceState();
  space.dismissedIds = [];
  space.dailyDone = Math.max(0, Number(spaceStats?.dailyDone || 0));
  space.streakDays = Math.max(0, Number(spaceStats?.streakDays || 0));
  space.lastActionDate = String(spaceStats?.lastActionDate || "");
  space.lastStreakDate = String(spaceStats?.lastStreakDate || "");
}

const ONBOARDING_TAG_BLACKLIST = new Set([
  "какой", "какая", "какие", "тебя", "уровень", "чем", "фокус", "сейчас",
  "what", "which", "your", "level", "focus", "now"
]);

function sanitizeOnboardingTags(input) {
  const raw = normalizeTags(input || []);
  return raw.filter((tag) => !ONBOARDING_TAG_BLACKLIST.has(String(tag || "").toLowerCase()));
}

async function importOnboardingResources(resources, profile) {
  if (!ensureAuth()) return { imported: 0, skipped: Array.isArray(resources) ? resources.length : 0 };
  const list = Array.isArray(resources) ? resources : [];
  let imported = 0;
  let skipped = 0;

  for (const item of list) {
    const rawUrl = String(item?.url || "").trim();
    if (!rawUrl) {
      skipped += 1;
      continue;
    }
    const url = toHttpUrl(rawUrl);
    if (!url) {
      skipped += 1;
      continue;
    }
    if (findDuplicateLink(url)) {
      skipped += 1;
      continue;
    }
    try {
      const created = await createLink({
        url,
        title: String(item?.title || "").trim() || domainFromUrl(url),
        note: String(item?.snippet || item?.note || "").trim().slice(0, NOTE_MAX_LEN),
        tags: sanitizeOnboardingTags([...(profile?.stack || []), ...(profile?.goals || []), ...(item?.tags || []), detectSourceFromUrl(url)]),
        type: "article",
        source: detectSourceFromUrl(url),
        favorite: false,
        hidden: false
      }, currentUser.id);
      if (!created) {
        skipped += 1;
        continue;
      }
      state.items.unshift({ ...created, isDemo: false, isAiNew: true, previewImage: previewFallbackUrl(created.url), collectionIds: [] });
      imported += 1;
    } catch {
      skipped += 1;
    }
  }

  if (imported > 0) {
    if (state.isUsingDemoData) {
      state.items = state.items.filter((x) => !x.isDemo);
      state.isUsingDemoData = false;
    }
    renderTagSuggestions();
    requestRender();
  }
  return { imported, skipped };
}

async function migrateLegacyIfNeeded() {
  if (!currentUser?.id) return;
  const key = `resource_vault_migrated_v5_${currentUser.id}`;
  if (localStorage.getItem(key) === "1") return;
  const legacy = loadLegacyVault();
  if (!legacy || (!(legacy.items || []).length && !(legacy.collections || []).length)) {
    localStorage.setItem(key, "1");
    return;
  }

  const map = new Map();
  for (const col of legacy.collections || []) {
    const created = await createCollection({ name: String(col.name || "Collection"), description: String(col.description || "") }, currentUser.id);
    if (created) map.set(col.id, created.id);
  }

  const seen = new Set(state.items.map((x) => normalizeUrlForCompare(x.url)));
  for (const item of legacy.items || []) {
    const url = toHttpUrl(String(item.url || "").trim());
    if (!url) continue;
    const normalized = normalizeUrlForCompare(url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const created = await createLink({
      url,
      title: String(item.title || "").trim() || domainFromUrl(url),
      note: String(item.note || "").trim().slice(0, NOTE_MAX_LEN),
      tags: normalizeTags(item.tags || []),
      type: item.type || null,
      source: item.source || detectSourceFromUrl(url),
      favorite: !!item.favorite
    }, currentUser.id);
    if (!created) continue;
    const colIds = (item.collectionIds || []).map((id) => map.get(id)).filter(Boolean);
    await replaceLinkCollections(created.id, colIds, currentUser.id);
  }
  localStorage.setItem(key, "1");
}

const actions = {
  onOpenItem: (id, options = {}) => {
    const item = state.items.find((x) => x.id === id);
    if (item?.isAiNew) item.isAiNew = false;
    state.recentViewedIds = [id, ...state.recentViewedIds.filter((x) => x !== id)].slice(0, 100);
    if (options?.fromSpace) {
      registerSpaceDecision(id);
      queueSpaceStatsPersist();
    }
    requestRender();
  },
  onArchiveItem: async (id, options = {}) => {
    if (pendingLinkOps.has(id)) return;
    pendingLinkOps.add(id);
    try {
      const item = state.items.find((x) => x.id === id);
      if (!item) return;

      if (item.isDemo) {
        item.hidden = true;
        if (options?.fromSpace) {
          registerSpaceDecision(id);
          queueSpaceStatsPersist();
        }
        requestRender();
        return;
      }

      if (!ensureAuth()) return;
      if (!canMutateItem(item)) return;

      const updated = await updateLink(id, { ...item, hidden: true });
      item.hidden = !!(updated?.hidden ?? true);
      item.updatedAt = Number(updated?.updatedAt || Date.now());
      if (options?.fromSpace) {
        registerSpaceDecision(id);
        queueSpaceStatsPersist();
      }
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось архивировать ссылку." : "Failed to archive link."), "error");
    } finally {
      pendingLinkOps.delete(id);
    }
  },
  onToggleFavorite: async (id, next) => {
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(id)) return;
    pendingLinkOps.add(id);
    try {
      const item = state.items.find((x) => x.id === id);
      if (!item || item.isDemo) return;
      if (!canMutateItem(item)) return;
      const updated = await updateLink(id, { ...item, favorite: !!next });
      if (updated) item.favorite = updated.favorite;
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось обновить избранное." : "Failed to update favorite."), "error");
    } finally {
      pendingLinkOps.delete(id);
    }
  },
  onDeleteItem: async (id) => {
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(id)) return;
    pendingLinkOps.add(id);
    try {
      const item = state.items.find((x) => x.id === id);
      if (item?.isDemo) {
        state.items = state.items.filter((x) => x.id !== id);
        renderTagSuggestions();
        requestRender();
        return;
      }
      if (!canMutateItem(item)) return;
      await deleteLink(id);
      state.items = state.items.filter((x) => x.id !== id);
      renderTagSuggestions();
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось удалить ссылку." : "Failed to delete link."), "error");
    } finally {
      pendingLinkOps.delete(id);
    }
  },
  onAssignToCollection: async (linkId, collectionId) => {
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(linkId)) return;
    pendingLinkOps.add(linkId);
    try {
      const item = state.items.find((x) => x.id === linkId);
      if (!item) return;
      if (!canMutateItem(item)) return;
      const next = [...new Set([...(item.collectionIds || []), collectionId])];
      await replaceLinkCollections(linkId, next, currentUser.id);
      item.collectionIds = next;
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось обновить коллекции." : "Failed to update collections."), "error");
    } finally {
      pendingLinkOps.delete(linkId);
    }
  },
  onReorderCollections: async (draggedId, targetId) => {
    const from = state.ui.collectionOrderIds.indexOf(draggedId);
    const to = state.ui.collectionOrderIds.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...state.ui.collectionOrderIds];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    state.ui.collectionOrderIds = next;
    applyCollectionUiSettings();
    renderAddCollectionChoices();
    requestRender();
  },
  onTogglePinCollection: async (collectionId) => {
    const pins = new Set(state.ui.pinnedCollectionIds || []);
    if (pins.has(collectionId)) pins.delete(collectionId);
    else pins.add(collectionId);
    state.ui.pinnedCollectionIds = [...pins];
    applyCollectionUiSettings();
    renderAddCollectionChoices();
    requestRender();
  },
  onRenameCollection: async (collectionId, name) => {
    if (!ensureAuth()) return;
    if (pendingCollectionOps.has(collectionId)) return;
    pendingCollectionOps.add(collectionId);
    try {
      const col = state.collections.find((x) => x.id === collectionId);
      if (!col) return;
      const updated = await updateCollection(collectionId, {
        name,
        description: col.description,
        isShared: !!col.isShared
      });
      if (updated) {
        col.name = updated.name;
        col.description = updated.description;
        col.isShared = updated.isShared;
      }
      renderAddCollectionChoices();
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось переименовать коллекцию." : "Failed to rename collection."), "error");
    } finally {
      pendingCollectionOps.delete(collectionId);
    }
  },
  onInviteCollection: async (collectionId) => {
    if (!ensureAuth()) return;
    const col = state.collections.find((x) => x.id === collectionId);
    if (!col || !col.isShared || col.ownerId !== currentUser?.id) return;
    const emailRaw = await promptDialog({
      title: t(state.lang, "inviteToCollection"),
      message: t(state.lang, "invitePrompt"),
      placeholder: "teammate@example.com",
      submitText: t(state.lang, "save"),
      cancelText: t(state.lang, "cancel")
    });
    if (emailRaw == null) return;
    const email = normalizeEmail(emailRaw);
    if (!email) return;
    if (!isValidEmail(email)) {
      notify(t(state.lang, "inviteInvalidEmail"), "error");
      return;
    }
    if (email === normalizeEmail(authEmail(currentUser))) {
      notify(t(state.lang, "inviteSelfError"), "error");
      return;
    }
    try {
      await createCollectionInvite(collectionId, email, currentUser.id);
      notify(t(state.lang, "inviteSent"), "ok");
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("duplicate key")) {
        notify(t(state.lang, "inviteSent"), "ok");
      } else {
        notify(msg || "Invite failed", "error");
      }
    }
  },
  onDeleteCollection: async (collectionId) => {
    if (!ensureAuth()) return;
    if (pendingCollectionOps.has(collectionId)) return;
    pendingCollectionOps.add(collectionId);
    try {
      await deleteCollection(collectionId);
      state.collections = state.collections.filter((x) => x.id !== collectionId);
      state.ui.collectionOrderIds = (state.ui.collectionOrderIds || []).filter((id) => id !== collectionId);
      state.ui.pinnedCollectionIds = (state.ui.pinnedCollectionIds || []).filter((id) => id !== collectionId);
      for (const item of state.items) item.collectionIds = (item.collectionIds || []).filter((id) => id !== collectionId);
      if (state.activeCollectionId === collectionId) state.activeCollectionId = "all";
      applyCollectionUiSettings();
      renderAddCollectionChoices();
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось удалить коллекцию." : "Failed to delete collection."), "error");
    } finally {
      pendingCollectionOps.delete(collectionId);
    }
  },
  onDeleteSavedFilter: async (id) => {
    if (!ensureAuth()) return;
    if (pendingSavedFilterOps.has(id)) return;
    pendingSavedFilterOps.add(id);
    try {
      await deleteSavedFilter(id);
      state.savedFilters = state.savedFilters.filter((x) => x.id !== id);
      if (state.activeSavedFilterId === id) {
        state.activeSavedFilterId = null;
        state.activeCollectionId = "all";
      }
      requestRender();
    } catch (err) {
      notify(err?.message || (state.lang === "ru" ? "Не удалось удалить фильтр." : "Failed to delete filter."), "error");
    } finally {
      pendingSavedFilterOps.delete(id);
    }
  }
};

function firstHttpUrl(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const line of lines) {
    const normalized = toHttpUrl(line);
    if (normalized) return normalized;
  }
  const inline = text.match(/https?:\/\/[^\s<>"')]+/i)?.[0] || "";
  return toHttpUrl(inline);
}

function setupEvents() {
  const mobileMq = window.matchMedia("(max-width: 700px)");
  const debouncedSearchRender = debounce(() => requestRender(), 150);
  const setMobileMenu = (open) => {
    const isOpen = !!open;
    state.ui.mobileMenuOpen = isOpen;
    document.body.classList.toggle("mobile-menu-open", isOpen);
    els.btnMobileMenu?.setAttribute("aria-expanded", isOpen ? "true" : "false");
    els.mobileOverlay?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (mobileMq.matches) {
      els.sidebar?.setAttribute("aria-hidden", isOpen ? "false" : "true");
    } else {
      els.sidebar?.setAttribute("aria-hidden", "false");
    }
  };
  setMobileMenu(false);
  const closeMobileMenuIfNeeded = () => { if (mobileMq.matches) setMobileMenu(false); };

  els.inputAddTitle && (els.inputAddTitle.maxLength = TITLE_MAX_LEN);
  els.inputAddNote && (els.inputAddNote.maxLength = NOTE_MAX_LEN);
  els.navAll?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "all"; requestRender(); closeMobileMenuIfNeeded(); });
  els.navFav?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "fav"; requestRender(); closeMobileMenuIfNeeded(); });
  els.navHidden?.addEventListener("click", async () => {
    if (!ensureAuth()) return;
    const ok = await ensureHiddenAccess();
    if (!ok) return;
    state.activeSavedFilterId = null;
    state.activeCollectionId = "hidden";
    requestRender();
    closeMobileMenuIfNeeded();
  });
  els.navRecent?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "recent"; requestRender(); closeMobileMenuIfNeeded(); });
  els.navSpace?.addEventListener("click", () => {
    state.activeSavedFilterId = null;
    state.activeCollectionId = "space";
    requestRender();
    closeMobileMenuIfNeeded();
  });
  els.searchInput?.addEventListener("input", (e) => {
    state.activeSavedFilterId = null;
    state.search = String(e.target.value || "");
    debouncedSearchRender();
  });
  els.searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      state.search = "";
      if (els.searchInput) els.searchInput.value = "";
      requestRender();
      return;
    }
    if (e.key === "ArrowDown") {
      const firstResult = els.searchPanelResults?.querySelector("[data-search-result]");
      if (firstResult instanceof HTMLElement) {
        e.preventDefault();
        firstResult.focus();
      }
      return;
    }
    if (e.key === "Enter") {
      const firstResult = els.searchPanelResults?.querySelector("[data-search-result]");
      if (firstResult instanceof HTMLElement) {
        e.preventDefault();
        firstResult.click();
      }
    }
  });
  els.sortSelect?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.sortBy = FILTER_SORTS.has(String(e.target.value || "")) ? String(e.target.value) : "newest"; requestRender(); });
  els.btnFilters?.addEventListener("click", () => { state.ui.filtersOpen = !state.ui.filtersOpen; if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen; });
  els.filterTagInput?.addEventListener("input", (e) => { state.activeSavedFilterId = null; state.filters.tag = normalizeSearchText(e.target.value); requestRender(); });
  els.filterFavoriteOnly?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.filters.favoriteOnly = !!e.target.checked; requestRender(); });

  els.langSelect?.addEventListener("change", (e) => {
    state.lang = String(e.target?.value || "") === "en" ? "en" : "ru";
    applyI18n();
    syncLanguageSelect();
    requestRender();
  });
  els.btnTheme?.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    syncThemeToggle();
    requestRender();
  });

  els.btnAuth?.addEventListener("click", async () => {
    if (authEmail(currentUser)) {
      await logout();
      window.location.reload();
      return;
    }
    loginWithGoogle();
  });
  els.authGateBtn?.addEventListener("click", () => loginWithGoogle());
  els.authGateGuestBtn?.addEventListener("click", () => {
    state.isGuestMode = true;
    requestRender();
  });

  els.btnAddLink?.addEventListener("click", () => { openNewLinkModal(); closeMobileMenuIfNeeded(); });
  els.demoHintAdd?.addEventListener("click", () => { openNewLinkModal(); });
  els.btnNewCollection?.addEventListener("click", () => {
    els.formCollection?.reset();
    const nameInput = els.formCollection?.querySelector('input[name="name"]');
    if (els.modalCollection) showDialogWithA11y(els.modalCollection, { preferredFocus: nameInput });
    closeMobileMenuIfNeeded();
  });
  els.btnSaveFilterInline?.addEventListener("click", async () => {
    if (!ensureAuth()) return;
    if (els.btnSaveFilterInline?.disabled) return;
    if (!isFilterActive()) {
      feedback.savedFilterFlashCancel = flashStatus(
        els.btnSaveFilterInline,
        state.lang === "ru" ? "сначала установите фильтры" : "set filters first",
        "info"
      );
      return;
    }
    if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = true;
    try {
      const nextName = await promptDialog({
        title: t(state.lang, "saveFilterTitle"),
        message: t(state.lang, "saveFilterPrompt"),
        submitText: t(state.lang, "save"),
        cancelText: t(state.lang, "cancel")
      });
      const name = String(nextName || "").trim();
      if (name) {
        feedback.savedFilterSpinner = startSpinner(
          els.btnSaveFilterInline,
          state.lang === "ru" ? "Сохраняю фильтр..." : "Saving filter..."
        );
        const created = await createSavedFilter({ name, filter: filterPayload() }, currentUser.id);
        if (created) state.savedFilters.push(created);
        stopFeedbackSpinner("savedFilterSpinner");
        feedback.savedFilterFlashCancel = flashStatus(
          els.btnSaveFilterInline,
          state.lang === "ru" ? "фильтр сохранён" : "filter saved",
          "ok"
        );
      }
      requestRender();
    } catch (err) {
      stopFeedbackSpinner("savedFilterSpinner");
      feedback.savedFilterFlashCancel = flashStatus(
        els.btnSaveFilterInline,
        state.lang === "ru" ? "не удалось сохранить" : "save failed",
        "error"
      );
      console.warn("Save filter failed", err?.message || err);
    } finally {
      stopFeedbackSpinner("savedFilterSpinner");
      if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = false;
    }
  });

  els.formCollection?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (els.colCreate?.disabled) return;
    const fd = new FormData(els.formCollection);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const description = String(fd.get("description") || "").trim();
    const isShared = !!fd.get("shared");
    if (els.colCreate) els.colCreate.disabled = true;
    stopFeedbackSpinner("collectionSpinner");
    feedback.collectionSpinner = startSpinner(
      els.colCreate,
      state.lang === "ru" ? "Создаю..." : "Creating..."
    );
    const collectionStatusLine = ensureModalStatusLine(els.formCollection, "collectionStatusLine");
    try {
      const created = await createCollection({ name, description, isShared }, currentUser.id);
      if (created) {
        state.collections.push(created);
        state.ui.collectionOrderIds = [...(state.ui.collectionOrderIds || []), created.id];
        applyCollectionUiSettings();
        state.activeCollectionId = created.id;
      }
      stopFeedbackSpinner("collectionSpinner");
      feedback.collectionFlashCancel = flashStatus(
        collectionStatusLine,
        state.lang === "ru" ? "создано" : "created",
        "ok"
      );
      clearFeedbackTimer("collectionCloseTimer");
      feedback.collectionCloseTimer = setTimeout(() => {
        clearCollectionModalFeedback();
        els.modalCollection?.close();
      }, 220);
      renderAddCollectionChoices();
      requestRender();
    } catch (err) {
      stopFeedbackSpinner("collectionSpinner");
      feedback.collectionFlashCancel = flashStatus(
        collectionStatusLine,
        state.lang === "ru" ? "ошибка" : "error",
        "error",
        1400
      );
      console.warn("Create collection failed", err?.message || err);
    } finally {
      stopFeedbackSpinner("collectionSpinner");
      if (els.colCreate) els.colCreate.disabled = false;
    }
  });

  els.formAddLink?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (els.addSave?.disabled) return;
    syncAddTagsInput();
    const addStatusLine = ensureModalStatusLine(els.formAddLink, "addStatusLine");
    const fd = new FormData(els.formAddLink);
    const rawUrl = String(fd.get("url") || "").trim();
    const title = String(fd.get("title") || "").trim().slice(0, TITLE_MAX_LEN);
    const note = String(fd.get("note") || "").trim().slice(0, NOTE_MAX_LEN);
    if (title && title.length < TITLE_MIN_LEN) {
      feedback.addFlashCancel = flashStatus(
        addStatusLine,
        state.lang === "ru" ? `название: ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} символов` : `title: ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} chars`,
        "error",
        1400
      );
      return;
    }
    if (invalidTagChunks(fd.get("tags")).length) {
      feedback.addFlashCancel = flashStatus(
        addStatusLine,
        state.lang === "ru" ? `теги: ${TAG_MIN_LEN}-${TAG_MAX_LEN} символов` : `tags: ${TAG_MIN_LEN}-${TAG_MAX_LEN} chars`,
        "error",
        1400
      );
      return;
    }
    const url = toHttpUrl(rawUrl);
    if (!url) {
      feedback.addFlashCancel = flashStatus(
        addStatusLine,
        state.lang === "ru" ? "некорректный URL" : "invalid URL",
        "error",
        1400
      );
      return;
    }
    if (findDuplicateLink(url)) {
      feedback.addFlashCancel = flashStatus(
        addStatusLine,
        state.lang === "ru" ? "такая ссылка уже есть" : "link already exists",
        "info",
        1400
      );
      return;
    }

    const activeCollectionIsManual = state.activeCollectionId !== "all"
      && state.activeCollectionId !== "fav"
      && state.activeCollectionId !== "hidden"
      && state.activeCollectionId !== "recent"
      && !state.activeSavedFilterId
      && state.collections.some((c) => c.id === state.activeCollectionId);
    const inHiddenContext = state.activeCollectionId === "hidden";
    const selectedCollections = inHiddenContext
      ? []
      : activeCollectionIsManual
      ? [state.activeCollectionId]
      : fd.getAll("collections").map((x) => String(x)).filter((id) => state.collections.some((c) => c.id === id));
    if (els.addSave) els.addSave.disabled = true;
    stopFeedbackSpinner("addSpinner");
    feedback.addSpinner = startSpinner(
      els.addSave,
      state.lang === "ru" ? "Сохраняю..." : "Saving..."
    );
    try {
      const created = await createLink({
        url,
        title: title || domainFromUrl(url),
        note,
        tags: normalizeTags(fd.get("tags")),
        type: String(fd.get("type") || "") || null,
        source: String(fd.get("source") || "") || detectSourceFromUrl(url),
        favorite: !!fd.get("favorite"),
        hidden: inHiddenContext
      }, currentUser.id);
      if (created) {
        if (state.isUsingDemoData) {
          state.items = [];
          state.isUsingDemoData = false;
        }
        // For newly created links we only need INSERT into relation table.
        await addLinkCollections(created.id, selectedCollections, currentUser.id);
        state.items.unshift({ ...created, isDemo: false, previewImage: previewFallbackUrl(created.url), collectionIds: selectedCollections });
        stopFeedbackSpinner("addSpinner");
        feedback.addFlashCancel = flashStatus(
          addStatusLine,
          state.lang === "ru" ? "сохранено" : "saved",
          "ok",
          1000
        );
        setAddFlowStep(3);
        clearFeedbackTimer("addCloseTimer");
        feedback.addCloseTimer = setTimeout(() => closeAddModal(), 420);
        renderTagSuggestions();
      }
      requestRender();
    } catch (err) {
      stopFeedbackSpinner("addSpinner");
      feedback.addFlashCancel = flashStatus(
        addStatusLine,
        state.lang === "ru" ? "не удалось сохранить" : "save failed",
        "error",
        1400
      );
      console.warn("Create link failed", err?.message || err);
    } finally {
      stopFeedbackSpinner("addSpinner");
      if (els.addSave) els.addSave.disabled = false;
    }
  });

  els.inputAddUrl?.addEventListener("input", () => {
    updateAddSourceUi();
  });
  els.inputAddSource?.addEventListener("change", () => { sourceAutofillEnabled = false; });
  els.inputAddUrl?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (addFlowStep !== 1) return;
    const parsed = await parseAddUrl(els.inputAddUrl?.value || "");
    if (!parsed.ok && parsed.error !== "stale") {
      feedback.addFlashCancel = flashStatus(ensureModalStatusLine(els.formAddLink, "addStatusLine"), parsed.error, "error", 1400);
      return;
    }
    setAddFlowStep(2);
  });
  els.addBack?.addEventListener("click", () => {
    if (addFlowStep === 2) setAddFlowStep(1);
  });
  els.addSkip?.addEventListener("click", () => {
    if (addFlowStep !== 2) return;
    if (els.inputAddNote) els.inputAddNote.value = "";
    syncAddTagsInput();
    els.formAddLink?.requestSubmit();
  });
  els.addSave?.addEventListener("click", async () => {
    if (addFlowStep === 1) {
      const parsed = await parseAddUrl(els.inputAddUrl?.value || "");
      if (!parsed.ok && parsed.error !== "stale") {
        feedback.addFlashCancel = flashStatus(ensureModalStatusLine(els.formAddLink, "addStatusLine"), parsed.error, "error", 1400);
        return;
      }
      setAddFlowStep(2);
      return;
    }
    if (addFlowStep === 2) {
      syncAddTagsInput();
      els.formAddLink?.requestSubmit();
      return;
    }
    closeAddModal();
  });
  els.modalAddLink?.addEventListener("close", clearAddModalFeedback);
  els.modalCollection?.addEventListener("close", clearCollectionModalFeedback);
  els.addCloseX?.addEventListener("click", closeAddModal);
  els.addCancel?.addEventListener("click", closeAddModal);
  els.colCloseX?.addEventListener("click", () => { clearCollectionModalFeedback(); els.modalCollection?.close(); });
  els.colCancel?.addEventListener("click", () => { clearCollectionModalFeedback(); els.modalCollection?.close(); });

  window.addEventListener("dragover", (e) => {
    const types = e.dataTransfer?.types;
    if (!types || types.includes("text/resource-vault-item-id")) return;
    if (!types.includes("text/uri-list") && !types.includes("text/plain")) return;
    e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    const types = e.dataTransfer?.types;
    if (types?.includes("text/resource-vault-item-id")) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const url = firstHttpUrl(e.dataTransfer?.getData("text/uri-list")) || firstHttpUrl(e.dataTransfer?.getData("text/plain"));
    if (!url) return;
    e.preventDefault();
    openNewLinkModal({ url });
  });

  els.btnMobileMenu?.addEventListener("click", () => { if (mobileMq.matches) setMobileMenu(!state.ui.mobileMenuOpen); });
  els.btnMobileClose?.addEventListener("click", () => setMobileMenu(false));
  els.mobileOverlay?.addEventListener("click", () => setMobileMenu(false));
  mobileMq.addEventListener("change", (e) => { if (!e.matches) setMobileMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMobileMenu(false);
    const isShortcut = (e.ctrlKey || e.metaKey) && String(e.key || "").toLowerCase() === "k";
    if (isShortcut && els.searchInput) {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select?.();
    }
  });
}

function escapeHtml(str) {
  return String(str || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function bootstrap() {
  const settings = loadUiSettings();
  state.lang = settings.lang === "en" ? "en" : "ru";
  state.sortBy = FILTER_SORTS.has(settings.sortBy) ? settings.sortBy : "newest";
  state.ui.collectionOrderIds = Array.isArray(settings.collectionOrderIds) ? settings.collectionOrderIds : [];
  state.ui.pinnedCollectionIds = Array.isArray(settings.pinnedCollectionIds) ? settings.pinnedCollectionIds : [];
  applyTheme(THEME_MODES.has(settings.themeMode) ? settings.themeMode : "light");
  state.ui.filtersOpen = false;
  state.ui.mobileMenuOpen = false;

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", () => {
      if (state.themeMode === "system") {
        applyTheme("system");
        syncThemeToggle();
      }
    });
  }

  setupEvents();
  try { currentUser = await initAuth(); } catch (err) { console.warn("Auth failed", err?.message || err); }
  const authIssue = getAuthIssue();
  authIssueNotice = authIssue?.code === "SESSION_EXPIRED" ? t(state.lang, "sessionExpired") : "";
  state.isAuthenticated = !!currentUser?.id;
  state.currentUserId = currentUser?.id || "";
  if (currentUser?.id) {
    const statusLine = ensureStatusLine();
    stopFeedbackSpinner("pageSpinner");
    if (statusLine) {
      feedback.pageSpinner = startSpinner(
        statusLine,
        state.lang === "ru" ? "Загружаю..." : "Loading..."
      );
    }
    try {
      await loadData();
      if (!state.items.length && !state.collections.length) {
        await migrateLegacyIfNeeded();
        await loadData();
      }
      if (!state.items.length) {
        state.items = applyDemoPrefs(makeDemoLinks());
        state.isUsingDemoData = true;
      } else {
        state.isUsingDemoData = false;
      }
      stopFeedbackSpinner("pageSpinner");
      if (statusLine) statusLine.textContent = state.lang === "ru" ? "✓ загружено" : "✓ loaded";
    } catch (err) {
      console.warn("Load failed", err?.message || err);
      if (err?.code === "SESSION_EXPIRED") {
        authIssueNotice = t(state.lang, "sessionExpired");
        currentUser = null;
        state.isAuthenticated = false;
        state.currentUserId = "";
        state.items = applyDemoPrefs(makeDemoLinks());
        state.collections = [];
        state.savedFilters = [];
        state.activeSavedFilterId = null;
        state.isUsingDemoData = true;
      } else {
        state.items = applyDemoPrefs(makeDemoLinks());
        state.isUsingDemoData = true;
      }
      stopFeedbackSpinner("pageSpinner");
      if (statusLine) statusLine.textContent = state.lang === "ru" ? "✕ ошибка загрузки" : "✕ load error";
    }
  } else {
    stopFeedbackSpinner("pageSpinner");
    state.currentUserId = "";
    state.items = applyDemoPrefs(makeDemoLinks());
    state.isUsingDemoData = true;
    state.collections = [];
    state.savedFilters = [];
    state.activeSavedFilterId = null;
  }

  applyI18n();
  syncLanguageSelect();
  syncThemeToggle();
  if (els.sortSelect) els.sortSelect.value = state.sortBy;
  if (els.filterTagInput) els.filterTagInput.value = state.filters.tag;
  if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
  if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen;
  renderTagSuggestions();
  renderApp();

  if (ENABLE_AI_ONBOARDING && !onboardingController && els.btnAiOnboarding && els.modalOnboarding) {
    try {
      onboardingController = initOnboarding({
        triggerButton: els.btnAiOnboarding,
        modal: els.modalOnboarding,
        getLang: () => state.lang,
        ensureAuth,
        getAccessToken: async () => await getSessionAccessToken(),
        onImportResources: importOnboardingResources
      });
    } catch (err) {
      console.warn("Onboarding init failed", err?.message || err);
      if (els.btnAiOnboarding) {
        els.btnAiOnboarding.disabled = true;
        els.btnAiOnboarding.textContent = state.lang === "ru"
          ? "AI-онбординг (ошибка инициализации)"
          : "AI onboarding (init error)";
      }
    }
  }
}

void bootstrap();




