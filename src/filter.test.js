import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTags, matchesLink, toHttpUrl } from "./filter.js";

test("normalizeTags trims, lowercases, removes empties and duplicates", () => {
  assert.deepEqual(
    normalizeTags("  Design,FINTECH, design, , Motion  ,"),
    ["design", "fintech", "motion"]
  );
});

test("normalizeTags supports string array input", () => {
  assert.deepEqual(
    normalizeTags(["  UI  ", "ui", "", "CaseStudy "]),
    ["ui", "casestudy"]
  );
});

test("matchesLink applies OR inside types/sources and AND between blocks", () => {
  const link = {
    title: "Fintech platform",
    url: "https://example.com",
    note: "",
    favorite: false,
    type: "Project",
    source: "Behance",
    tags: ["fintech", "dark"]
  };

  assert.equal(matchesLink(link, { types: ["Project", "Studio"] }), true);
  assert.equal(matchesLink(link, { types: ["Studio", "Designer"] }), false);
  assert.equal(matchesLink(link, { types: ["Project"], sources: ["Behance", "Site"] }), true);
  assert.equal(matchesLink(link, { types: ["Project"], sources: ["Site"] }), false);
});

test("matchesLink requiredTags uses every and anyTags uses some", () => {
  const link = {
    title: "",
    url: "https://example.com",
    note: "",
    favorite: false,
    type: null,
    source: null,
    tags: ["dark", "fintech", "saas"]
  };

  assert.equal(matchesLink(link, { requiredTags: ["dark", "fintech"] }), true);
  assert.equal(matchesLink(link, { requiredTags: ["dark", "mobile"] }), false);
  assert.equal(matchesLink(link, { anyTags: ["mobile", "saas"] }), true);
  assert.equal(matchesLink(link, { anyTags: ["mobile", "ios"] }), false);
});

test("matchesLink supports containsText over title/url/note/tags and onlyFavorites", () => {
  const link = {
    title: "",
    url: "https://dribbble.com/shots/abc",
    note: "Great motion",
    favorite: true,
    type: null,
    source: "Dribbble",
    tags: ["motion", "dark"]
  };

  assert.equal(matchesLink(link, { containsText: "dribbble" }), true);
  assert.equal(matchesLink(link, { containsText: "great" }), true);
  assert.equal(matchesLink(link, { containsText: "MOTION" }), true);
  assert.equal(matchesLink(link, { containsText: "typography" }), false);
  assert.equal(matchesLink(link, { onlyFavorites: true }), true);
  assert.equal(matchesLink({ ...link, favorite: false }, { onlyFavorites: true }), false);
});

test("matchesLink tagContains works as case-insensitive substring over tags", () => {
  const link = {
    title: "Title",
    url: "https://example.com",
    note: "",
    favorite: false,
    type: null,
    source: null,
    tags: ["FinTech", "DarkUi"]
  };

  assert.equal(matchesLink(link, { tagContains: "tech" }), true);
  assert.equal(matchesLink(link, { tagContains: "UI" }), true);
  assert.equal(matchesLink(link, { tagContains: "xyz" }), false);
  assert.equal(matchesLink({ ...link, tags: [] }, { tagContains: "ui" }), false);
});

test("toHttpUrl accepts only http and https protocols", () => {
  assert.equal(toHttpUrl("https://example.com"), "https://example.com/");
  assert.equal(toHttpUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(toHttpUrl("javascript:evil(1)"), "");
  assert.equal(toHttpUrl("data:text/html,<svg/onload=1>"), "");
  assert.equal(toHttpUrl(""), "");
});
