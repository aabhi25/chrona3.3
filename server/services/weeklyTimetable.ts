import { db } from "../db";
import { weeklyTimetables, timetableEntries, classes } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { getWeekStartDateIST, getWeekEndDateIST, toISTDateString } from "../../shared/utils/dateUtils";

/**
 * WeeklyTimetableService
 * 
 * Centralized service for managing weekly timetable creation and retrieval.
 * This is the single source of truth for ensuring weekly timetables exist.
 * 
 * Key Features:
 * - Idempotent: Safe to call multiple times for the same class/week
 * - Transactional: Creates weekly timetables atomically
 * - Consistent: Uses standardized week boundary calculations (Monday-Sunday IST)
 * - Safe: Handles database unique constraint violations gracefully
 */
export class WeeklyTimetableService {
  
  /**
   * Calculate the start of the week (Monday) for a given date in IST
   */
  private getWeekStart(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00+05:30');
    const weekStartDate = getWeekStartDateIST(date);
    const result = toISTDateString(weekStartDate);
    console.log(`[WEEKLY SERVICE] Week start for ${dateString}: ${result}`);
    return result;
  }

  /**
   * Calculate the end of the week (Sunday) for a given date in IST
   */
  private getWeekEnd(dateString: string): string {
    const date = new Date(dateString + 'T00:00:00+05:30');
    const weekEndDate = getWeekEndDateIST(date);
    const result = toISTDateString(weekEndDate);
    console.log(`[WEEKLY SERVICE] Week end for ${dateString}: ${result}`);
    return result;
  }

  /**
   * Ensure a weekly timetable exists for a given class and date.
   * 
   * This method is idempotent - it can be called multiple times safely.
   * If the weekly timetable already exists, it returns the existing record.
   * If it doesn't exist, it creates one by copying from the master timetable.
   * 
   * @param classId - The UUID of the class
   * @param date - Any date within the week (YYYY-MM-DD format in IST)
   * @param schoolId - The UUID of the school
   * @param userId - The UUID of the user creating/modifying the timetable
   * @returns The weekly timetable record
   * @throws Error if no master timetable exists for the class
   */
  async ensureWeeklyTimetable(
    classId: string,
    date: string,
    schoolId: string,
    userId: string
  ): Promise<any> {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(date);

    console.log(`[WEEKLY SERVICE] Ensuring weekly timetable for class ${classId}, week ${weekStart} to ${weekEnd}`);

    // Step 1: Check if weekly timetable already exists
    const existing = await db.query.weeklyTimetables.findFirst({
      where: and(
        eq(weeklyTimetables.classId, classId),
        eq(weeklyTimetables.weekStart, weekStart),
        eq(weeklyTimetables.weekEnd, weekEnd)
      )
    });

    if (existing) {
      console.log(`[WEEKLY SERVICE] Weekly timetable already exists: ${existing.id}`);
      return existing;
    }

    console.log(`[WEEKLY SERVICE] Weekly timetable doesn't exist, creating from master...`);

    // Step 2: Get class data to obtain academic session ID
    const classData = await db.query.classes.findFirst({
      where: eq(classes.id, classId)
    });

    if (!classData) {
      const error = `Class ${classId} not found`;
      console.error(`[WEEKLY SERVICE ERROR] ${error}`);
      throw new Error(error);
    }

    if (!classData.academicSessionId) {
      const error = `Class ${classId} has no academicSessionId - cannot create weekly timetable without session context`;
      console.error(`[WEEKLY SERVICE ERROR] ${error}`);
      throw new Error(error);
    }

    // Step 3: Get master timetable entries
    const masterEntries = await db.query.timetableEntries.findMany({
      where: eq(timetableEntries.classId, classId)
    });

    if (masterEntries.length === 0) {
      const error = `No master timetable exists for class ${classId}. Please create a master timetable first.`;
      console.error(`[WEEKLY SERVICE ERROR] ${error}`);
      throw new Error(error);
    }

    console.log(`[WEEKLY SERVICE] Found ${masterEntries.length} master entries, creating weekly timetable...`);

    // Step 4: Copy master entries to weekly timetable format
    const weeklyData = masterEntries.map(entry => ({
      day: entry.day,
      period: entry.period,
      teacherId: entry.teacherId,
      subjectId: entry.subjectId,
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room,
      isModified: false
    }));

    // Step 5: Create weekly timetable in transaction with constraint handling
    try {
      const newWeekly = await db.transaction(async (tx) => {
        const result = await tx.insert(weeklyTimetables).values({
          classId,
          weekStart,
          weekEnd,
          timetableData: weeklyData as any,
          schoolId,
          modifiedBy: userId,
          academicSessionId: classData.academicSessionId
        }).returning();
        
        return result[0];
      });

      console.log(`[WEEKLY SERVICE] Successfully created weekly timetable: ${newWeekly.id}`);
      return newWeekly;

    } catch (error: any) {
      // Handle unique constraint violation (23505 = PostgreSQL unique violation)
      if (error.code === '23505' && error.constraint === 'unique_weekly_timetable') {
        console.log(`[WEEKLY SERVICE] Constraint violation detected, fetching existing record...`);
        
        // Another process/request created it simultaneously, fetch it
        const justCreated = await db.query.weeklyTimetables.findFirst({
          where: and(
            eq(weeklyTimetables.classId, classId),
            eq(weeklyTimetables.weekStart, weekStart),
            eq(weeklyTimetables.weekEnd, weekEnd)
          )
        });

        if (justCreated) {
          console.log(`[WEEKLY SERVICE] Found weekly timetable created by concurrent request: ${justCreated.id}`);
          return justCreated;
        }
      }

      // If it's not a constraint violation or we couldn't find the record, rethrow
      console.error(`[WEEKLY SERVICE ERROR] Failed to create weekly timetable:`, error);
      throw error;
    }
  }

  /**
   * Get an existing weekly timetable for a class and date.
   * Returns null if it doesn't exist (doesn't create one).
   * 
   * @param classId - The UUID of the class
   * @param date - Any date within the week (YYYY-MM-DD format in IST)
   * @returns The weekly timetable record or null
   */
  async getWeeklyTimetable(classId: string, date: string): Promise<any | null> {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(date);

    const weekly = await db.query.weeklyTimetables.findFirst({
      where: and(
        eq(weeklyTimetables.classId, classId),
        eq(weeklyTimetables.weekStart, weekStart),
        eq(weeklyTimetables.weekEnd, weekEnd)
      )
    });

    return weekly || null;
  }
}

// Export singleton instance
export const weeklyTimetableService = new WeeklyTimetableService();
