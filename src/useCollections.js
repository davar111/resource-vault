import { restPath, supabaseRequest } from "./supabase.js";

const COLLECTIONS_TABLE = "collections";
const LINK_COLLECTIONS_TABLE = "link_collections";

function mapCollection(row) {
  return {
    id: row.id,
    name: String(row.name || ""),
    description: String(row.description || ""),
    kind: "manual",
    createdAt: Date.parse(row.created_at || "") || Date.now(),
    updatedAt: Date.parse(row.created_at || "") || Date.now()
  };
}

export async function listCollections() {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "GET",
    query: { select: "id,name,description,created_at", order: "created_at.asc" }
  });
  return Array.isArray(rows) ? rows.map(mapCollection) : [];
}

export async function createCollection(input, userId) {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "POST",
    body: [{ user_id: userId, name: String(input.name || ""), description: input.description ? String(input.description) : null }],
    prefer: "return=representation"
  });
  return rows?.[0] ? mapCollection(rows[0]) : null;
}

export async function updateCollection(id, input) {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "id,name,description,created_at" },
    body: { name: String(input.name || ""), description: input.description ? String(input.description) : null },
    prefer: "return=representation"
  });
  return rows?.[0] ? mapCollection(rows[0]) : null;
}

export async function deleteCollection(id) {
  await supabaseRequest(restPath(COLLECTIONS_TABLE), { method: "DELETE", query: { id: `eq.${id}` } });
}

export async function listLinkCollections() {
  const rows = await supabaseRequest(restPath(LINK_COLLECTIONS_TABLE), {
    method: "GET",
    query: { select: "link_id,collection_id" }
  });
  return Array.isArray(rows) ? rows : [];
}

export async function replaceLinkCollections(linkId, collectionIds, userId) {
  await supabaseRequest(restPath(LINK_COLLECTIONS_TABLE), {
    method: "DELETE",
    query: { link_id: `eq.${linkId}` }
  });

  const uniqueIds = [...new Set((collectionIds || []).map((x) => String(x)).filter(Boolean))];
  if (!uniqueIds.length) return;

  await supabaseRequest(restPath(LINK_COLLECTIONS_TABLE), {
    method: "POST",
    body: uniqueIds.map((collectionId) => ({
      user_id: userId,
      link_id: linkId,
      collection_id: collectionId
    })),
    prefer: "return=minimal"
  });
}
