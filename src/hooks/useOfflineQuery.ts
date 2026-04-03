import { useQuery } from '@tanstack/react-query';
import { getAllFromStore, getFilteredFromStore, putManyInStore, clearStore } from '@/lib/offlineDb';

interface OfflineQueryOptions<T> {
  queryKey: any[];
  /** The Supabase fetch function — called when online */
  onlineFn: () => Promise<T[]>;
  /** IndexedDB store name for caching/fallback */
  storeName: string;
  /** Optional index to filter cached results */
  indexName?: string;
  indexValue?: string;
  /** JS filter applied on IndexedDB results (for date filtering etc.) */
  offlineFilter?: (item: T) => boolean;
  /** Whether to clear the store before writing (default false) */
  replaceAll?: boolean;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Generic hook that fetches from Supabase when online and falls back
 * to IndexedDB when offline or when the fetch fails.
 * On successful online fetch it caches results into IndexedDB.
 */
export function useOfflineQuery<T>({
  queryKey,
  onlineFn,
  storeName,
  indexName,
  indexValue,
  offlineFilter,
  replaceAll = false,
  enabled = true,
  staleTime,
}: OfflineQueryOptions<T>) {
  return useQuery({
    queryKey,
    queryFn: async (): Promise<T[]> => {
      // Try online first
      if (navigator.onLine) {
        try {
          const data = await onlineFn();
          // Cache to IndexedDB
          if (data && data.length > 0) {
            if (replaceAll) {
              await clearStore(storeName);
            }
            await putManyInStore(storeName, data as any[]);
          }
          return data;
        } catch (err) {
          console.warn(`[useOfflineQuery:${storeName}] Online fetch failed, using cache:`, err);
        }
      }

      // Fallback to IndexedDB
      if (indexName && indexValue) {
        const cached = await getFilteredFromStore<T>(storeName, indexName, indexValue, offlineFilter);
        return cached;
      }
      const cached = await getAllFromStore<T>(storeName);
      return offlineFilter ? cached.filter(offlineFilter) : cached;
    },
    enabled,
    staleTime,
  });
}
