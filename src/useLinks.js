import { normalizeTags } from "./filter.js";
import { normalizeSourceCode, normalizeTypeCode } from "./domain.js";
import { restPath, supabaseRequest } from "./supabase.js";

const TABLE = "links";

function mapRow(row) {
  const preview = String(row.preview_image || "").trim();
  return {
    id: row.id,
    ownerId: String(row.user_id || ""),
    url: String(row.url || ""),
    title: String(row.title || ""),
    note: String(row.note || ""),
    tags: normalizeTags(row.tags || []),
    type: normalizeTypeCode(row.type),
    source: normalizeSourceCode(row.source),
    favorite: !!row.favorite,
    hidden: !!row.is_hidden,
    createdAt: Date.parse(row.created_at || "") || Date.now(),
    updatedAt: Date.parse(row.updated_at || row.created_at || "") || Date.now(),
    previewImage: preview || null
  };
}

export async function listLinks() {
  const rows = await supabaseRequest(restPath(TABLE), {
    method: "GET",
    query: {
      select: "id,user_id,url,preview_image,title,note,tags,type,source,favorite,is_hidden,created_at,updated_at",
      order: "created_at.desc"
    }
  });
  return Array.isArray(rows) ? rows.map(mapRow) : [];
}

export async function createLink(input, userId) {
  const payload = {
    user_id: userId,
    url: String(input.url || ""),
    preview_image: input.previewImage || null,
    title: input.title ? String(input.title) : null,
    note: input.note ? String(input.note) : null,
    tags: normalizeTags(input.tags || []),
    type: normalizeTypeCode(input.type),
    source: normalizeSourceCode(input.source) || "other",
    favorite: !!input.favorite,
    is_hidden: !!input.hidden,
    updated_at: new Date().toISOString()
  };

  const rows = await supabaseRequest(restPath(TABLE), {
    method: "POST",
    body: [payload],
    prefer: "return=representation"
  });

  return rows?.[0] ? mapRow(rows[0]) : null;
}

export async function updateLink(id, input) {
  const payload = {
    url: String(input.url || ""),
    title: input.title ? String(input.title) : null,
    note: input.note ? String(input.note) : null,
    tags: normalizeTags(input.tags || []),
    type: normalizeTypeCode(input.type),
    source: normalizeSourceCode(input.source) || "other",
    favorite: !!input.favorite,
    is_hidden: !!input.hidden,
    updated_at: new Date().toISOString()
  };

  const rows = await supabaseRequest(restPath(TABLE), {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "id,user_id,url,preview_image,title,note,tags,type,source,favorite,is_hidden,created_at,updated_at" },
    body: payload,
    prefer: "return=representation"
  });

  return rows?.[0] ? mapRow(rows[0]) : null;
}

export async function deleteLink(id) {
  await supabaseRequest(restPath(TABLE), {
    method: "DELETE",
    query: { id: `eq.${id}` }
  });
}
