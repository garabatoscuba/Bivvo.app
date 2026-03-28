import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { getAllFromStore, putManyInStore, clearStore } from '@/lib/offlineDb';

interface OfflineQueryOptions<T> {
  queryKey: any[];
  /** The Supabase fetch function — called when online */
  onlineFn: () => Promise<T[]>;
  /** IndexedDB store name for caching/fallback */
  storeName: string;
  /** Optional index to filter cached results */
  indexName?: string;
  indexValue?: string;
  /** Whether to clear the store before writing (default true) */
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
      const cached = await getAllFromStore<T>(storeName, indexName, indexValue);
      return cached;
    },
    enabled,
    staleTime,
  });
}
