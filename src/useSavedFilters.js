import { restPath, supabaseRequest } from "./supabase.js";

const TABLE = "saved_filters";

function mapRow(row) {
  return {
    id: row.id,
    name: String(row.name || ""),
    filter: row.filter && typeof row.filter === "object" ? row.filter : {},
    createdAt: Date.parse(row.created_at || "") || Date.now()
  };
}

export async function listSavedFilters() {
  const rows = await supabaseRequest(restPath(TABLE), {
    method: "GET",
    query: { select: "id,name,filter,created_at", order: "created_at.asc" }
  });
  return Array.isArray(rows) ? rows.map(mapRow) : [];
}

export async function createSavedFilter(input, userId) {
  const rows = await supabaseRequest(restPath(TABLE), {
    method: "POST",
    body: [{ user_id: userId, name: String(input.name || ""), filter: input.filter || {} }],
    prefer: "return=representation"
  });
  return rows?.[0] ? mapRow(rows[0]) : null;
}

export async function updateSavedFilter(id, input) {
  const rows = await supabaseRequest(restPath(TABLE), {
    method: "PATCH",
    query: { id: `eq.${id}`, select: "id,name,filter,created_at" },
    body: { name: String(input.name || ""), filter: input.filter || {} },
    prefer: "return=representation"
  });
  return rows?.[0] ? mapRow(rows[0]) : null;
}

export async function deleteSavedFilter(id) {
  await supabaseRequest(restPath(TABLE), {
    method: "DELETE",
    query: { id: `eq.${id}` }
  });
}
