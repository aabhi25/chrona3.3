/**
 * Conversation Context Service - Phase 2
 * Provides intelligent context tracking for multi-turn conversations
 */

export interface EntityReference {
  type: 'student' | 'teacher' | 'class' | 'subject' | 'route' | 'vehicle';
  id: string;
  name: string;
  mentionedAt: number;
}

export interface ConversationContext {
  userId: string;
  recentEntities: EntityReference[];
  lastToolCalls: Array<{
    toolName: string;
    parameters: any;
    result: any;
    timestamp: number;
  }>;
  conversationTopic?: string;
  lastUpdated: number;
}

export class ConversationContextService {
  private static contexts: Map<string, ConversationContext> = new Map();
  private static readonly MAX_ENTITY_HISTORY = 10;
  private static readonly MAX_TOOL_HISTORY = 5;
  private static readonly CONTEXT_TTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Get or create conversation context for a user
   */
  static getContext(userId: string): ConversationContext {
    let context = this.contexts.get(userId);
    
    if (!context || Date.now() - context.lastUpdated > this.CONTEXT_TTL) {
      context = {
        userId,
        recentEntities: [],
        lastToolCalls: [],
        lastUpdated: Date.now(),
      };
      this.contexts.set(userId, context);
    }

    return context;
  }

  /**
   * Add entity reference to context
   */
  static addEntityReference(
    userId: string,
    type: EntityReference['type'],
    id: string,
    name: string
  ): void {
    const context = this.getContext(userId);
    
    // Remove duplicate references
    context.recentEntities = context.recentEntities.filter(
      e => !(e.type === type && e.id === id)
    );

    // Add new reference at the front
    context.recentEntities.unshift({
      type,
      id,
      name,
      mentionedAt: Date.now(),
    });

    // Keep only recent entities
    context.recentEntities = context.recentEntities.slice(0, this.MAX_ENTITY_HISTORY);
    context.lastUpdated = Date.now();
  }

  /**
   * Add tool call to context history
   */
  static addToolCall(
    userId: string,
    toolName: string,
    parameters: any,
    result: any
  ): void {
    const context = this.getContext(userId);

    context.lastToolCalls.unshift({
      toolName,
      parameters,
      result,
      timestamp: Date.now(),
    });

    // Keep only recent tool calls
    context.lastToolCalls = context.lastToolCalls.slice(0, this.MAX_TOOL_HISTORY);
    context.lastUpdated = Date.now();

    // Extract entities from tool results
    this.extractEntitiesFromToolResult(userId, toolName, result);
  }

  /**
   * Extract entity references from tool results
   */
  private static extractEntitiesFromToolResult(
    userId: string,
    toolName: string,
    result: any
  ): void {
    if (!result.success || !result.data) return;

    const data = result.data;

    // Extract student references
    if (toolName.includes('student') || Array.isArray(data)) {
      const students = Array.isArray(data) ? data : [data];
      students.forEach(student => {
        if (student.id && (student.name || student.firstName)) {
          this.addEntityReference(
            userId,
            'student',
            student.id,
            student.name || `${student.firstName} ${student.lastName}`
          );
        }
      });
    }

    // Extract teacher references
    if (toolName.includes('teacher') || Array.isArray(data)) {
      const teachers = Array.isArray(data) ? data : [data];
      teachers.forEach(teacher => {
        if (teacher.id && teacher.name) {
          this.addEntityReference(
            userId,
            'teacher',
            teacher.id,
            teacher.name
          );
        }
      });
    }

    // Extract class references
    if (toolName.includes('class') || Array.isArray(data)) {
      const classes = Array.isArray(data) ? data : [data];
      classes.forEach(cls => {
        if (cls.id && (cls.name || cls.grade)) {
          this.addEntityReference(
            userId,
            'class',
            cls.id,
            cls.name || `${cls.grade}-${cls.section}`
          );
        }
      });
    }
  }

  /**
   * Get recent entities of a specific type
   */
  static getRecentEntitiesByType(
    userId: string,
    type: EntityReference['type']
  ): EntityReference[] {
    const context = this.getContext(userId);
    return context.recentEntities.filter(e => e.type === type);
  }

  /**
   * Get most recent entity
   */
  static getMostRecentEntity(userId: string): EntityReference | null {
    const context = this.getContext(userId);
    return context.recentEntities[0] || null;
  }

  /**
   * Find entity by partial name match
   */
  static findEntityByName(
    userId: string,
    partialName: string
  ): EntityReference | null {
    const context = this.getContext(userId);
    const lowerName = partialName.toLowerCase();

    return context.recentEntities.find(e =>
      e.name.toLowerCase().includes(lowerName)
    ) || null;
  }

  /**
   * Generate context summary for LLM
   */
  static getContextSummary(userId: string): string {
    const context = this.getContext(userId);
    
    if (context.recentEntities.length === 0 && context.lastToolCalls.length === 0) {
      return "No recent conversation context.";
    }

    const parts: string[] = [];

    // Recent entities
    if (context.recentEntities.length > 0) {
      const entityGroups = this.groupEntitiesByType(context.recentEntities);
      const entityStrings = Object.entries(entityGroups).map(([type, entities]) => {
        const names = entities.slice(0, 3).map(e => e.name).join(', ');
        return `${type}s: ${names}`;
      });
      parts.push(`Recently mentioned: ${entityStrings.join('; ')}`);
    }

    // Recent actions
    if (context.lastToolCalls.length > 0) {
      const recentTools = context.lastToolCalls.slice(0, 3).map(tc => {
        const action = this.toolNameToAction(tc.toolName);
        return action;
      });
      parts.push(`Recent actions: ${recentTools.join(', ')}`);
    }

    // Conversation topic
    if (context.conversationTopic) {
      parts.push(`Topic: ${context.conversationTopic}`);
    }

    return parts.join('\n');
  }

  /**
   * Group entities by type
   */
  private static groupEntitiesByType(entities: EntityReference[]): Record<string, EntityReference[]> {
    const groups: Record<string, EntityReference[]> = {};
    
    entities.forEach(entity => {
      if (!groups[entity.type]) {
        groups[entity.type] = [];
      }
      groups[entity.type].push(entity);
    });

    return groups;
  }

  /**
   * Convert tool name to human-readable action
   */
  private static toolNameToAction(toolName: string): string {
    const actionMap: Record<string, string> = {
      'fetch_student_profile': 'viewed student',
      'fetch_teacher_profile': 'viewed teacher',
      'fetch_teachers': 'listed teachers',
      'fetch_students': 'listed students',
      'fetch_classes': 'listed classes',
      'fetch_attendance_stats': 'checked attendance',
      'fetch_timetable': 'viewed timetable',
      'fetch_fee_data': 'checked fees',
      'fetch_transport_data': 'checked transport',
      'fetch_messages': 'checked messages',
      'fetch_leave_requests': 'viewed leave requests',
      'fetch_school_insights': 'viewed insights',
      'mark_attendance': 'marked attendance',
      'generate_report': 'generated report',
    };

    return actionMap[toolName] || toolName.replace(/_/g, ' ');
  }

  /**
   * Update conversation topic based on tool calls
   */
  static updateConversationTopic(userId: string): void {
    const context = this.getContext(userId);
    
    if (context.lastToolCalls.length === 0) return;

    // Determine topic from recent tool calls
    const recentTools = context.lastToolCalls.slice(0, 3);
    const toolCategories = recentTools.map(tc => {
      if (tc.toolName.includes('student')) return 'students';
      if (tc.toolName.includes('teacher')) return 'teachers';
      if (tc.toolName.includes('attendance')) return 'attendance';
      if (tc.toolName.includes('fee')) return 'fees';
      if (tc.toolName.includes('transport')) return 'transport';
      if (tc.toolName.includes('message')) return 'messaging';
      if (tc.toolName.includes('leave')) return 'leave management';
      if (tc.toolName.includes('timetable')) return 'timetables';
      return 'school data';
    });

    // Find most common category
    const categoryCount: Record<string, number> = {};
    toolCategories.forEach(cat => {
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const topic = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    context.conversationTopic = topic;
    context.lastUpdated = Date.now();
  }

  /**
   * Clear context for a user
   */
  static clearContext(userId: string): void {
    this.contexts.delete(userId);
  }

  /**
   * Detect if user is starting a new conversation topic
   * Returns true if we should reset context for better understanding
   */
  static detectTopicSwitch(userId: string, newMessage: string): boolean {
    const context = this.getContext(userId);
    const lowerMessage = newMessage.toLowerCase();
    
    // No context yet - not a switch, just starting
    if (!context.conversationTopic) {
      return false;
    }

    // Detect explicit topic indicators in the message
    const topicIndicators: Record<string, string[]> = {
      'students': ['student', 'students', 'class list', 'pupil', 'learner'],
      'teachers': ['teacher', 'teachers', 'staff', 'educator', 'faculty'],
      'attendance': ['attendance', 'absent', 'present', 'late', 'mark'],
      'fees': ['fee', 'fees', 'payment', 'tuition', 'invoice'],
      'transport': ['transport', 'bus', 'route', 'vehicle', 'driver'],
      'timetables': ['timetable', 'schedule', 'period', 'class timing'],
      'messaging': ['message', 'announcement', 'notification', 'notify'],
    };

    // Find what topic the new message is about
    let detectedTopic: string | null = null;
    for (const [topic, keywords] of Object.entries(topicIndicators)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        detectedTopic = topic;
        break;
      }
    }

    // If no topic detected in message, not a switch
    if (!detectedTopic) {
      return false;
    }

    // Check if switching from one specific topic to another
    // E.g., from "teachers" to "students"
    const currentTopic = context.conversationTopic;
    
    // Special case: If switching between teachers and students, that's a clear switch
    if ((currentTopic === 'teachers' && detectedTopic === 'students') ||
        (currentTopic === 'students' && detectedTopic === 'teachers')) {
      console.log(`[CONTEXT] Topic switch detected: ${currentTopic} → ${detectedTopic}`);
      return true;
    }

    // If topics are different and we have recent entities of the old type, it's a switch
    if (currentTopic !== detectedTopic && context.recentEntities.length > 0) {
      console.log(`[CONTEXT] Topic switch detected: ${currentTopic} → ${detectedTopic}`);
      return true;
    }

    return false;
  }

  /**
   * Reset entity context when topic switches (but keep tool history for learning)
   */
  static resetEntitiesForTopicSwitch(userId: string): void {
    const context = this.getContext(userId);
    context.recentEntities = [];
    context.conversationTopic = undefined;
    context.lastUpdated = Date.now();
    console.log(`[CONTEXT] Entity context cleared for user ${userId} due to topic switch`);
  }

  /**
   * Get statistics
   */
  static getStats(): {
    totalContexts: number;
    activeContexts: number;
  } {
    const now = Date.now();
    const activeContexts = Array.from(this.contexts.values()).filter(
      ctx => now - ctx.lastUpdated < this.CONTEXT_TTL
    ).length;

    return {
      totalContexts: this.contexts.size,
      activeContexts,
    };
  }
}
