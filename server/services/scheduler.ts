import { storage } from "../storage";
import type { InsertTimetableEntry, Teacher, Subject, Class } from "@shared/schema";
import { getCurrentDateTimeIST, getWeekStartDateIST, toISTDateString } from "@shared/utils/dateUtils";

interface TimeSlot {
  day: string;
  period: number;
  startTime: string;
  endTime: string;
}

interface ScheduleConstraint {
  classId: string;
  subjectId: string;
  periodsNeeded: number;
  preferredTeachers: string[];
}

export class TimetableScheduler {
  private timeSlots: TimeSlot[] = [];

  constructor() {
    // Initialize with default slots, will be updated when generating timetable
    this.initializeTimeSlots();
  }

  private async initializeFromStructure(schoolId?: string) {
    try {
      let structure;
      if (schoolId) {
        structure = await storage.getTimetableStructureBySchool(schoolId);
      }
      
      if (structure) {
        this.timeSlots = [];
        const workingDays = structure.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const timeSlots = structure.timeSlots || [
          { period: 1, startTime: "08:00", endTime: "08:45" },
          { period: 2, startTime: "08:45", endTime: "09:30" },
          { period: 3, startTime: "09:30", endTime: "10:15" },
          { period: 4, startTime: "10:15", endTime: "11:00" },
          { period: 5, startTime: "11:15", endTime: "12:00" },
          { period: 6, startTime: "12:00", endTime: "12:45" },
          { period: 7, startTime: "12:45", endTime: "13:30" },
          { period: 8, startTime: "13:30", endTime: "14:15" },
        ];

        for (const day of workingDays) {
          for (const slot of timeSlots) {
            if (!slot.isBreak) { // Skip break periods for scheduling
              this.timeSlots.push({
                day,
                period: slot.period,
                startTime: slot.startTime,
                endTime: slot.endTime,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn("Could not load timetable structure, using defaults:", error);
      this.initializeTimeSlots();
    }
  }

  private initializeTimeSlots() {
    // Note: This is fallback for when structure can't be loaded - defaults to Mon-Sat
    // but structure should be loaded in most cases to respect working days config
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const periodTimes = [
      { period: 1, startTime: "08:00", endTime: "08:45" },
      { period: 2, startTime: "08:45", endTime: "09:30" },
      { period: 3, startTime: "09:30", endTime: "10:15" },
      { period: 4, startTime: "10:15", endTime: "11:00" },
      { period: 5, startTime: "11:15", endTime: "12:00" },
      { period: 6, startTime: "12:00", endTime: "12:45" },
      { period: 7, startTime: "12:45", endTime: "13:30" },
      { period: 8, startTime: "13:30", endTime: "14:15" },
    ];

    for (const day of days) {
      for (const time of periodTimes) {
        this.timeSlots.push({
          day,
          period: time.period,
          startTime: time.startTime,
          endTime: time.endTime,
        });
      }
    }
  }

  async generateTimetable(
    classId?: string, 
    userSchoolId?: string,
    progressCallback?: (update: { currentClassId: string; currentClassName: string; completedClasses: number; totalClasses: number; progress: number }) => void,
    targetClasses?: Class[]
  ): Promise<{ success: boolean; message: string; entriesCreated?: number; version?: string }> {
    try {

      // Get all data
      let classes: Class[];
      
      if (targetClasses !== undefined) {
        // targetClasses was explicitly provided (even if empty)
        if (targetClasses.length === 0) {
          return {
            success: false,
            message: "No classes selected for generation. Please select at least one class.",
          };
        }
        // Use pre-filtered classes (for targeted generation)
        console.log(`[GENERATE TIMETABLE] Using ${targetClasses.length} pre-filtered classes`);
        classes = targetClasses;
      } else if (classId) {
        // Generate timetable for specific class only
        const singleClass = await storage.getClass(classId);
        if (!singleClass) {
          return {
            success: false,
            message: "Class not found.",
          };
        }
        classes = [singleClass];
      } else {
        // Generate timetable for all classes in user's school
        if (userSchoolId) {
          // Pass schoolId directly to getClasses to fetch only classes from the specific school
          classes = await storage.getClasses(userSchoolId);
        } else {
          // If no user context, we can't determine school - require specific classId
          return {
            success: false,
            message: "Please generate timetable for specific classes.",
          };
        }
      }

      // Get schoolId from the class(es)
      const schoolId = classes[0]?.schoolId;
      
      if (!schoolId) {
        return {
          success: false,
          message: "Classes must be associated with a school.",
        };
      }

      const [subjects, teachers] = await Promise.all([
        storage.getSubjects(),
        storage.getTeachers(schoolId), // Only get teachers from the same school
      ]);



      if (classes.length === 0 || subjects.length === 0 || teachers.length === 0) {
        return {
          success: false,
          message: "Please ensure you have added classes, subjects, and teachers before generating timetable.",
        };
      }
      
      // Initialize time slots from structure
      await this.initializeFromStructure(schoolId);

      // Calculate totalClasses and initialize completedClasses counter
      const totalClasses = classes.length;
      let completedClasses = 0;

      // Calculate week range (current week) in IST timezone
      // Note: These variables are defined but not actively used in the generation logic
      // Keeping for potential future use or logging purposes
      const now = getCurrentDateTimeIST();
      const startOfWeek = getWeekStartDateIST(now);
      const weekStart = toISTDateString(startOfWeek);
      
      console.log(`[SCHEDULER IST] Current week starts: ${weekStart}`);

      // First, delete ALL old timetable entries for the classes being regenerated
      // This ensures a clean slate and prevents any database/UI mismatches
      for (const classData of classes) {
        await storage.deleteTimetableEntriesForClass(classData.id);
      }

      // Build constraints
      const constraints = await this.buildConstraints(classes);
      
      // Calculate total required periods from ALL constraints
      const totalRequiredPeriods = constraints.reduce((sum, constraint) => sum + constraint.periodsNeeded, 0);
      
      // Generate schedule using constraint satisfaction
      const { schedule, unassignedPeriods } = await this.solveSchedule(constraints, teachers, subjects, classes, progressCallback, totalClasses);

      if (schedule.length === 0) {
        return {
          success: false,
          message: "Unable to generate a valid timetable with current constraints. Please check teacher availability and subject requirements.",
        };
      }

      // Save to database
      await storage.bulkCreateTimetableEntries(schedule);

      // Auto-create weekly timetables for current week if they don't exist
      await this.createWeeklyTimetablesForCurrentWeek(classes, schedule, schoolId);

      // Create summary message with unassigned periods information
      let summaryMessage = `Timetable generated successfully with ${schedule.length} entries.`;
      
      if (unassignedPeriods.length > 0) {
        const totalMissing = unassignedPeriods.reduce((sum, item) => sum + item.missing, 0);
        
        summaryMessage += `\n\n⚠️ ${totalMissing} periods could not be assigned (${schedule.length} scheduled out of ${totalRequiredPeriods} total required).`;
        summaryMessage += `\n\nUnassigned Periods Summary:`;
        
        // Group by class for better readability
        const byClass = new Map<string, typeof unassignedPeriods>();
        unassignedPeriods.forEach(item => {
          if (!byClass.has(item.className)) {
            byClass.set(item.className, []);
          }
          byClass.get(item.className)!.push(item);
        });
        
        byClass.forEach((items, className) => {
          summaryMessage += `\n\n📚 ${className}:`;
          items.forEach(item => {
            summaryMessage += `\n  • ${item.subjectName} (${item.teacherName}): ${item.scheduled}/${item.required} periods scheduled (${item.missing} missing)`;
          });
        });
        
        summaryMessage += `\n\nℹ️ These periods could not be scheduled due to teacher conflicts, daily workload limits, or scheduling constraints. You can manually add them where free slots are available.`;
      }

      return {
        success: true,
        message: summaryMessage,
        entriesCreated: schedule.length,
      };
    } catch (error) {
      console.error("Error generating timetable:", error);
      return {
        success: false,
        message: "An error occurred while generating the timetable. Please try again.",
      };
    }
  }

  /**
   * Helper function to get the Monday of the current week in IST (UTC+5:30)
   * For Indian users, all week calculations should be based on IST
   * Returns the date that will be stored in the DATE column (PostgreSQL will store just the date part)
   */
  private getCurrentWeekMonday(): Date {
    // Use shared IST utility for consistent timezone handling
    const now = getCurrentDateTimeIST();
    return getWeekStartDateIST(now);
  }

  /**
   * Auto-create weekly timetables for the current week based on newly generated master timetables
   * Optimized to use batch queries instead of N+1 queries
   */
  private async createWeeklyTimetablesForCurrentWeek(
    classes: Class[],
    masterEntries: InsertTimetableEntry[],
    schoolId: string
  ): Promise<void> {
    try {
      const currentWeekMonday = this.getCurrentWeekMonday();
      const currentWeekMondayStr = toISTDateString(currentWeekMonday);
      console.log(`[WEEKLY AUTO-CREATE] Checking weekly timetables for current week starting: ${currentWeekMondayStr}`);

      // OPTIMIZATION 1: Fetch admin user ONCE before the loop (was called for every class!)
      const adminUsers = await storage.getUsersBySchoolId(schoolId);
      const adminUser = adminUsers.find((u: any) => u.role === 'admin' || u.role === 'super_admin');
      
      if (!adminUser) {
        console.error(`[WEEKLY AUTO-CREATE] No admin user found for school ${schoolId} - skipping weekly timetable creation`);
        return;
      }

      // OPTIMIZATION 2: Batch fetch all weekly timetables in ONE query instead of N queries
      const classIds = classes.map(c => c.id);
      const existingWeeklyTimetables = await storage.getWeeklyTimetablesBatch(classIds, currentWeekMonday);
      console.log(`[WEEKLY AUTO-CREATE] Batch fetched existing timetables for ${classIds.length} classes`);

      for (const classData of classes) {
        // Check if a weekly timetable already exists using the batch-fetched data
        const existingWeeklyTimetable = existingWeeklyTimetables.get(classData.id);

        if (existingWeeklyTimetable) {
          console.log(`[WEEKLY AUTO-CREATE] Weekly timetable already exists for class ${classData.grade} ${classData.section} - skipping`);
          continue;
        }

        // Get the master timetable entries for this class that were just created
        const classEntries = masterEntries.filter(entry => entry.classId === classData.id);

        if (classEntries.length === 0) {
          console.log(`[WEEKLY AUTO-CREATE] No master entries found for class ${classData.grade} ${classData.section} - skipping`);
          continue;
        }

        // Convert master entries to weekly timetable data format
        const weeklyTimetableData = classEntries.map(entry => ({
          day: entry.day,
          period: entry.period,
          teacherId: entry.teacherId,
          subjectId: entry.subjectId,
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room || null,
          isModified: false, // Not modified since it's a direct copy
        }));

        // Create the weekly timetable using the admin user fetched once above
        try {
          await storage.createOrUpdateWeeklyTimetable(
            classData.id,
            currentWeekMonday,
            weeklyTimetableData,
            adminUser.id,
            schoolId
          );
          console.log(`[WEEKLY AUTO-CREATE] Created weekly timetable for class ${classData.grade} ${classData.section} with ${weeklyTimetableData.length} entries`);
        } catch (error) {
          console.error(`[WEEKLY AUTO-CREATE] Failed to create weekly timetable for class ${classData.grade} ${classData.section}:`, error);
        }
      }

      console.log(`[WEEKLY AUTO-CREATE] Completed weekly timetable auto-creation for ${classes.length} classes`);
    } catch (error) {
      console.error('[WEEKLY AUTO-CREATE] Error in createWeeklyTimetablesForCurrentWeek:', error);
      // Don't throw - this is a non-critical enhancement, master timetable generation should still succeed
    }
  }

  private async buildConstraints(classes: Class[]): Promise<ScheduleConstraint[]> {
    const constraints: ScheduleConstraint[] = [];

    // OPTIMIZATION: Fetch ALL class subject assignments for the school in ONE query instead of N queries
    const schoolId = classes[0]?.schoolId;
    if (!schoolId) {
      return constraints;
    }

    // Get all assignments for the entire school at once
    const allAssignments = await storage.getClassSubjectAssignments(undefined, schoolId);
    console.log(`[BUILD CONSTRAINTS] Batch fetched ${allAssignments.length} assignments for school ${schoolId}`);

    // Create a map for efficient lookup by classId
    const assignmentsByClass = new Map<string, typeof allAssignments>();
    for (const assignment of allAssignments) {
      if (!assignmentsByClass.has(assignment.classId)) {
        assignmentsByClass.set(assignment.classId, []);
      }
      assignmentsByClass.get(assignment.classId)!.push(assignment);
    }

    // Build constraints using the pre-fetched data
    for (const classData of classes) {
      const assignments = assignmentsByClass.get(classData.id) || [];
      
      for (const assignment of assignments) {
        // Get the assigned teacher for this class-subject combination
        const assignedTeachers = assignment.assignedTeacherId ? [assignment.assignedTeacherId] : [];
        
        constraints.push({
          classId: classData.id,
          subjectId: assignment.subjectId,
          periodsNeeded: assignment.weeklyFrequency,
          preferredTeachers: assignedTeachers,
        });
      }
    }

    return constraints;
  }

  private async solveSchedule(
    constraints: ScheduleConstraint[], 
    teachers: Teacher[], 
    subjects: Subject[],
    classes: Class[],
    progressCallback?: (update: { currentClassId: string; currentClassName: string; completedClasses: number; totalClasses: number; progress: number }) => void,
    totalClasses?: number
  ): Promise<{ schedule: InsertTimetableEntry[]; unassignedPeriods: Array<{ classId: string; className: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string; required: number; scheduled: number; missing: number }> }> {
    const schedule: InsertTimetableEntry[] = [];
    const assignments = new Map<string, Set<string>>(); // classId-day-period -> teacherId
    const teacherOccupancy = new Map<string, boolean>(); // teacherId-day-period -> isOccupied
    const dailySubjectCount = new Map<string, Map<string, number>>(); // classId-day-subjectId -> count
    const unassignedPeriods: Array<{ classId: string; className: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string; required: number; scheduled: number; missing: number }> = [];

    const schoolId = classes[0]?.schoolId;
    const classIds = classes.map(c => c.id);
    
    if (schoolId && classIds.length > 0) {
      console.log(`[SCHEDULER] Pre-loading existing timetables for school ${schoolId}, excluding ${classIds.length} classes being regenerated`);
      const existingEntries = await storage.getTimetableEntriesExcludingClasses(schoolId, classIds);
      console.log(`[SCHEDULER] Found ${existingEntries.length} existing timetable entries to respect`);
      
      for (const entry of existingEntries) {
        const occupancyKey = `${entry.teacherId}-${entry.day}-${entry.period}`;
        teacherOccupancy.set(occupancyKey, true);
      }
      
      console.log(`[SCHEDULER] Pre-populated teacher occupancy map with ${teacherOccupancy.size} occupied slots`);
    }

    // Helper function to get daily subject count
    const getDailySubjectCount = (classId: string, day: string, subjectId: string): number => {
      const dayKey = `${classId}-${day}`;
      return dailySubjectCount.get(dayKey)?.get(subjectId) || 0;
    };

    // Helper function to increment daily subject count
    const incrementDailySubjectCount = (classId: string, day: string, subjectId: string) => {
      const dayKey = `${classId}-${day}`;
      if (!dailySubjectCount.has(dayKey)) {
        dailySubjectCount.set(dayKey, new Map());
      }
      const dayMap = dailySubjectCount.get(dayKey)!;
      const currentCount = dayMap.get(subjectId) || 0;
      dayMap.set(subjectId, currentCount + 1);
    };

    // Helper function to find existing periods of a subject on a specific day
    const getSubjectPeriodsOnDay = (classId: string, day: string, subjectId: string): number[] => {
      return schedule
        .filter(entry => 
          entry.classId === classId && 
          entry.day === day && 
          entry.subjectId === subjectId
        )
        .map(entry => entry.period)
        .sort((a, b) => a - b);
    };

    // Helper function to find the best consecutive slot for a subject
    const findConsecutiveSlot = (classId: string, day: string, subjectId: string, timeSlots: typeof this.timeSlots): typeof timeSlots[0] | null => {
      const existingPeriods = getSubjectPeriodsOnDay(classId, day, subjectId);
      
      if (existingPeriods.length === 0) return null;
      
      // Look for slots immediately after existing periods
      for (const existingPeriod of existingPeriods) {
        const nextPeriod = existingPeriod + 1;
        const consecutiveSlot = timeSlots.find(slot => 
          slot.day === day && slot.period === nextPeriod
        );
        
        if (consecutiveSlot) {
          const slotKey = `${classId}-${day}-${nextPeriod}`;
          // Check if the consecutive slot is available
          if (!assignments.has(slotKey)) {
            return consecutiveSlot;
          }
        }
      }
      
      return null;
    };

    // Shuffle constraints for more varied scheduling
    const shuffledConstraints = [...constraints].sort(() => Math.random() - 0.5);

    // Calculate total constraints per class
    const classConstraintTotals = new Map<string, number>();
    for (const constraint of shuffledConstraints) {
      const current = classConstraintTotals.get(constraint.classId) || 0;
      classConstraintTotals.set(constraint.classId, current + 1);
    }

    // Track processed constraints per class
    const classConstraintProgress = new Map<string, number>();

    // Track progress through constraint processing
    const totalConstraints = shuffledConstraints.length;
    let processedConstraints = 0;
    let previousCompletedClasses = 0;

    for (const constraint of shuffledConstraints) {
      // Increment processed constraints counter
      processedConstraints++;

      // Update class progress
      const currentProgress = classConstraintProgress.get(constraint.classId) || 0;
      classConstraintProgress.set(constraint.classId, currentProgress + 1);

      // Calculate completed classes (those with all constraints processed)
      const completedClasses = Array.from(classConstraintTotals.keys()).filter(classId => {
        const total = classConstraintTotals.get(classId) || 0;
        const processed = classConstraintProgress.get(classId) || 0;
        return processed >= total;
      }).length;

      // Check if a class just completed
      const classJustCompleted = completedClasses > previousCompletedClasses;
      previousCompletedClasses = completedClasses;

      // Report progress: every 8 constraints OR when a class completes OR last constraint
      if (progressCallback && totalClasses && (processedConstraints % 8 === 0 || classJustCompleted || processedConstraints === totalConstraints)) {
        try {
          // Find the class being scheduled
          const classData = classes.find(c => c.id === constraint.classId);
          const className = classData ? `Class ${classData.grade} ${classData.section}` : 'Unknown Class';
          
          // Calculate progress: 20% to 80% range
          const progress = Math.min(80, 20 + (processedConstraints / totalConstraints) * 60);
          
          progressCallback({
            currentClassId: constraint.classId,
            currentClassName: className,
            completedClasses,
            totalClasses,
            progress
          });
        } catch (callbackError) {
          console.error('Error in progressCallback during constraint processing:', callbackError);
          // Continue with generation even if progress update fails
        }
      }
      const subject = subjects.find(s => s.id === constraint.subjectId);
      if (!subject) continue;

      // Use class subject assignments instead of teacher qualifications
      let eligibleTeachers: Teacher[] = [];
      
      // If there are assigned teachers from class subject assignments, use them exclusively
      if (constraint.preferredTeachers.length > 0) {
        eligibleTeachers = teachers.filter(t => 
          constraint.preferredTeachers.includes(t.id) && t.isActive
        );
      }

      if (eligibleTeachers.length === 0) {
        const assignedTeacherText = constraint.preferredTeachers.length > 0 
          ? ` (assigned teacher not found or inactive)`
          : ` (no teacher assigned)`;
        console.warn(`No teachers available for subject ${subject.name}${assignedTeacherText}`);
        continue;
      }

      let periodsScheduled = 0;
      
      // Create balanced slot ordering that distributes across all days including Saturday
      const createBalancedSlots = () => {
        // Group slots by period to ensure balanced distribution across days
        const slotsByPeriod = new Map<number, TimeSlot[]>();
        this.timeSlots.forEach(slot => {
          if (!slotsByPeriod.has(slot.period)) {
            slotsByPeriod.set(slot.period, []);
          }
          slotsByPeriod.get(slot.period)!.push(slot);
        });
        
        // Create interleaved ordering: period 1 from all days, then period 2 from all days, etc.
        const balancedSlots: TimeSlot[] = [];
        const periods = Array.from(slotsByPeriod.keys()).sort((a, b) => a - b);
        
        for (const period of periods) {
          const periodSlots = slotsByPeriod.get(period)!;
          // Shuffle days within each period to avoid always starting with Monday
          const shuffledPeriodSlots = [...periodSlots].sort(() => Math.random() - 0.5);
          balancedSlots.push(...shuffledPeriodSlots);
        }
        
        return balancedSlots;
      };
      
      // Get balanced slot ordering
      const balancedTimeSlots = createBalancedSlots();
      
      // Sort for consecutive scheduling and daily balance
      const prioritizedTimeSlots = [...balancedTimeSlots].sort((a, b) => {
        const aCount = getDailySubjectCount(constraint.classId, a.day, constraint.subjectId);
        const bCount = getDailySubjectCount(constraint.classId, b.day, constraint.subjectId);
        
        // Check if slots are consecutive to existing periods of same subject
        const aConsecutive = findConsecutiveSlot(constraint.classId, a.day, constraint.subjectId, this.timeSlots);
        const bConsecutive = findConsecutiveSlot(constraint.classId, b.day, constraint.subjectId, this.timeSlots);
        
        // Prioritize consecutive slots when there's already one period of the subject on that day
        if (aConsecutive && a.day === aConsecutive.day && a.period === aConsecutive.period) {
          return -1; // a is consecutive, prioritize it
        }
        if (bConsecutive && b.day === bConsecutive.day && b.period === bConsecutive.period) {
          return 1; // b is consecutive, prioritize it
        }
        
        // Then prioritize days with fewer existing periods of this subject
        if (aCount !== bCount) {
          return aCount - bCount;
        }
        
        // Maintain the balanced period ordering (don't randomize further)
        return 0;
      });

      // First pass: Try to schedule with consecutive preference
      for (const timeSlot of prioritizedTimeSlots) {
        if (periodsScheduled >= constraint.periodsNeeded) break;

        const slotKey = `${constraint.classId}-${timeSlot.day}-${timeSlot.period}`;
        
        // Check if slot is already occupied for this class
        if (assignments.has(slotKey)) continue;

        // Check daily subject limit - no more than 2 periods of same subject per day
        const currentDailyCount = getDailySubjectCount(constraint.classId, timeSlot.day, constraint.subjectId);
        if (currentDailyCount >= 2) continue;
        
        // PREFERENCE: If there's already one period of this subject on this day, 
        // prefer consecutive periods (but don't require it in second pass)
        if (currentDailyCount === 1) {
          const existingPeriods = getSubjectPeriodsOnDay(constraint.classId, timeSlot.day, constraint.subjectId);
          const isConsecutive = existingPeriods.some(period => 
            Math.abs(period - timeSlot.period) === 1
          );
          
          // If not consecutive to existing period, skip this slot (for now - will retry in second pass)
          if (!isConsecutive) continue;
        }

        // Find available teacher for this slot with enhanced checks
        const availableTeacher = eligibleTeachers.find(teacher => {
          // Check if teacher is available in this time slot
          // Handle the boolean availability format used in the database
          const dayKey = timeSlot.day.toLowerCase() as keyof typeof teacher.availability;
          const dayAvailability = teacher.availability[dayKey];
          
          // Handle different availability formats
          if (typeof dayAvailability === 'boolean') {
            // Boolean format: true = available, false = not available
            if (dayAvailability === false) {
              return false;
            }
          } else if (Array.isArray(dayAvailability)) {
            // Array format: specific time slots
            const availabilityArray = dayAvailability as string[];
            if (availabilityArray.length > 0) {
              // Check if teacher is available during this specific time slot
              const timeSlotStr = `${timeSlot.startTime}-${timeSlot.endTime}`;
              if (!availabilityArray.includes(timeSlotStr)) {
                return false;
              }
            }
            // Empty array means available all day
          }
          // For any other format or undefined, assume available

          // Check teacher occupancy to prevent double-booking across classes
          const teacherOccupancyKey = `${teacher.id}-${timeSlot.day}-${timeSlot.period}`;
          if (teacherOccupancy.has(teacherOccupancyKey)) {
            return false;
          }

          // Check daily period limits for teacher
          const teacherDailyHours = this.getTeacherDailyHours(teacher.id, timeSlot.day, schedule);
          if (teacherDailyHours >= teacher.maxDailyPeriods) {
            return false;
          }
          
          return true;
        });

        if (availableTeacher) {
          // Make assignment
          const assignmentSet = new Set<string>();
          assignmentSet.add(availableTeacher.id);
          assignments.set(slotKey, assignmentSet);

          // Record teacher occupancy to prevent double-booking
          const teacherOccupancyKey = `${availableTeacher.id}-${timeSlot.day}-${timeSlot.period}`;
          teacherOccupancy.set(teacherOccupancyKey, true);

          // Increment daily subject count
          incrementDailySubjectCount(constraint.classId, timeSlot.day, constraint.subjectId);

          // Find the class to get its academic session ID
          const classData = classes.find(c => c.id === constraint.classId);
          
          schedule.push({
            classId: constraint.classId,
            teacherId: availableTeacher.id,
            subjectId: constraint.subjectId,
            day: timeSlot.day as any,
            period: timeSlot.period,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime,
            room: null,
            isActive: true,
            academicSessionId: classData?.academicSessionId || null,
          });

          periodsScheduled++;
        }
      }

      // Second pass: If we still need more periods, try WITHOUT consecutive constraint
      if (periodsScheduled < constraint.periodsNeeded) {
        console.log(`[SECOND PASS] Attempting to schedule ${constraint.periodsNeeded - periodsScheduled} more periods for ${subject.name} without consecutive constraint`);
        
        for (const timeSlot of balancedTimeSlots) {
          if (periodsScheduled >= constraint.periodsNeeded) break;

          const slotKey = `${constraint.classId}-${timeSlot.day}-${timeSlot.period}`;
          
          // Check if slot is already occupied for this class
          if (assignments.has(slotKey)) continue;

          // Check daily subject limit - no more than 2 periods of same subject per day
          const currentDailyCount = getDailySubjectCount(constraint.classId, timeSlot.day, constraint.subjectId);
          if (currentDailyCount >= 2) continue;
          
          // NO consecutive constraint in second pass - just find any available slot

          // Find available teacher for this slot
          const availableTeacher = eligibleTeachers.find(teacher => {
            const dayKey = timeSlot.day.toLowerCase() as keyof typeof teacher.availability;
            const dayAvailability = teacher.availability[dayKey];
            
            if (typeof dayAvailability === 'boolean') {
              if (dayAvailability === false) {
                return false;
              }
            } else if (Array.isArray(dayAvailability)) {
              const availabilityArray = dayAvailability as string[];
              if (availabilityArray.length > 0) {
                const timeSlotStr = `${timeSlot.startTime}-${timeSlot.endTime}`;
                if (!availabilityArray.includes(timeSlotStr)) {
                  return false;
                }
              }
            }

            const teacherOccupancyKey = `${teacher.id}-${timeSlot.day}-${timeSlot.period}`;
            if (teacherOccupancy.has(teacherOccupancyKey)) {
              return false;
            }

            const teacherDailyHours = this.getTeacherDailyHours(teacher.id, timeSlot.day, schedule);
            if (teacherDailyHours >= teacher.maxDailyPeriods) {
              return false;
            }
            
            return true;
          });

          if (availableTeacher) {
            const assignmentSet = new Set<string>();
            assignmentSet.add(availableTeacher.id);
            assignments.set(slotKey, assignmentSet);

            const teacherOccupancyKey = `${availableTeacher.id}-${timeSlot.day}-${timeSlot.period}`;
            teacherOccupancy.set(teacherOccupancyKey, true);

            incrementDailySubjectCount(constraint.classId, timeSlot.day, constraint.subjectId);

            const classData = classes.find(c => c.id === constraint.classId);
            
            schedule.push({
              classId: constraint.classId,
              teacherId: availableTeacher.id,
              subjectId: constraint.subjectId,
              day: timeSlot.day as any,
              period: timeSlot.period,
              startTime: timeSlot.startTime,
              endTime: timeSlot.endTime,
              room: null,
              isActive: true,
              academicSessionId: classData?.academicSessionId || null,
            });

            periodsScheduled++;
            console.log(`[SECOND PASS] Successfully scheduled period for ${subject.name} at ${timeSlot.day} period ${timeSlot.period}`);
          }
        }
      }

      if (periodsScheduled < constraint.periodsNeeded) {
        const missing = constraint.periodsNeeded - periodsScheduled;
        console.warn(
          `Could only schedule ${periodsScheduled}/${constraint.periodsNeeded} periods for ${subject.name} (${missing} missing)`
        );
        
        // Track unassigned periods for summary
        const classData = classes.find(c => c.id === constraint.classId);
        const teacherData = eligibleTeachers[0]; // Get primary teacher
        
        unassignedPeriods.push({
          classId: constraint.classId,
          className: classData ? `Class ${classData.grade} ${classData.section}` : 'Unknown',
          subjectId: constraint.subjectId,
          subjectName: subject.name,
          teacherId: teacherData?.id || 'N/A',
          teacherName: teacherData?.name || 'No teacher assigned',
          required: constraint.periodsNeeded,
          scheduled: periodsScheduled,
          missing: missing
        });
      }
    }

    // Ensure final progress update to reach 80% and show all classes complete
    if (progressCallback && totalClasses) {
      try {
        const finalCompletedClasses = totalClasses; // All classes done
        progressCallback({
          currentClassId: '', 
          currentClassName: 'Finalizing...',
          completedClasses: finalCompletedClasses,
          totalClasses,
          progress: 80
        });
      } catch (error) {
        console.error('Error in final progressCallback:', error);
      }
    }

    return { schedule, unassignedPeriods };
  }

  // Helper method to count teacher's daily hours
  private getTeacherDailyHours(teacherId: string, day: string, schedule: InsertTimetableEntry[]): number {
    return schedule.filter(
      entry => entry.teacherId === teacherId && entry.day === day
    ).length;
  }

  // Enhanced conflict detection with daily period limits
  private async hasConflictEnhanced(
    teacherId: string,
    classId: string,
    day: string,
    period: number,
    schedule: InsertTimetableEntry[],
    teachers: Teacher[]
  ): Promise<boolean> {
    // Check for time slot conflicts
    const timeConflict = schedule.some(
      entry =>
        (entry.teacherId === teacherId || entry.classId === classId) &&
        entry.day === day &&
        entry.period === period
    );

    if (timeConflict) return true;

    // Check daily period limits
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher) {
      const dailyPeriods = this.getTeacherDailyHours(teacherId, day, schedule);
      if (dailyPeriods >= teacher.maxDailyPeriods) {
        return true;
      }
    }

    return false;
  }

  // Enhanced availability check for substitute assignment
  async isTeacherAvailableForSubstitute(
    teacherId: string,
    day: string,
    period: number,
    date: string,
    excludeEntryId?: string
  ): Promise<boolean> {
    try {
      // Check if teacher is absent on this date
      const isAbsent = await storage.isTeacherAbsent(teacherId, date);
      if (isAbsent) return false;

      // Check existing timetable conflicts
      const schedule = await storage.getTimetableForTeacher(teacherId);
      const hasConflict = schedule.some(
        entry =>
          entry.id !== excludeEntryId &&
          entry.day === day &&
          entry.period === period
      );

      if (hasConflict) return false;

      // Check daily period limits
      const teacher = await storage.getTeacher(teacherId);
      if (teacher) {
        const dailySchedule = schedule.filter(entry => entry.day === day);
        if (dailySchedule.length >= teacher.maxDailyPeriods) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error checking teacher availability:", error);
      return false;
    }
  }

  // Workload balancing method for enhanced scheduling
  async optimizeTeacherWorkload(schoolId: string): Promise<{ success: boolean; message: string; analytics?: any }> {
    try {
      const analytics = await storage.getTeacherWorkloadAnalytics(schoolId);
      
      // Find overloaded teachers
      const overloadedTeachers = analytics.teachers.filter((t: any) => t.isOverloaded);
      
      if (overloadedTeachers.length === 0) {
        return {
          success: true,
          message: "All teachers are within their daily period limits",
          analytics
        };
      }

      // For each overloaded teacher, try to redistribute periods
      for (const teacher of overloadedTeachers) {
        console.log(`Attempting to rebalance workload for teacher: ${teacher.teacherName}`);
        // This would involve complex logic to reassign periods
        // For now, we'll return the analytics for manual review
      }

      return {
        success: true,
        message: `Found ${overloadedTeachers.length} overloaded teachers. Manual review recommended.`,
        analytics
      };
    } catch (error) {
      console.error("Error optimizing teacher workload:", error);
      return {
        success: false,
        message: "Failed to optimize teacher workload"
      };
    }
  }

  async validateTimetable(): Promise<{ isValid: boolean; conflicts: string[] }> {
    const conflicts: string[] = [];
    
    try {
      const timetableEntries = await storage.getTimetableEntries();
      
      // Check for teacher double-booking conflicts
      const teacherSchedule = new Map<string, Set<string>>();
      
      for (const entry of timetableEntries) {
        const slotKey = `${entry.day}-${entry.period}`;
        
        if (!teacherSchedule.has(entry.teacherId)) {
          teacherSchedule.set(entry.teacherId, new Set());
        }
        
        const teacherSlots = teacherSchedule.get(entry.teacherId)!;
        
        if (teacherSlots.has(slotKey)) {
          // Find the other class this teacher is assigned to at the same time
          const conflictEntry = timetableEntries.find(e => 
            e.teacherId === entry.teacherId && 
            e.day === entry.day && 
            e.period === entry.period && 
            e.classId !== entry.classId
          );
          
          if (conflictEntry) {
            conflicts.push(
              `Teacher conflict: Teacher ${entry.teacherId} is scheduled for both Class ${entry.classId} and Class ${conflictEntry.classId} on ${entry.day} period ${entry.period}`
            );
          }
        } else {
          teacherSlots.add(slotKey);
        }
      }
      
      // Check for classroom conflicts (if room assignments exist)
      const roomSchedule = new Map<string, Set<string>>();
      
      for (const entry of timetableEntries) {
        if (!entry.room) continue;
        
        const slotKey = `${entry.day}-${entry.period}`;
        
        if (!roomSchedule.has(entry.room)) {
          roomSchedule.set(entry.room, new Set());
        }
        
        const roomSlots = roomSchedule.get(entry.room)!;
        
        if (roomSlots.has(slotKey)) {
          conflicts.push(
            `Room conflict: Room ${entry.room} is double-booked on ${entry.day} period ${entry.period}`
          );
        } else {
          roomSlots.add(slotKey);
        }
      }
      
      // Check if classes have proper subject distribution
      const classSubjectCount = new Map<string, Map<string, number>>();
      
      for (const entry of timetableEntries) {
        if (!classSubjectCount.has(entry.classId)) {
          classSubjectCount.set(entry.classId, new Map());
        }
        
        const subjectCount = classSubjectCount.get(entry.classId)!;
        const currentCount = subjectCount.get(entry.subjectId) || 0;
        subjectCount.set(entry.subjectId, currentCount + 1);
      }
      
      // Check against required weekly frequencies
      const classes = await storage.getClasses();
      
      for (const classData of classes) {
        const assignments = await storage.getClassSubjectAssignments(classData.id);
        const actualCounts = classSubjectCount.get(classData.id) || new Map();
        
        for (const assignment of assignments) {
          const actualCount = actualCounts.get(assignment.subjectId) || 0;
          
          if (actualCount < assignment.weeklyFrequency) {
            conflicts.push(
              `Insufficient periods: Class ${classData.grade}-${classData.section} needs ${assignment.weeklyFrequency} periods of ${assignment.subject?.name || 'Unknown Subject'} but only has ${actualCount}`
            );
          }
          
          if (actualCount > assignment.weeklyFrequency) {
            conflicts.push(
              `Excess periods: Class ${classData.grade}-${classData.section} has ${actualCount} periods of ${assignment.subject?.name || 'Unknown Subject'} but only needs ${assignment.weeklyFrequency}`
            );
          }
        }
      }
      
    } catch (error) {
      console.error("Error validating timetable:", error);
      conflicts.push("Unable to validate timetable due to system error");
    }
    
    return {
      isValid: conflicts.length === 0,
      conflicts,
    };
  }

  async suggestOptimizations(): Promise<string[]> {
    const suggestions: string[] = [];
    
    try {
      const [timetableEntries, teachers] = await Promise.all([
        storage.getTimetableEntries(),
        storage.getTeachers(),
      ]);

      // Check teacher workload distribution
      const teacherWorkload = new Map<string, number>();
      for (const entry of timetableEntries) {
        const current = teacherWorkload.get(entry.teacherId) || 0;
        teacherWorkload.set(entry.teacherId, current + 1);
      }

      const workloads = Array.from(teacherWorkload.values());
      const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
      const maxWorkload = Math.max(...workloads);
      const minWorkload = Math.min(...workloads);

      if (maxWorkload - minWorkload > avgWorkload * 0.3) {
        suggestions.push("Consider redistributing teacher workload for better balance.");
      }

      // Check for morning vs afternoon distribution
      const morningPeriods = timetableEntries.filter(e => e.period <= 4).length;
      const afternoonPeriods = timetableEntries.filter(e => e.period >= 5).length;
      
      if (afternoonPeriods > morningPeriods * 1.5) {
        suggestions.push("Consider moving some subjects to morning hours for better student engagement.");
      }

      // Check for consecutive same subjects
      const dailySchedules = new Map<string, Map<string, string[]>>();
      for (const entry of timetableEntries) {
        if (!dailySchedules.has(entry.classId)) {
          dailySchedules.set(entry.classId, new Map());
        }
        const classSchedule = dailySchedules.get(entry.classId)!;
        if (!classSchedule.has(entry.day)) {
          classSchedule.set(entry.day, []);
        }
        classSchedule.get(entry.day)!.push(entry.subjectId);
      }

      let hasConsecutiveSameSubjects = false;
      dailySchedules.forEach((schedule, classId) => {
        schedule.forEach((subjects, day) => {
          for (let i = 0; i < subjects.length - 1; i++) {
            if (subjects[i] === subjects[i + 1]) {
              hasConsecutiveSameSubjects = true;
              return;
            }
          }
        });
      });

      if (hasConsecutiveSameSubjects) {
        suggestions.push("Avoid scheduling the same subject in consecutive periods for better learning outcomes.");
      }

      if (suggestions.length === 0) {
        suggestions.push("Current timetable appears well-optimized. No major issues detected.");
      }

    } catch (error) {
      console.error("Error generating optimization suggestions:", error);
      suggestions.push("Unable to analyze timetable for optimization opportunities.");
    }

    return suggestions;
  }
}

export const scheduler = new TimetableScheduler();
