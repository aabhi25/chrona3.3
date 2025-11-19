import { db } from "../db";
import { 
  teacherSubstitutions, 
  teachers, 
  subjects, 
  classes,
  weeklyTimetables,
  timetableEntries,
  teacherAttendance,
  classSubjectAssignments,
} from "../../shared/schema";
import { eq, and, gte, lte, or, sql, inArray } from "drizzle-orm";
import { getWeekStartDateIST, getWeekEndDateIST, toISTDateString } from "../../shared/utils/dateUtils";
import { weeklyTimetableService } from "./weeklyTimetable";

interface SubstitutionSuggestion {
  teacherId: string;
  teacherName: string;
  score: number;
  reasons: Array<{ reason: string; score: number }>;
  classes: string[];
  subjects: string[];
  profilePictureUrl?: string;
  schoolIdNumber?: string;
  employeeId?: string;
}

export class SubstitutionService {
  
  async createSubstitutionsForAbsence(
    teacherId: string, 
    date: string, 
    schoolId: string,
    teacherAttendanceId: string,
    userId?: string
  ): Promise<any[]> {
    console.log(`[SUBSTITUTION] Creating substitutions for absent teacher ${teacherId} on ${date}`);
    
    const dayOfWeek = this.getDayOfWeek(date);
    const timetableEntries = await this.getTeacherTimetableForDate(teacherId, date, dayOfWeek);
    
    if (timetableEntries.length === 0) {
      console.log(`[SUBSTITUTION] No timetable entries found for teacher ${teacherId} on ${date}`);
      return [];
    }
    
    // Get unique class IDs from timetable entries
    const uniqueClassIdsSet = new Set(timetableEntries.map(entry => entry.classId));
    const uniqueClassIds = Array.from(uniqueClassIdsSet);
    console.log(`[SUBSTITUTION] Found ${uniqueClassIds.length} unique classes affected: ${uniqueClassIds.join(', ')}`);
    
    // Create weekly timetables for all affected classes if they don't exist - PARALLELIZED
    if (userId) {
      await Promise.all(
        uniqueClassIds.map(async (classId) => {
          try {
            await this.ensureWeeklyTimetableExists(classId, date, schoolId, userId);
            console.log(`[SUBSTITUTION] Ensured weekly timetable exists for class ${classId}`);
          } catch (error) {
            console.error(`[SUBSTITUTION] Failed to create weekly timetable for class ${classId}:`, error);
          }
        })
      );
    }
    
    // OPTIMIZATION: Batch fetch all existing substitutions upfront
    const existingSubstitutions = await db.query.teacherSubstitutions.findMany({
      where: and(
        eq(teacherSubstitutions.originalTeacherId, teacherId),
        eq(teacherSubstitutions.date, date),
        or(
          eq(teacherSubstitutions.status, 'pending'),
          eq(teacherSubstitutions.status, 'suggested'),
          eq(teacherSubstitutions.status, 'assigned')
        )
      )
    });
    
    // Create a lookup map for existing substitutions
    const existingMap = new Map<string, any>();
    existingSubstitutions.forEach(sub => {
      const key = `${sub.classId}-${sub.period}`;
      existingMap.set(key, sub);
    });
    
    // Separate entries into existing and new
    const entriesToUpdate: any[] = [];
    const entriesToCreate: any[] = [];
    
    for (const entry of timetableEntries) {
      const key = `${entry.classId}-${entry.period}`;
      const existingSub = existingMap.get(key);
      
      if (existingSub) {
        entriesToUpdate.push({ entry, existingSub });
      } else {
        entriesToCreate.push(entry);
      }
    }
    
    // Process existing substitutions in parallel
    const updatedSubstitutions = await Promise.all(
      entriesToUpdate.map(async ({ entry, existingSub }) => {
        console.log(`[SUBSTITUTION] Reusing active substitution for period ${entry.period} (status: ${existingSub.status})`);
        
        if (existingSub.status === 'assigned') {
          await db.update(teacherSubstitutions)
            .set({ 
              teacherAttendanceId: teacherAttendanceId,
              reason: "absent",
              updatedAt: new Date()
            })
            .where(eq(teacherSubstitutions.id, existingSub.id));
          
          return {
            ...existingSub, 
            teacherAttendanceId, 
            reason: "absent"
          };
        } else {
          // For pending/suggested, refresh suggestions
          const suggestions = await this.suggestSubstitutes(existingSub.id);
          
          await db.update(teacherSubstitutions)
            .set({ 
              teacherAttendanceId: teacherAttendanceId,
              reason: "absent",
              suggestedSubstitutes: suggestions as any,
              status: 'suggested',
              updatedAt: new Date()
            })
            .where(eq(teacherSubstitutions.id, existingSub.id));
          
          return {
            ...existingSub, 
            teacherAttendanceId, 
            reason: "absent",
            suggestedSubstitutes: suggestions,
            status: 'suggested'
          };
        }
      })
    );
    
    // Batch create new substitutions
    let newSubstitutions: any[] = [];
    if (entriesToCreate.length > 0) {
      const newSubValues = entriesToCreate.map(entry => ({
        originalTeacherId: teacherId,
        classId: entry.classId,
        subjectId: entry.subjectId,
        schoolId: schoolId,
        date: date,
        period: entry.period,
        dayOfWeek: dayOfWeek as any,
        startTime: entry.startTime,
        endTime: entry.endTime,
        reason: "absent" as const,
        status: "pending" as const,
        teacherAttendanceId: teacherAttendanceId,
      }));
      
      newSubstitutions = await db.insert(teacherSubstitutions).values(newSubValues).returning();
      console.log(`[SUBSTITUTION] Created ${newSubstitutions.length} new substitution records`);
      
      // Generate suggestions for all new substitutions in parallel
      const substitutionsWithSuggestions = await Promise.all(
        newSubstitutions.map(async (sub) => {
          const suggestions = await this.suggestSubstitutes(sub.id);
          
          await db.update(teacherSubstitutions)
            .set({ 
              suggestedSubstitutes: suggestions as any,
              status: 'suggested',
              updatedAt: new Date()
            })
            .where(eq(teacherSubstitutions.id, sub.id));
          
          return {
            ...sub,
            suggestedSubstitutes: suggestions,
            status: 'suggested'
          };
        })
      );
      
      newSubstitutions = substitutionsWithSuggestions;
    }
    
    const substitutions = [...updatedSubstitutions, ...newSubstitutions];
    
    console.log(`[SUBSTITUTION] Created ${substitutions.length} urgent substitutions for absent teacher`);
    return substitutions;
  }
  
  async createSubstitutionsForLeave(
    teacherId: string,
    leaveStartDate: string,
    leaveEndDate: string,
    schoolId: string,
    teacherAttendanceId: string,
    userId?: string
  ): Promise<any[]> {
    console.log(`[SUBSTITUTION] Creating substitutions for leave ${leaveStartDate} to ${leaveEndDate}`);
    
    const substitutions = [];
    const dates = this.getDateRange(leaveStartDate, leaveEndDate);
    
    // Track unique (classId, week) pairs to ensure weekly timetables
    const weeklyTimetablesToCreate = new Map<string, { classId: string, date: string }>();
    
    for (const date of dates) {
      const dayOfWeek = this.getDayOfWeek(date);
      
      if (dayOfWeek === 'sunday') continue;
      
      const timetableEntries = await this.getTeacherTimetableForDate(teacherId, date, dayOfWeek);
      
      // Track classes that need weekly timetables for this date
      if (userId) {
        const uniqueClassIdsSet = new Set(timetableEntries.map(entry => entry.classId));
        const uniqueClassIds = Array.from(uniqueClassIdsSet);
        const weekStart = this.getWeekStart(date);
        
        for (const classId of uniqueClassIds) {
          const key = `${classId}-${weekStart}`;
          if (!weeklyTimetablesToCreate.has(key)) {
            weeklyTimetablesToCreate.set(key, { classId, date });
          }
        }
      }
      
      for (const entry of timetableEntries) {
        // Check if an active substitution already exists (not cancelled or completed)
        const existingSubstitution = await db.query.teacherSubstitutions.findFirst({
          where: and(
            eq(teacherSubstitutions.originalTeacherId, teacherId),
            eq(teacherSubstitutions.date, date),
            eq(teacherSubstitutions.period, entry.period),
            eq(teacherSubstitutions.classId, entry.classId),
            or(
              eq(teacherSubstitutions.status, 'pending'),
              eq(teacherSubstitutions.status, 'suggested'),
              eq(teacherSubstitutions.status, 'assigned')
            )
          )
        });
        
        if (existingSubstitution) {
          console.log(`[SUBSTITUTION] Reusing active substitution for ${date} period ${entry.period}`);
          
          // Update the existing substitution with current attendance record
          // Note: Leave substitutions get suggestions in batch later, so we just update metadata here
          await db.update(teacherSubstitutions)
            .set({ 
              teacherAttendanceId: teacherAttendanceId,
              reason: "leave",
              updatedAt: new Date()
            })
            .where(eq(teacherSubstitutions.id, existingSubstitution.id));
          
          substitutions.push({...existingSubstitution, teacherAttendanceId, reason: "leave"});
          continue;
        }
        
        const substitution = await db.insert(teacherSubstitutions).values({
          originalTeacherId: teacherId,
          classId: entry.classId,
          subjectId: entry.subjectId,
          schoolId: schoolId,
          date: date,
          period: entry.period,
          dayOfWeek: dayOfWeek as any,
          startTime: entry.startTime,
          endTime: entry.endTime,
          reason: "leave",
          status: "pending",
          teacherAttendanceId: teacherAttendanceId,
        }).returning();
        
        substitutions.push(substitution[0]);
      }
    }
    
    // Create weekly timetables for all affected (class, week) pairs
    if (userId && weeklyTimetablesToCreate.size > 0) {
      console.log(`[SUBSTITUTION] Creating ${weeklyTimetablesToCreate.size} weekly timetables for affected classes`);
      
      const entriesToCreate = Array.from(weeklyTimetablesToCreate.entries());
      for (const [key, { classId, date }] of entriesToCreate) {
        try {
          await this.ensureWeeklyTimetableExists(classId, date, schoolId, userId);
          console.log(`[SUBSTITUTION] Ensured weekly timetable exists for class ${classId}, week starting ${this.getWeekStart(date)}`);
        } catch (error) {
          console.error(`[SUBSTITUTION] Failed to create weekly timetable for class ${classId}:`, error);
        }
      }
    }
    
    console.log(`[SUBSTITUTION] Created ${substitutions.length} pending substitutions for leave`);
    return substitutions;
  }
  
  private async getTeacherTimetableForDate(
    teacherId: string, 
    date: string, 
    dayOfWeek: string
  ): Promise<any[]> {
    const weekStart = this.getWeekStart(date);
    const weekEnd = this.getWeekEnd(date);
    
    // Fetch ALL weekly timetables for this week (not just one)
    const allWeeklyTimetables = await db.query.weeklyTimetables.findMany({
      where: and(
        eq(weeklyTimetables.weekStart, weekStart),
        eq(weeklyTimetables.weekEnd, weekEnd)
      )
    });
    
    // If weekly timetables exist, check ALL of them for this teacher's entries
    if (allWeeklyTimetables.length > 0) {
      const allEntries: any[] = [];
      
      for (const weekly of allWeeklyTimetables) {
        if (weekly.timetableData) {
          const entries = (weekly.timetableData as any[]).filter((entry: any) => 
            entry.teacherId === teacherId && 
            entry.day.toLowerCase() === dayOfWeek.toLowerCase()
          );
          
          // Add classId to each entry from the weekly timetable
          const entriesWithClass = entries.map((entry: any) => ({
            ...entry,
            classId: weekly.classId
          }));
          
          allEntries.push(...entriesWithClass);
        }
      }
      
      // If we found entries in weekly timetables, return them
      if (allEntries.length > 0) {
        console.log(`[SUBSTITUTION] Found ${allEntries.length} entries across ${allWeeklyTimetables.length} weekly timetables`);
        return allEntries;
      }
    }
    
    // Fallback to master timetable if no weekly timetables or no entries found
    const masterEntries = await db.query.timetableEntries.findMany({
      where: and(
        eq(timetableEntries.teacherId, teacherId),
        sql`LOWER(${timetableEntries.day}) = ${dayOfWeek.toLowerCase()}`
      )
    });
    
    console.log(`[SUBSTITUTION] Using master timetable: found ${masterEntries.length} entries`);
    return masterEntries;
  }
  
  async suggestSubstitutes(substitutionId: string): Promise<SubstitutionSuggestion[]> {
    const substitution = await db.query.teacherSubstitutions.findFirst({
      where: eq(teacherSubstitutions.id, substitutionId),
      with: {
        originalTeacher: true,
        class: true,
        subject: true,
      }
    });
    
    if (!substitution) {
      throw new Error("Substitution not found");
    }
    
    const { originalTeacherId, classId, subjectId, schoolId, date, period, dayOfWeek } = substitution;
    
    // OPTIMIZATION: Batch fetch ALL data upfront (5-6 queries total instead of N*10 queries)
    console.log('[SUGGEST] Starting optimized batch data fetch...');
    const weekStart = this.getWeekStart(date);
    
    const [
      allTeachers,
      teacherAttendanceRecords,
      weeklyTimetableRecords,
      masterTimetableEntries,
      classSubjectAssignments,
      substitutionHistory,
      targetSubject
    ] = await Promise.all([
      // 1. All active teachers
      db.query.teachers.findMany({
        where: and(
          eq(teachers.schoolId, schoolId),
          eq(teachers.isActive, true)
        )
      }),
      // 2. All teacher attendance for this date
      db.query.teacherAttendance.findMany({
        where: and(
          or(
            eq(teacherAttendance.attendanceDate, date),
            and(
              lte(teacherAttendance.leaveStartDate, date),
              gte(teacherAttendance.leaveEndDate, date)
            )
          ),
          or(
            eq(teacherAttendance.status, "on_leave"),
            eq(teacherAttendance.status, "medical_leave"),
            eq(teacherAttendance.status, "personal_leave"),
            eq(teacherAttendance.status, "absent")
          )
        )
      }),
      // 3. All weekly timetables for this week
      db.query.weeklyTimetables.findMany({
        where: eq(weeklyTimetables.weekStart, weekStart)
      }),
      // 4. All master timetable entries
      db.query.timetableEntries.findMany({
        where: sql`LOWER(${timetableEntries.day}) = ${dayOfWeek.toLowerCase()}`
      }),
      // 5. All class-subject assignments with relations
      db.query.classSubjectAssignments.findMany({
        with: {
          subject: true,
          class: true
        }
      }),
      // 6. All completed substitutions
      db.query.teacherSubstitutions.findMany({
        where: eq(teacherSubstitutions.status, "completed"),
        columns: { substituteTeacherId: true }
      }),
      // 7. Target subject details
      db.query.subjects.findFirst({
        where: eq(subjects.id, subjectId)
      })
    ]);
    
    console.log(`[SUGGEST] Batch fetch complete: ${allTeachers.length} teachers, ${weeklyTimetableRecords.length} weekly TTs, ${masterTimetableEntries.length} master entries`);
    
    // Build lookup maps for O(1) access
    const teachersOnLeaveSet = new Set(teacherAttendanceRecords.map((a: any) => a.teacherId));
    
    // Build schedule map: teacherId -> Set of periods they're busy
    const teacherScheduleMap = new Map<string, Set<number>>();
    
    // Process weekly timetables
    weeklyTimetableRecords.forEach((wt: any) => {
      const entries = (wt.timetableData as any[]) || [];
      entries.forEach((entry: any) => {
        if (entry.day?.toLowerCase() === dayOfWeek.toLowerCase()) {
          if (!teacherScheduleMap.has(entry.teacherId)) {
            teacherScheduleMap.set(entry.teacherId, new Set());
          }
          teacherScheduleMap.get(entry.teacherId)!.add(entry.period);
        }
      });
    });
    
    // Process master timetable
    masterTimetableEntries.forEach(entry => {
      if (!teacherScheduleMap.has(entry.teacherId)) {
        teacherScheduleMap.set(entry.teacherId, new Set());
      }
      teacherScheduleMap.get(entry.teacherId)!.add(entry.period);
    });
    
    // Build subject teaching map: teacherId -> Set of subjectIds
    const teacherSubjectsMap = new Map<string, Set<string>>();
    const teacherClassesMap = new Map<string, Set<string>>();
    const teacherSubjectNamesMap = new Map<string, Set<string>>();
    const teacherClassNamesMap = new Map<string, Set<string>>();
    const teacherSubjectCodesMap = new Map<string, Map<string, string>>();
    
    classSubjectAssignments.forEach((assignment: any) => {
      const teacherId = assignment.assignedTeacherId;
      if (!teacherId) return;
      
      // Track subject IDs
      if (!teacherSubjectsMap.has(teacherId)) {
        teacherSubjectsMap.set(teacherId, new Set());
      }
      teacherSubjectsMap.get(teacherId)!.add(assignment.subjectId);
      
      // Track class IDs
      if (!teacherClassesMap.has(teacherId)) {
        teacherClassesMap.set(teacherId, new Set());
      }
      teacherClassesMap.get(teacherId)!.add(assignment.classId);
      
      // Track subject names
      if (assignment.subject?.name) {
        if (!teacherSubjectNamesMap.has(teacherId)) {
          teacherSubjectNamesMap.set(teacherId, new Set());
        }
        teacherSubjectNamesMap.get(teacherId)!.add(assignment.subject.name);
      }
      
      // Track class names
      if (assignment.class) {
        const cls = assignment.class;
        const className = `Class ${cls.grade}${cls.section ? ` ${cls.section}` : ''}`;
        if (!teacherClassNamesMap.has(teacherId)) {
          teacherClassNamesMap.set(teacherId, new Set());
        }
        teacherClassNamesMap.get(teacherId)!.add(className);
      }
      
      // Track subject codes for area matching
      if (assignment.subject?.code) {
        if (!teacherSubjectCodesMap.has(teacherId)) {
          teacherSubjectCodesMap.set(teacherId, new Map());
        }
        teacherSubjectCodesMap.get(teacherId)!.set(assignment.subjectId, assignment.subject.code);
      }
    });
    
    // Build substitution success count map
    const substitutionCountMap = new Map<string, number>();
    substitutionHistory.forEach(sub => {
      if (sub.substituteTeacherId) {
        substitutionCountMap.set(
          sub.substituteTeacherId,
          (substitutionCountMap.get(sub.substituteTeacherId) || 0) + 1
        );
      }
    });
    
    // Now score all teachers in memory (no more database queries!)
    const eligibleTeachers: SubstitutionSuggestion[] = [];
    const targetSubjectCode = targetSubject?.code || '';
    const targetSubjectCodePrefix = targetSubjectCode.substring(0, 3);
    const subjectName = (substitution.subject as any)?.name || "";
    const className = (substitution.class as any)?.name || "";
    
    for (const teacher of allTeachers) {
      if (teacher.id === originalTeacherId) continue;
      
      // Check if on leave (O(1) lookup)
      if (teachersOnLeaveSet.has(teacher.id)) continue;
      
      // Check if has schedule conflict (O(1) lookup)
      const busyPeriods = teacherScheduleMap.get(teacher.id);
      if (busyPeriods && busyPeriods.has(period)) continue;
      
      let score = 0;
      const reasons: Array<{ reason: string; score: number }> = [];
      
      // Check if teaches this subject (O(1) lookup)
      const teachesThisSubject = teacherSubjectsMap.get(teacher.id)?.has(subjectId) || false;
      if (teachesThisSubject) {
        score += 50;
        reasons.push({ reason: `Qualified to teach ${subjectName}`, score: 50 });
      }
      
      // Check if taught this class before (O(1) lookup)
      const taughtThisClass = teacherClassesMap.get(teacher.id)?.has(classId) || false;
      if (taughtThisClass) {
        score += 30;
        reasons.push({ reason: `Familiar with ${className}`, score: 30 });
      }
      
      // Check if same subject area (O(1) lookup)
      if (!teachesThisSubject && targetSubjectCodePrefix) {
        const teacherCodes = teacherSubjectCodesMap.get(teacher.id);
        if (teacherCodes) {
          const sameArea = Array.from(teacherCodes.values()).some(code => 
            code.startsWith(targetSubjectCodePrefix)
          );
          if (sameArea) {
            score += 20;
            reasons.push({ reason: "Same department", score: 20 });
          }
        }
      }
      
      // Calculate workload (O(1) lookup)
      const periodsCount = busyPeriods?.size || 0;
      const workloadPercent = (periodsCount / 10) * 100;
      if (workloadPercent < 70) {
        score += 15;
        reasons.push({ reason: "Light current workload", score: 15 });
      }
      
      // Check adjacent free periods (O(1) lookup)
      const adjacentPeriods = [period - 1, period + 1].filter(p => p > 0 && p <= 10);
      const hasAdjacentFree = adjacentPeriods.some(adjPeriod => 
        !busyPeriods || !busyPeriods.has(adjPeriod)
      );
      if (hasAdjacentFree) {
        score += 10;
        reasons.push({ reason: "Free period before/after", score: 10 });
      }
      
      // Check substitution history (O(1) lookup)
      const pastSuccessCount = substitutionCountMap.get(teacher.id) || 0;
      if (pastSuccessCount > 0) {
        const historyScore = Math.min(pastSuccessCount, 5);
        score += historyScore;
        reasons.push({ reason: `Successfully substituted ${pastSuccessCount} times`, score: historyScore });
      }
      
      // Get teacher's classes and subjects (O(1) lookup)
      const classes = Array.from(teacherClassNamesMap.get(teacher.id) || []);
      const subjects = Array.from(teacherSubjectNamesMap.get(teacher.id) || []);
      
      eligibleTeachers.push({
        teacherId: teacher.id,
        teacherName: teacher.name,
        score,
        reasons,
        classes,
        subjects,
        profilePictureUrl: teacher.profilePictureUrl || undefined,
        schoolIdNumber: teacher.schoolIdNumber || undefined,
        employeeId: teacher.employeeId || undefined
      });
    }
    
    console.log(`[SUGGEST] Scored ${eligibleTeachers.length} eligible teachers in memory`);
    
    // Add small random variation to break ties and provide variety on regenerate
    // This ensures "Regenerate" button shows different qualified teachers each time
    const teachersWithVariation = eligibleTeachers.map(teacher => ({
      ...teacher,
      adjustedScore: teacher.score + (Math.random() * 3) // Add 0-3 points randomly
    }));
    
    return teachersWithVariation
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, 5)
      .map(({ adjustedScore, ...teacher }) => teacher); // Remove adjustedScore from final result
  }
  
  private async isTeacherOnLeave(teacherId: string, date: string): Promise<boolean> {
    const attendance = await db.query.teacherAttendance.findFirst({
      where: and(
        eq(teacherAttendance.teacherId, teacherId),
        or(
          eq(teacherAttendance.attendanceDate, date),
          and(
            lte(teacherAttendance.leaveStartDate, date),
            gte(teacherAttendance.leaveEndDate, date)
          )
        ),
        or(
          eq(teacherAttendance.status, "on_leave"),
          eq(teacherAttendance.status, "medical_leave"),
          eq(teacherAttendance.status, "personal_leave")
        )
      )
    });
    
    return !!attendance;
  }
  
  private async hasScheduleConflict(
    teacherId: string, 
    date: string, 
    period: number, 
    dayOfWeek: string
  ): Promise<boolean> {
    const weekStart = this.getWeekStart(date);
    
    const weekly = await db.query.weeklyTimetables.findMany({
      where: eq(weeklyTimetables.weekStart, weekStart)
    });
    
    for (const w of weekly) {
      const entries = (w.timetableData as any[]) || [];
      const conflict = entries.find((entry: any) => 
        entry.teacherId === teacherId && 
        entry.day.toLowerCase() === dayOfWeek.toLowerCase() &&
        entry.period === period
      );
      if (conflict) return true;
    }
    
    const masterConflict = await db.query.timetableEntries.findFirst({
      where: and(
        eq(timetableEntries.teacherId, teacherId),
        sql`LOWER(${timetableEntries.day}) = ${dayOfWeek.toLowerCase()}`,
        eq(timetableEntries.period, period)
      )
    });
    
    return !!masterConflict;
  }
  
  private async teachesSubject(teacherId: string, subjectId: string): Promise<boolean> {
    const assignment = await db.query.classSubjectAssignments.findFirst({
      where: and(
        eq(classSubjectAssignments.assignedTeacherId, teacherId),
        eq(classSubjectAssignments.subjectId, subjectId)
      )
    });
    
    return !!assignment;
  }
  
  private async hasTaughtClass(teacherId: string, classId: string): Promise<boolean> {
    const entry = await db.query.timetableEntries.findFirst({
      where: and(
        eq(timetableEntries.teacherId, teacherId),
        eq(timetableEntries.classId, classId)
      )
    });
    
    return !!entry;
  }
  
  private async isSameSubjectArea(teacherId: string, targetSubjectId: string): Promise<boolean> {
    const targetSubject = await db.query.subjects.findFirst({
      where: eq(subjects.id, targetSubjectId)
    });
    
    if (!targetSubject) return false;
    
    const teacherSubjects = await db.query.classSubjectAssignments.findMany({
      where: eq(classSubjectAssignments.assignedTeacherId, teacherId),
      with: {
        subject: true
      }
    });
    
    return teacherSubjects.some((ts: any) => 
      ts.subject?.code?.startsWith(targetSubject.code?.substring(0, 3) || "")
    );
  }
  
  private async getTeacherWorkloadPercent(
    teacherId: string, 
    date: string, 
    dayOfWeek: string
  ): Promise<number> {
    const weekStart = this.getWeekStart(date);
    
    const weeklies = await db.query.weeklyTimetables.findMany({
      where: eq(weeklyTimetables.weekStart, weekStart)
    });
    
    let periodsCount = 0;
    for (const w of weeklies) {
      const entries = (w.timetableData as any[]) || [];
      periodsCount += entries.filter((entry: any) => 
        entry.teacherId === teacherId && 
        entry.day.toLowerCase() === dayOfWeek.toLowerCase()
      ).length;
    }
    
    if (periodsCount === 0) {
      const masterEntries = await db.query.timetableEntries.findMany({
        where: and(
          eq(timetableEntries.teacherId, teacherId),
          sql`LOWER(${timetableEntries.day}) = ${dayOfWeek.toLowerCase()}`
        )
      });
      periodsCount = masterEntries.length;
    }
    
    const maxPeriods = 10;
    return (periodsCount / maxPeriods) * 100;
  }
  
  private async hasAdjacentFreePeriod(
    teacherId: string,
    date: string,
    period: number,
    dayOfWeek: string
  ): Promise<boolean> {
    const adjacentPeriods = [period - 1, period + 1].filter(p => p > 0 && p <= 10);
    
    for (const adjPeriod of adjacentPeriods) {
      const hasConflict = await this.hasScheduleConflict(teacherId, date, adjPeriod, dayOfWeek);
      if (!hasConflict) {
        return true;
      }
    }
    
    return false;
  }
  
  private async getSuccessfulSubstitutionCount(teacherId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(teacherSubstitutions)
      .where(and(
        eq(teacherSubstitutions.substituteTeacherId, teacherId),
        eq(teacherSubstitutions.status, "completed")
      ));
    
    return Number(result[0]?.count || 0);
  }
  
  private async getTeacherClasses(teacherId: string): Promise<string[]> {
    const assignments = await db.query.classSubjectAssignments.findMany({
      where: eq(classSubjectAssignments.assignedTeacherId, teacherId),
      with: {
        class: true
      }
    });
    
    // Compute class names from grade and section
    const classNames = assignments
      .map(a => {
        const cls = a.class as any;
        if (!cls) return null;
        return `Class ${cls.grade}${cls.section ? ` ${cls.section}` : ''}`;
      })
      .filter(Boolean) as string[];
    
    const uniqueClasses = Array.from(new Set(classNames));
    return uniqueClasses;
  }

  private async getTeacherSubjects(teacherId: string): Promise<string[]> {
    const assignments = await db.query.classSubjectAssignments.findMany({
      where: eq(classSubjectAssignments.assignedTeacherId, teacherId),
      with: {
        subject: true
      }
    });
    
    // Get unique subject names
    const subjectNames = assignments
      .map(a => (a.subject as any)?.name)
      .filter(Boolean) as string[];
    
    const uniqueSubjects = Array.from(new Set(subjectNames));
    return uniqueSubjects;
  }
  
  private getDayOfWeek(dateString: string): string {
    // Parse date in IST timezone
    const date = new Date(dateString + 'T00:00:00+05:30');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }
  
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate + 'T00:00:00+05:30');
    const end = new Date(endDate + 'T00:00:00+05:30');
    
    let current = new Date(start);
    while (current <= end) {
      // Use IST-aware date string conversion instead of toISOString
      dates.push(toISTDateString(current));
      // Move to next day using Date arithmetic
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return dates;
  }
  
  private getWeekStart(dateString: string): string {
    // Parse date in IST timezone using shared utility
    const date = new Date(dateString + 'T00:00:00+05:30');
    
    // Use IST-aware week start calculation
    const weekStartDate = getWeekStartDateIST(date);
    
    // Convert to YYYY-MM-DD using IST timezone
    const result = toISTDateString(weekStartDate);
    console.log(`[WEEK CALC IST] Input: ${dateString}, WeekStart (Monday): ${result}`);
    return result;
  }
  
  private getWeekEnd(dateString: string): string {
    // Parse date in IST timezone using shared utility
    const date = new Date(dateString + 'T00:00:00+05:30');
    
    // Use IST-aware week end calculation
    const weekEndDate = getWeekEndDateIST(date);
    
    // Convert to YYYY-MM-DD using IST timezone
    const result = toISTDateString(weekEndDate);
    console.log(`[WEEK CALC IST] Input: ${dateString}, WeekEnd (Sunday): ${result}`);
    return result;
  }
  
  async ensureWeeklyTimetableExists(classId: string, date: string, schoolId: string, userId: string): Promise<any> {
    return await weeklyTimetableService.ensureWeeklyTimetable(classId, date, schoolId, userId);
  }
  
  async assignSubstitute(
    substitutionId: string, 
    substituteTeacherId: string, 
    adminId: string
  ): Promise<any> {
    console.log(`[ASSIGN] Starting assignment for substitution ${substitutionId} with substitute ${substituteTeacherId}`);
    
    const substitution = await db.query.teacherSubstitutions.findFirst({
      where: eq(teacherSubstitutions.id, substitutionId)
    });
    
    if (!substitution) {
      throw new Error("Substitution not found");
    }
    
    console.log(`[ASSIGN] Substitution details: classId=${substitution.classId}, date=${substitution.date}, day=${substitution.dayOfWeek}, period=${substitution.period}`);
    
    await this.ensureWeeklyTimetableExists(substitution.classId, substitution.date, substitution.schoolId, adminId);
    
    const weekStart = this.getWeekStart(substitution.date);
    const weekEnd = this.getWeekEnd(substitution.date);
    
    console.log(`[ASSIGN] Looking for weekly timetable: weekStart=${weekStart}, weekEnd=${weekEnd}`);
    
    const weekly = await db.query.weeklyTimetables.findFirst({
      where: and(
        eq(weeklyTimetables.classId, substitution.classId),
        eq(weeklyTimetables.weekStart, weekStart),
        eq(weeklyTimetables.weekEnd, weekEnd)
      )
    });
    
    if (!weekly) {
      console.error(`[ASSIGN ERROR] Weekly timetable not found for classId=${substitution.classId}, weekStart=${weekStart}`);
      throw new Error("Weekly timetable not found");
    }
    
    console.log(`[ASSIGN] Found weekly timetable: id=${weekly.id}, entries count=${(weekly.timetableData as any[]).length}`);
    
    let matchFound = false;
    const updatedData = (weekly.timetableData as any[]).map((entry: any) => {
      if (entry.day.toLowerCase() === substitution.dayOfWeek.toLowerCase() && 
          entry.period === substitution.period) {
        console.log(`[ASSIGN] Match found! Updating entry: day=${entry.day}, period=${entry.period}, oldTeacher=${entry.teacherId} -> newTeacher=${substituteTeacherId}`);
        matchFound = true;
        return {
          ...entry,
          teacherId: substituteTeacherId,
          isModified: true,
          originalTeacherId: substitution.originalTeacherId,
          substitutionId: substitutionId
        };
      }
      return entry;
    });
    
    if (!matchFound) {
      console.error(`[ASSIGN ERROR] No matching entry found in weekly timetable for day=${substitution.dayOfWeek}, period=${substitution.period}`);
      console.error(`[ASSIGN ERROR] Available entries:`, (weekly.timetableData as any[]).map((e: any) => `${e.day}:${e.period}`).join(', '));
      throw new Error(`No matching timetable entry found for ${substitution.dayOfWeek} period ${substitution.period}`);
    }
    
    await db.update(weeklyTimetables)
      .set({ 
        timetableData: updatedData as any,
        updatedAt: new Date()
      })
      .where(eq(weeklyTimetables.id, weekly.id));
    
    console.log(`[ASSIGN] Successfully updated weekly timetable`);
    
    const updated = await db.update(teacherSubstitutions)
      .set({
        substituteTeacherId,
        status: 'assigned',
        assignedBy: adminId,
        assignedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(teacherSubstitutions.id, substitutionId))
      .returning();
    
    console.log(`[ASSIGN] Successfully marked substitution as assigned`);
    
    return updated[0];
  }
  
  async cancelSubstitution(substitutionId: string): Promise<void> {
    const substitution = await db.query.teacherSubstitutions.findFirst({
      where: eq(teacherSubstitutions.id, substitutionId)
    });
    
    if (!substitution) {
      throw new Error("Substitution not found");
    }
    
    if (substitution.status === 'assigned' && substitution.substituteTeacherId) {
      await this.revertWeeklyTimetable(substitution);
    }
    
    await db.update(teacherSubstitutions)
      .set({
        status: 'cancelled',
        notes: 'Cancelled by system or admin',
        updatedAt: new Date()
      })
      .where(eq(teacherSubstitutions.id, substitutionId));
  }
  
  private async revertWeeklyTimetable(substitution: any): Promise<void> {
    const weekStart = this.getWeekStart(substitution.date);
    const weekEnd = this.getWeekEnd(substitution.date);
    
    const weekly = await db.query.weeklyTimetables.findFirst({
      where: and(
        eq(weeklyTimetables.classId, substitution.classId),
        eq(weeklyTimetables.weekStart, weekStart),
        eq(weeklyTimetables.weekEnd, weekEnd)
      )
    });
    
    if (!weekly) return;
    
    const updatedData = (weekly.timetableData as any[]).map((entry: any) => {
      if (entry.day.toLowerCase() === substitution.dayOfWeek.toLowerCase() && 
          entry.period === substitution.period &&
          entry.substitutionId === substitution.id) {
        return {
          ...entry,
          teacherId: substitution.originalTeacherId,
          isModified: false,
          originalTeacherId: undefined,
          substitutionId: undefined
        };
      }
      return entry;
    });
    
    await db.update(weeklyTimetables)
      .set({ 
        timetableData: updatedData as any,
        updatedAt: new Date()
      })
      .where(eq(weeklyTimetables.id, weekly.id));
  }
  
  async processPendingSubstitutions(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const pending = await db.query.teacherSubstitutions.findMany({
      where: and(
        eq(teacherSubstitutions.status, 'pending'),
        gte(teacherSubstitutions.date, today),
        lte(teacherSubstitutions.date, threeDaysLater)
      )
    });
    
    console.log(`[SUBSTITUTION CRON] Processing ${pending.length} pending substitutions`);
    
    for (const sub of pending) {
      try {
        const suggestions = await this.suggestSubstitutes(sub.id);
        
        await db.update(teacherSubstitutions)
          .set({
            suggestedSubstitutes: suggestions as any,
            status: 'suggested',
            updatedAt: new Date()
          })
          .where(eq(teacherSubstitutions.id, sub.id));
        
        console.log(`[SUBSTITUTION CRON] Suggested substitutes for ${sub.id}`);
      } catch (error) {
        console.error(`[SUBSTITUTION CRON] Error processing substitution ${sub.id}:`, error);
      }
    }
  }
  
  async autoCancelSubstitutionsForPresence(teacherId: string, date: string): Promise<number> {
    console.log(`[AUTO-CANCEL] Finding substitutions for teacher ${teacherId} on ${date}`);
    
    // Find all substitutions for this teacher on this date that are pending, suggested, or assigned
    const substitutionsToCancel = await db.query.teacherSubstitutions.findMany({
      where: and(
        eq(teacherSubstitutions.originalTeacherId, teacherId),
        eq(teacherSubstitutions.date, date),
        or(
          eq(teacherSubstitutions.status, 'pending'),
          eq(teacherSubstitutions.status, 'suggested'),
          eq(teacherSubstitutions.status, 'assigned')
        )
      )
    });
    
    console.log(`[AUTO-CANCEL] Found ${substitutionsToCancel.length} substitution(s) to cancel`);
    
    if (substitutionsToCancel.length === 0) {
      return 0;
    }
    
    // OPTIMIZATION: Cancel all substitutions in a single batch UPDATE query
    const substitutionIds = substitutionsToCancel.map(sub => sub.id);
    
    await db.update(teacherSubstitutions)
      .set({
        status: 'cancelled',
        notes: 'Auto-cancelled: Original teacher marked present',
        updatedAt: new Date()
      })
      .where(inArray(teacherSubstitutions.id, substitutionIds));
    
    console.log(`[AUTO-CANCEL] Batch cancelled ${substitutionsToCancel.length} substitution(s) in single query`);
    
    return substitutionsToCancel.length;
  }
}

export const substitutionService = new SubstitutionService();
