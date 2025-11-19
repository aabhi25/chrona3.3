/**
 * Tool Result Caching Service - Phase 2
 * Provides intelligent caching for tool execution results to reduce redundant queries
 */

export interface CacheEntry {
  key: string;
  result: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  toolName: string;
  parameters: any;
}

export class ToolCacheService {
  private static cache: Map<string, CacheEntry> = new Map();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default
  
  // Tool-specific TTL configurations (in milliseconds) - OPTIMIZED for performance
  private static readonly TOOL_TTL_CONFIG: Record<string, number> = {
    // Fast-changing data (2 minutes - increased from 30s for better cache hits)
    'fetch_attendance_stats': 2 * 60 * 1000,
    'fetch_messages': 1 * 60 * 1000, // Messages should stay fresh
    'fetch_leave_requests': 2 * 60 * 1000,
    'query_school_data': 2 * 60 * 1000, // Increased for better performance
    'fetch_student_attendance': 2 * 60 * 1000,
    
    // Moderate-changing data (10 minutes - increased from 5 for better performance)
    'fetch_student_profile': 10 * 60 * 1000,
    'fetch_teacher_profile': 10 * 60 * 1000,
    'fetch_timetable': 10 * 60 * 1000,
    'fetch_fee_data': 10 * 60 * 1000,
    'fetch_school_insights': 10 * 60 * 1000,
    
    // Slow-changing data (20 minutes - increased from 15 for better performance)
    'fetch_teachers': 20 * 60 * 1000,
    'fetch_students': 20 * 60 * 1000,
    'fetch_classes': 20 * 60 * 1000,
    'fetch_transport_data': 20 * 60 * 1000,
    'list_entities': 20 * 60 * 1000,
    
    // Reports and analytics (15 minutes - increased from 10 for better performance)
    'generate_report': 15 * 60 * 1000,
    
    // PHASE 3: Advanced reporting and batch operations (longer TTL)
    'generate_excel_export': 5 * 60 * 1000, // 5 minutes - increased from 2 for better cache
    'analyze_trends': 15 * 60 * 1000, // 15 minutes - increased from 10 for expensive operations
    // bulk_update is not cached (write operation)
    
    // PHASE 4: Predictive analytics and smart recommendations (aggressive caching)
    'predict_attendance': 20 * 60 * 1000, // 20 minutes - predictions are expensive to compute
    'recommend_schedule_optimization': 30 * 60 * 1000, // 30 minutes - very expensive optimization
    'generate_insights_report': 15 * 60 * 1000, // 15 minutes - comprehensive reports
    'detect_anomalies': 20 * 60 * 1000, // 20 minutes - statistical analysis is expensive
    'suggest_teacher_assignments': 30 * 60 * 1000, // 30 minutes - complex workload optimization
  };

  /**
   * Generate a unique cache key for a tool call
   */
  private static generateCacheKey(
    toolName: string,
    parameters: any,
    schoolId: string
  ): string {
    // Normalize parameters to ensure consistent ordering
    const normalizedParams = JSON.stringify(this.normalizeObject(parameters));
    return `${toolName}:${schoolId}:${normalizedParams}`;
  }

  /**
   * Normalize object keys for consistent cache keys
   */
  private static normalizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const sortedObj: any = {};
      Object.keys(obj).sort().forEach(key => {
        sortedObj[key] = this.normalizeObject(obj[key]);
      });
      return sortedObj;
    }
    
    return obj;
  }

  /**
   * Get cached result if available and not expired
   */
  static get(
    toolName: string,
    parameters: any,
    schoolId: string
  ): any | null {
    const key = this.generateCacheKey(toolName, parameters, schoolId);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      console.log(`[CACHE] Expired: ${toolName}`);
      this.cache.delete(key);
      return null;
    }

    console.log(`[CACHE] Hit: ${toolName} (${((now - entry.timestamp) / 1000).toFixed(1)}s old)`);
    return entry.result;
  }

  /**
   * Store result in cache
   */
  static set(
    toolName: string,
    parameters: any,
    schoolId: string,
    result: any
  ): void {
    const key = this.generateCacheKey(toolName, parameters, schoolId);
    const ttl = this.TOOL_TTL_CONFIG[toolName] || this.DEFAULT_TTL;

    const entry: CacheEntry = {
      key,
      result,
      timestamp: Date.now(),
      ttl,
      toolName,
      parameters,
    };

    this.cache.set(key, entry);
    console.log(`[CACHE] Set: ${toolName} (TTL: ${ttl / 1000}s)`);

    // Clean up expired entries periodically
    this.cleanupExpired();
  }

  /**
   * Invalidate cache for a specific tool or all tools
   */
  static invalidate(
    toolName?: string,
    schoolId?: string
  ): void {
    if (!toolName) {
      // Clear entire cache
      console.log(`[CACHE] Clearing all cache`);
      this.cache.clear();
      return;
    }

    // Clear specific tool or tool+school combination
    const keysToDelete: string[] = [];
    this.cache.forEach((entry, key) => {
      const matches = entry.toolName === toolName && 
        (!schoolId || key.includes(`:${schoolId}:`));
      if (matches) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[CACHE] Invalidated ${keysToDelete.length} entries for ${toolName}`);
  }

  /**
   * Invalidate cache entries related to data mutations
   */
  static invalidateRelated(mutationToolName: string, schoolId: string): void {
    // Map write operations to read operations that should be invalidated
    const invalidationMap: Record<string, string[]> = {
      'mark_attendance': [
        'fetch_attendance_stats',
        'query_school_data',
        'generate_report'
      ],
      'bulk_mark_attendance': [
        'fetch_attendance_stats',
        'query_school_data',
        'generate_report'
      ],
    };

    const toolsToInvalidate = invalidationMap[mutationToolName] || [];
    toolsToInvalidate.forEach(toolName => {
      this.invalidate(toolName, schoolId);
    });

    if (toolsToInvalidate.length > 0) {
      console.log(`[CACHE] Invalidated related tools for ${mutationToolName}`);
    }
  }

  /**
   * Clean up expired entries
   */
  private static cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[CACHE] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): {
    totalEntries: number;
    byTool: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const byTool: Record<string, number> = {};
    let oldestTimestamp = Number.MAX_SAFE_INTEGER;
    let newestTimestamp = 0;

    this.cache.forEach(entry => {
      byTool[entry.toolName] = (byTool[entry.toolName] || 0) + 1;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
      newestTimestamp = Math.max(newestTimestamp, entry.timestamp);
    });

    return {
      totalEntries: this.cache.size,
      byTool,
      oldestEntry: this.cache.size > 0 ? oldestTimestamp : null,
      newestEntry: this.cache.size > 0 ? newestTimestamp : null,
    };
  }

  /**
   * Check if caching is enabled for a tool
   */
  static isCacheable(toolName: string): boolean {
    // Don't cache write operations
    const nonCacheablePatterns = [
      'mark_attendance',
      'bulk_mark_attendance',
      'create_',
      'update_',
      'delete_',
    ];

    return !nonCacheablePatterns.some(pattern => 
      toolName.toLowerCase().includes(pattern)
    );
  }
}
