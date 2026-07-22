import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FacilityCategoryId } from "@/types/domain";

interface AppState {
  selectedCategoryId: FacilityCategoryId | "all";
  selectedFacilityId: string | null;
  favoriteIds: string[];
  recentSearches: string[];
  setSelectedCategoryId: (id: FacilityCategoryId | "all") => void;
  setSelectedFacilityId: (id: string | null) => void;
  toggleFavorite: (id: string) => void;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

function stringList(value: unknown, maximumItems: number, maximumLength: number, pattern?: RegExp) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const text = item.replace(/\s+/g, " ").trim().slice(0, maximumLength);
    return text && (!pattern || pattern.test(text)) ? [text] : [];
  }))].slice(0, maximumItems);
}

function savedPreferences(value: unknown) {
  const record = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    favoriteIds: stringList(record.favoriteIds, 1000, 16, /^\d+$/)
      .filter((id) => Number.isSafeInteger(Number(id)) && Number(id) > 0),
    recentSearches: stringList(record.recentSearches, 6, 200),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedCategoryId: "all",
      selectedFacilityId: null,
      favoriteIds: [],
      recentSearches: [],
      setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
      setSelectedFacilityId: (selectedFacilityId) => set({ selectedFacilityId }),
      toggleFavorite: (value) => set((state) => {
        const id = stringList([value], 1, 16, /^\d+$/)[0];
        if (!id || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return { favoriteIds: state.favoriteIds };
        return {
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
            : [...state.favoriteIds, id].slice(-1000),
        };
      }),
      addRecentSearch: (value) => set((state) => {
        const query = stringList([value], 1, 200)[0];
        return query
          ? { recentSearches: [query, ...state.recentSearches.filter((item) => item !== query)].slice(0, 6) }
          : { recentSearches: state.recentSearches };
      }),
      removeRecentSearch: (query) => set((state) => ({
        recentSearches: state.recentSearches.filter((item) => item !== query),
      })),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "beoril-map-preferences",
      version: 1,
      skipHydration: true,
      partialize: (state) => ({ favoriteIds: state.favoriteIds, recentSearches: state.recentSearches }),
      merge: (persisted, current) => ({ ...current, ...savedPreferences(persisted) }),
    },
  ),
);
