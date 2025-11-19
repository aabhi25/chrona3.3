interface ConversationMessage {
  id: string;
  userId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: Date;
  intent?: string;
  entities?: Record<string, any>;
}

/**
 * In-memory conversation storage for Chroney with 15-minute retention
 */
class ConversationMemoryService {
  private conversations: Map<string, ConversationMessage[]> = new Map();
  private readonly RETENTION_MINUTES = 15;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old conversations every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldConversations();
    }, 5 * 60 * 1000);
  }

  /**
   * Store a conversation message for a user
   */
  storeConversation(
    userId: string,
    userMessage: string,
    aiResponse: string,
    intent?: string,
    entities?: Record<string, any>
  ): void {
    const conversation: ConversationMessage = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userMessage,
      aiResponse,
      timestamp: new Date(),
      intent,
      entities
    };

    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, []);
    }

    const userConversations = this.conversations.get(userId)!;
    userConversations.push(conversation);

    // Keep only recent conversations (cleanup per user)
    this.cleanupUserConversations(userId);

    // Reduced logging to avoid PII exposure
    console.log(`[CONVERSATION] Stored conversation for user ${userId} (${userMessage.length} chars)`);
  }

  /**
   * Get conversation history for a user from the last 15 minutes
   */
  getConversationHistory(userId: string): ConversationMessage[] {
    const userConversations = this.conversations.get(userId) || [];
    const cutoffTime = new Date(Date.now() - this.RETENTION_MINUTES * 60 * 1000);

    const recentConversations = userConversations.filter(
      conv => conv.timestamp > cutoffTime
    );

    console.log(`[CONVERSATION] Retrieved ${recentConversations.length} recent conversations for user ${userId}`);
    return recentConversations;
  }

  /**
   * Format conversation history for LLAMA context
   */
  formatConversationContext(userId: string): string {
    const history = this.getConversationHistory(userId);
    
    if (history.length === 0) {
      return "";
    }

    const contextLines = history.map(conv => {
      const timeAgo = Math.round((Date.now() - conv.timestamp.getTime()) / 60000);
      return `[${timeAgo}m ago]\nUser: ${conv.userMessage}\nChroney: ${conv.aiResponse}`;
    });

    return `\n\n**Recent Conversation Context (last ${this.RETENTION_MINUTES} minutes):**\n${contextLines.join('\n\n')}\n\n**Current conversation:**`;
  }

  /**
   * Get conversation statistics for a user
   */
  getConversationStats(userId: string): {
    totalMessages: number;
    timespan: string;
    oldestMessage?: Date;
    newestMessage?: Date;
  } {
    const history = this.getConversationHistory(userId);
    
    if (history.length === 0) {
      return {
        totalMessages: 0,
        timespan: "No recent conversations"
      };
    }

    const oldestMessage = history[0].timestamp;
    const newestMessage = history[history.length - 1].timestamp;
    const timespanMinutes = Math.round((newestMessage.getTime() - oldestMessage.getTime()) / 60000);

    return {
      totalMessages: history.length,
      timespan: timespanMinutes > 0 ? `${timespanMinutes} minutes` : "Less than a minute",
      oldestMessage,
      newestMessage
    };
  }

  /**
   * Clean up conversations older than retention period for a specific user
   */
  private cleanupUserConversations(userId: string): void {
    const userConversations = this.conversations.get(userId);
    if (!userConversations) return;

    const cutoffTime = new Date(Date.now() - this.RETENTION_MINUTES * 60 * 1000);
    const recentConversations = userConversations.filter(
      conv => conv.timestamp > cutoffTime
    );

    this.conversations.set(userId, recentConversations);
  }

  /**
   * Clean up old conversations for all users
   */
  private cleanupOldConversations(): void {
    const cutoffTime = new Date(Date.now() - this.RETENTION_MINUTES * 60 * 1000);
    let totalCleaned = 0;

    for (const [userId, conversations] of Array.from(this.conversations.entries())) {
      const beforeCount = conversations.length;
      const recentConversations = conversations.filter(
        (conv: ConversationMessage) => conv.timestamp > cutoffTime
      );
      
      if (recentConversations.length === 0) {
        // Remove user completely if no recent conversations
        this.conversations.delete(userId);
      } else {
        this.conversations.set(userId, recentConversations);
      }
      
      totalCleaned += beforeCount - recentConversations.length;
    }

    if (totalCleaned > 0) {
      console.log(`[CONVERSATION] Cleaned up ${totalCleaned} old conversation messages`);
    }
  }

  /**
   * Clear all conversations for a user (for testing or privacy)
   */
  clearUserConversations(userId: string): void {
    this.conversations.delete(userId);
    console.log(`[CONVERSATION] Cleared all conversations for user ${userId}`);
  }

  /**
   * Get current memory usage statistics
   */
  getMemoryStats(): {
    totalUsers: number;
    totalConversations: number;
    memoryUsage: string;
  } {
    const totalUsers = this.conversations.size;
    let totalConversations = 0;
    
    for (const conversations of Array.from(this.conversations.values())) {
      totalConversations += conversations.length;
    }

    // Rough memory estimation (each conversation ~1KB)
    const estimatedMemoryKB = totalConversations * 1;
    const memoryUsage = estimatedMemoryKB > 1024 
      ? `${(estimatedMemoryKB / 1024).toFixed(2)} MB`
      : `${estimatedMemoryKB} KB`;

    return {
      totalUsers,
      totalConversations,
      memoryUsage
    };
  }

  /**
   * Cleanup resources when shutting down
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.conversations.clear();
  }
}

// Create singleton instance
export const conversationMemory = new ConversationMemoryService();

// Graceful shutdown cleanup
process.on('SIGTERM', () => {
  conversationMemory.destroy();
});

process.on('SIGINT', () => {
  conversationMemory.destroy();
});

export default conversationMemory;