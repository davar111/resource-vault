import { restPath, supabaseRequest } from "./supabase.js";

const TABLE = "user_space_stats";

function toDateKey(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function toNonNegativeInt(value) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function mapRow(row) {
  return {
    userId: String(row.user_id || ""),
    dailyDone: toNonNegativeInt(row.daily_done),
    streakDays: toNonNegativeInt(row.streak_days),
    lastActionDate: toDateKey(row.last_action_date),
    lastStreakDate: toDateKey(row.last_streak_date),
    updatedAt: Date.parse(row.updated_at || "") || Date.now()
  };
}

export async function getSpaceStats(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const rows = await supabaseRequest(restPath(TABLE), {
    method: "GET",
    query: {
      select: "user_id,daily_done,streak_days,last_action_date,last_streak_date,updated_at",
      user_id: `eq.${uid}`,
      limit: 1
    }
  });

  return rows?.[0] ? mapRow(rows[0]) : null;
}

export async function upsertSpaceStats(userId, input = {}) {
  const uid = String(userId || "").trim();
  if (!uid) return null;

  const payload = {
    user_id: uid,
    daily_done: toNonNegativeInt(input.dailyDone),
    streak_days: toNonNegativeInt(input.streakDays),
    last_action_date: toDateKey(input.lastActionDate) || null,
    last_streak_date: toDateKey(input.lastStreakDate) || null,
    updated_at: new Date().toISOString()
  };

  const rows = await supabaseRequest(restPath(TABLE), {
    method: "POST",
    query: {
      on_conflict: "user_id",
      select: "user_id,daily_done,streak_days,last_action_date,last_streak_date,updated_at"
    },
    body: [payload],
    prefer: "resolution=merge-duplicates,return=representation"
  });

  return rows?.[0] ? mapRow(rows[0]) : null;
}
