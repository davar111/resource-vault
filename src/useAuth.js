import { completeAuthFromUrl, getCurrentUser, signInWithGoogle, signOut } from "./supabase.js";

export async function initAuth() {
  await completeAuthFromUrl();
  return await getCurrentUser();
}

export function loginWithGoogle() {
  return signInWithGoogle();
}

export async function logout() {
  await signOut();
}
