/**
 * School Context Caching Service
 * Caches expensive school context summaries to avoid re-fetching on every chat message
 * Cache TTL: 5 minutes
 */

interface CachedSchoolContext {
  context: string;
  timestamp: number;
  schoolId: string;
}

class SchoolContextCacheService {
  private cache: Map<string, CachedSchoolContext> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Get cached school context or fetch and cache if expired/missing
   */
  async getOrFetch(
    schoolId: string,
    fetchFn: () => Promise<string>
  ): Promise<string> {
    const now = Date.now();
    const cached = this.cache.get(schoolId);

    // Return cached if valid
    if (cached && (now - cached.timestamp) < this.TTL) {
      console.log(`[CONTEXT CACHE] ✅ Cache hit for school ${schoolId} (age: ${Math.round((now - cached.timestamp) / 1000)}s)`);
      return cached.context;
    }

    // Fetch fresh context
    console.log(`[CONTEXT CACHE] 🔄 Cache miss for school ${schoolId}, fetching...`);
    const context = await fetchFn();

    // Store in cache
    this.cache.set(schoolId, {
      context,
      timestamp: now,
      schoolId,
    });

    // Clean up old entries (simple garbage collection)
    this.cleanupExpiredEntries();

    return context;
  }

  /**
   * Invalidate cache for a specific school (useful after major data changes)
   */
  invalidate(schoolId: string): void {
    this.cache.delete(schoolId);
    console.log(`[CONTEXT CACHE] ❌ Invalidated cache for school ${schoolId}`);
  }

  /**
   * Clear all cached contexts
   */
  clearAll(): void {
    this.cache.clear();
    console.log(`[CONTEXT CACHE] 🧹 Cleared all cached contexts`);
  }

  /**
   * Remove expired entries from cache
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [schoolId, cached] of this.cache.entries()) {
      if ((now - cached.timestamp) >= this.TTL) {
        this.cache.delete(schoolId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[CONTEXT CACHE] 🧹 Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      totalEntries: this.cache.size,
      entries: Array.from(this.cache.values()).map(entry => ({
        schoolId: entry.schoolId,
        age: Math.round((Date.now() - entry.timestamp) / 1000),
      })),
    };
  }
}

// Export singleton instance
export const schoolContextCache = new SchoolContextCacheService();
