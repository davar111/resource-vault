import { restPath, supabaseRequest } from "./supabase.js";

const COLLECTIONS_TABLE = "collections";
const LINK_COLLECTIONS_TABLE = "link_collections";
const COLLECTION_INVITES_TABLE = "collection_invites";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mapCollection(row) {
  return {
    id: row.id,
    ownerId: String(row.user_id || ""),
    name: String(row.name || ""),
    description: String(row.description || ""),
    isShared: !!row.is_shared,
    kind: "manual",
    createdAt: Date.parse(row.created_at || "") || Date.now(),
    updatedAt: Date.parse(row.created_at || "") || Date.now()
  };
}

export async function listCollections() {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "GET",
    query: { select: "id,user_id,name,description,is_shared,created_at", order: "created_at.asc" }
  });
  return Array.isArray(rows) ? rows.map(mapCollection) : [];
}

export async function createCollection(input, userId) {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "POST",
    body: [{
      user_id: userId,
      name: String(input.name || ""),
      description: input.description ? String(input.description) : null,
      is_shared: !!input.isShared
    }],
    prefer: "return=representation"
  });
  return rows?.[0] ? mapCollection(rows[0]) : null;
}

export async function updateCollection(id, input) {
  const rows = await supabaseRequest(restPath(COLLECTIONS_TABLE), {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "id,user_id,name,description,is_shared,created_at" },
    body: {
      name: String(input.name || ""),
      description: input.description ? String(input.description) : null,
      is_shared: !!input.isShared
    },
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
  const uniqueIds = [...new Set((collectionIds || []).map((x) => String(x)).filter(Boolean))];
  await supabaseRequest(restPath("rpc/replace_link_collections"), {
    method: "POST",
    body: {
      p_link_id: linkId,
      p_collection_ids: uniqueIds
    },
    prefer: "return=minimal"
  });
}

export async function addLinkCollections(linkId, collectionIds, userId) {
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

export async function createCollectionInvite(collectionId, email, ownerUserId) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const rows = await supabaseRequest(restPath(COLLECTION_INVITES_TABLE), {
    method: "POST",
    body: [{
      collection_id: collectionId,
      owner_user_id: ownerUserId,
      invitee_email: normalized
    }],
    prefer: "return=representation"
  });
  return rows?.[0] || null;
}
