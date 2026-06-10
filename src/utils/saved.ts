const SAVED_KEY = "nd_saved_listings";

export function getSavedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function toggleSaved(id: string): boolean {
  const saved = getSavedIds();
  const idx = saved.indexOf(id);
  if (idx === -1) {
    saved.push(id);
    localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    return true;
  }
  saved.splice(idx, 1);
  localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  return false;
}
