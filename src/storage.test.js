import test from "node:test";
import assert from "node:assert/strict";
import { migrateToV4 } from "./storage.js";

test("migrateToV4 converts single collectionId into collectionIds array", () => {
  const raw = {
    version: 3,
    items: [
      {
        id: "l1",
        url: "https://example.com",
        title: "Example",
        collectionId: "c1",
        tags: [" Design ", "design"],
        type: "project",
        source: "site"
      }
    ],
    collections: [{ id: "c1", name: "Manual one" }]
  };

  const migrated = migrateToV4(raw);
  assert.equal(migrated.items.length, 1);
  assert.deepEqual(migrated.items[0].collectionIds, ["c1"]);
  assert.deepEqual(migrated.items[0].tags, ["design"]);
});

test("migrateToV4 converts legacy collections to manual folders", () => {
  const raw = {
    version: 3,
    items: [],
    collections: [
      { id: "c1", name: "Manual no rules" },
      { id: "c2", name: "Smart by rule", rules: { tagsAll: ["Fintech"] } }
    ]
  };

  const migrated = migrateToV4(raw);
  const c1 = migrated.collections.find((c) => c.id === "c1");
  const c2 = migrated.collections.find((c) => c.id === "c2");

  assert.equal(c1.kind, "manual");
  assert.equal(c1.rules, undefined);
  assert.equal(c2.kind, "manual");
  assert.equal(c2.rules, undefined);
});
