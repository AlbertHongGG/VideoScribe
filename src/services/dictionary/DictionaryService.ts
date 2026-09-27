import { commands, LookupResult } from "../../types/bindings";

/**
 * DictionaryService
 * Singleton service providing client-side LRU caching and in-flight request deduplication
 * for dictionary lookups, minimizing Tauri IPC overhead and delivering sub-millisecond responses.
 */
export class DictionaryService {
  private static instance: DictionaryService;
  private cache = new Map<string, LookupResult[]>();
  private inFlightRequests = new Map<string, Promise<LookupResult[]>>();
  private readonly maxCacheSize: number;

  private constructor(maxCacheSize = 300) {
    this.maxCacheSize = maxCacheSize;
  }

  public static getInstance(): DictionaryService {
    if (!DictionaryService.instance) {
      DictionaryService.instance = new DictionaryService();
    }
    return DictionaryService.instance;
  }

  private buildKey(text: string, charIndex: number): string {
    return `${text}:::${charIndex}`;
  }

  /**
   * Checks if an entry is already cached in memory.
   */
  public has(text: string, charIndex: number): boolean {
    return this.cache.has(this.buildKey(text, charIndex));
  }

  /**
   * Retrieves a cached result synchronously if present.
   */
  public getCached(text: string, charIndex: number): LookupResult[] | undefined {
    const key = this.buildKey(text, charIndex);
    const cached = this.cache.get(key);
    if (cached) {
      // Re-insert to maintain LRU order
      this.cache.delete(key);
      this.cache.set(key, cached);
    }
    return cached;
  }

  /**
   * Performs dictionary lookup with LRU caching and in-flight deduplication.
   */
  public async lookup(text: string, charIndex: number): Promise<LookupResult[]> {
    const key = this.buildKey(text, charIndex);

    // 1. Check LRU cache
    const cached = this.getCached(text, charIndex);
    if (cached) {
      return cached;
    }

    // 2. Check in-flight promise to avoid duplicate concurrent IPC calls
    const inFlight = this.inFlightRequests.get(key);
    if (inFlight) {
      return inFlight;
    }

    // 3. Initiate backend IPC lookup
    const requestPromise = (async () => {
      try {
        const res = await commands.lookupWord(text, charIndex);
        if (res.status === "ok") {
          const results = res.data;
          this.setCache(key, results);
          return results;
        }
        return [];
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }

  private setCache(key: string, results: LookupResult[]): void {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, results);
  }

  /**
   * Clears the in-memory cache.
   */
  public clearCache(): void {
    this.cache.clear();
    this.inFlightRequests.clear();
  }
}
