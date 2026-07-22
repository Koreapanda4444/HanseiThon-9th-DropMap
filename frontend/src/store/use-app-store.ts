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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedCategoryId: "all",
      selectedFacilityId: null,
      favoriteIds: [],
      recentSearches: [],
      setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
      setSelectedFacilityId: (selectedFacilityId) => set({ selectedFacilityId }),
      toggleFavorite: (id) => set((state) => ({
        favoriteIds: state.favoriteIds.includes(id)
          ? state.favoriteIds.filter((favoriteId) => favoriteId !== id)
          : [...state.favoriteIds, id],
      })),
      addRecentSearch: (query) => set((state) => ({
        recentSearches: [query, ...state.recentSearches.filter((item) => item !== query)].slice(0, 6),
      })),
      removeRecentSearch: (query) => set((state) => ({
        recentSearches: state.recentSearches.filter((item) => item !== query),
      })),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "beoril-map-preferences",
      skipHydration: true,
      partialize: (state) => ({ favoriteIds: state.favoriteIds, recentSearches: state.recentSearches }),
    },
  ),
);
