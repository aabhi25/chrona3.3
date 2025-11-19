import { storage } from "../storage";
import { scheduler } from "./scheduler";
import type { Teacher, Subject, Class, TimetableEntry } from "@shared/schema";

export interface ManualAssignmentRequest {
  classId: string;
  teacherId?: string | null; // null for free period
  subjectId?: string | null; // null for free period
  day: string;
  period: number;
  weekStart: string; // ISO date
  existingEntryId?: string; // for edits vs new assignments
}

export interface ValidationConflict {
  type: 'teacher_conflict' | 'period_limit' | 'availability' | 'qualification' | 'class_conflict';
  severity: 'error' | 'warning';
  message: string;
  details: any;
}

export interface ValidationSuggestion {
  type: 'alternative_teacher' | 'alternative_time';
  teacherId?: string;
  teacherName?: string;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: ValidationConflict[];
  suggestions?: ValidationSuggestion[];
}

export class ManualTimetableValidationService {

  /**
   * Validate a manual timetable assignment
   */
  async validateManualAssignment(request: ManualAssignmentRequest, userSchoolId: string): Promise<ValidationResult> {
    console.log(`[MANUAL VALIDATION] Validating assignment for class ${request.classId}, day ${request.day}, period ${request.period}`);
    
    const conflicts: ValidationConflict[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Get necessary data
      const classData = await storage.getClass(request.classId);
      if (!classData || classData.schoolId !== userSchoolId) {
        conflicts.push({
          type: 'class_conflict',
          severity: 'error',
          message: 'Invalid class or access denied',
          details: { classId: request.classId }
        });
        return { isValid: false, conflicts, suggestions };
      }

      // If this is a free period (no teacher/subject), only check for class conflicts
      if (!request.teacherId || !request.subjectId) {
        const classConflict = await this.checkClassConflict(request);
        if (classConflict) {
          conflicts.push(classConflict);
        }
        return { 
          isValid: conflicts.length === 0, 
          conflicts, 
          suggestions: conflicts.length === 0 ? [] : await this.generateSuggestions(request, userSchoolId)
        };
      }

      // Get teacher and subject data
      const [teacher, subject] = await Promise.all([
        storage.getTeacher(request.teacherId),
        storage.getSubject(request.subjectId)
      ]);

      if (!teacher || teacher.schoolId !== userSchoolId) {
        conflicts.push({
          type: 'teacher_conflict',
          severity: 'error',
          message: 'Invalid teacher or access denied',
          details: { teacherId: request.teacherId }
        });
      }

      if (!subject || subject.schoolId !== userSchoolId) {
        conflicts.push({
          type: 'qualification',
          severity: 'error',
          message: 'Invalid subject or access denied',
          details: { subjectId: request.subjectId }
        });
      }

      if (conflicts.length > 0) {
        return { isValid: false, conflicts, suggestions };
      }

      // Run all validation checks in parallel
      const [
        teacherConflict,
        periodLimitCheck,
        availabilityCheck,
        qualificationCheck,
        classConflict
      ] = await Promise.all([
        this.checkTeacherConflict(request, teacher!),
        this.checkDailyPeriodLimit(request, teacher!),
        this.checkTeacherAvailability(request, teacher!),
        this.checkSubjectQualification(request, teacher!, subject!),
        this.checkClassConflict(request)
      ]);

      // Collect all conflicts with detailed logging
      [teacherConflict, periodLimitCheck, availabilityCheck, qualificationCheck, classConflict]
        .filter(Boolean)
        .forEach(conflict => {
          conflicts.push(conflict!);
          console.log(`[MANUAL VALIDATION] Conflict found for teacher ${teacher!.name}: ${conflict!.type} (${conflict!.severity}) - ${conflict!.message}`);
        });

      // Generate suggestions if there are conflicts
      if (conflicts.length > 0) {
        const generatedSuggestions = await this.generateSuggestions(request, userSchoolId);
        suggestions.push(...generatedSuggestions);
      }

      // isValid should only be false for ERROR-level conflicts, not warnings
      const hasErrors = conflicts.some(c => c.severity === 'error');
      console.log(`[MANUAL VALIDATION] Teacher ${teacher!.name} validation complete: ${hasErrors ? 'INVALID' : 'VALID'} with ${conflicts.length} total conflicts (${conflicts.filter(c => c.severity === 'error').length} errors, ${conflicts.filter(c => c.severity === 'warning').length} warnings)`);

      return {
        isValid: !hasErrors,  // Only invalid if there are ERROR-level conflicts
        conflicts,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };

    } catch (error) {
      console.error("[MANUAL VALIDATION] Error during validation:", error);
      conflicts.push({
        type: 'teacher_conflict',
        severity: 'error',
        message: 'Validation failed due to system error',
        details: { error: error instanceof Error ? error.message : String(error) }
      });
      return { isValid: false, conflicts, suggestions };
    }
  }

  /**
   * Check if teacher is double-booked at the same time
   */
  private async checkTeacherConflict(request: ManualAssignmentRequest, teacher: Teacher): Promise<ValidationConflict | null> {
    try {
      // Get the date for this week
      const weekStartDate = new Date(request.weekStart);
      const assignmentDate = this.getDateForDayOfWeek(weekStartDate, request.day);
      
      // Get academic session ID from the class
      const classData = await storage.getClass(request.classId);
      const academicSessionId = classData?.academicSessionId || undefined;
      
      // Check if teacher is available at this time
      const isAvailable = await storage.isTeacherAvailable(
        request.teacherId!, 
        request.day, 
        request.period, 
        assignmentDate.toISOString().split('T')[0],
        academicSessionId
      );

      if (!isAvailable) {
        // Get conflicting assignment details
        const teacherSchedule = await storage.getTeacherSchedule(request.teacherId!, assignmentDate.toISOString().split('T')[0]);
        const conflictingEntry = teacherSchedule.find(entry => 
          entry.day === request.day && 
          entry.period === request.period &&
          entry.id !== request.existingEntryId // Exclude the entry being edited
        );

        let conflictDetails = { 
          teacherId: request.teacherId, 
          teacherName: teacher.name,
          day: request.day,
          period: request.period
        };

        if (conflictingEntry) {
          const conflictingClass = await storage.getClass(conflictingEntry.classId);
          const conflictingSubject = conflictingEntry.subjectId ? await storage.getSubject(conflictingEntry.subjectId) : null;
          
          conflictDetails = {
            ...conflictDetails,
            conflictingClass: conflictingClass?.name || 'Unknown Class',
            conflictingSubject: conflictingSubject?.name || 'Unknown Subject'
          };
        }

        return {
          type: 'teacher_conflict',
          severity: 'error',
          message: `Teacher ${teacher.name} is already assigned to another class at ${request.day} period ${request.period}`,
          details: conflictDetails
        };
      }

      return null;
    } catch (error) {
      console.error("[MANUAL VALIDATION] Error checking teacher conflict:", error);
      return {
        type: 'teacher_conflict',
        severity: 'error',
        message: 'Unable to verify teacher availability',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Check if teacher exceeds daily period limit
   */
  private async checkDailyPeriodLimit(request: ManualAssignmentRequest, teacher: Teacher): Promise<ValidationConflict | null> {
    try {
      // Get the date for this week
      const weekStartDate = new Date(request.weekStart);
      const assignmentDate = this.getDateForDayOfWeek(weekStartDate, request.day);
      
      // Get teacher's schedule for the day
      const teacherSchedule = await storage.getTeacherSchedule(request.teacherId!, assignmentDate.toISOString().split('T')[0]);
      
      // Count periods for this day, excluding the entry being edited
      const periodsOnDay = teacherSchedule.filter(entry => 
        entry.day === request.day && 
        entry.id !== request.existingEntryId
      ).length;

      // Add 1 for the new assignment (unless it's replacing an existing one)
      const totalPeriods = request.existingEntryId ? periodsOnDay : periodsOnDay + 1;
      
      if (totalPeriods > teacher.maxDailyPeriods) {
        return {
          type: 'period_limit',
          severity: 'error',
          message: `Teacher ${teacher.name} would exceed daily period limit (${totalPeriods}/${teacher.maxDailyPeriods})`,
          details: {
            teacherId: request.teacherId,
            teacherName: teacher.name,
            currentPeriods: periodsOnDay,
            maxDailyPeriods: teacher.maxDailyPeriods,
            wouldHave: totalPeriods
          }
        };
      }

      // Warning if approaching limit (80% or more)
      const utilizationPercent = (totalPeriods / teacher.maxDailyPeriods) * 100;
      if (utilizationPercent >= 80) {
        return {
          type: 'period_limit',
          severity: 'warning',
          message: `Teacher ${teacher.name} is approaching daily period limit (${totalPeriods}/${teacher.maxDailyPeriods})`,
          details: {
            teacherId: request.teacherId,
            teacherName: teacher.name,
            currentPeriods: periodsOnDay,
            maxDailyPeriods: teacher.maxDailyPeriods,
            utilizationPercent: Math.round(utilizationPercent)
          }
        };
      }

      return null;
    } catch (error) {
      console.error("[MANUAL VALIDATION] Error checking period limit:", error);
      return {
        type: 'period_limit',
        severity: 'error',
        message: 'Unable to verify teacher period limits',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Check if teacher is available (not on leave/absent)
   */
  private async checkTeacherAvailability(request: ManualAssignmentRequest, teacher: Teacher): Promise<ValidationConflict | null> {
    try {
      // Get the date for this week
      const weekStartDate = new Date(request.weekStart);
      const assignmentDate = this.getDateForDayOfWeek(weekStartDate, request.day);
      const dateString = assignmentDate.toISOString().split('T')[0];
      
      // Check if teacher is absent on this date
      const isAbsent = await storage.isTeacherAbsent(request.teacherId!, dateString);
      
      if (isAbsent) {
        return {
          type: 'availability',
          severity: 'error',
          message: `Teacher ${teacher.name} is marked as absent on ${dateString}`,
          details: {
            teacherId: request.teacherId,
            teacherName: teacher.name,
            date: dateString
          }
        };
      }

      return null;
    } catch (error) {
      console.error("[MANUAL VALIDATION] Error checking teacher availability:", error);
      return {
        type: 'availability',
        severity: 'error',
        message: 'Unable to verify teacher availability',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Check if teacher is qualified to teach this subject
   */
  private async checkSubjectQualification(request: ManualAssignmentRequest, teacher: Teacher, subject: Subject): Promise<ValidationConflict | null> {
    try {
      // Get teacher's subject assignments
      const teacherAssignments = await storage.getClassSubjectAssignmentsByTeacher(request.teacherId!);
      
      // Check if teacher is assigned to teach this subject in any class
      const isQualified = teacherAssignments.some(assignment => assignment.subjectId === request.subjectId);
      
      if (!isQualified) {
        return {
          type: 'qualification',
          severity: 'warning',
          message: `Teacher ${teacher.name} is not currently assigned to teach ${subject.name}`,
          details: {
            teacherId: request.teacherId,
            teacherName: teacher.name,
            subjectId: request.subjectId,
            subjectName: subject.name
          }
        };
      }

      return null;
    } catch (error) {
      console.error("[MANUAL VALIDATION] Error checking subject qualification:", error);
      return {
        type: 'qualification',
        severity: 'error',
        message: 'Unable to verify teacher qualification',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Check if class has a conflict at this time
   */
  private async checkClassConflict(request: ManualAssignmentRequest): Promise<ValidationConflict | null> {
    try {
      // Get class timetable
      const classTimetable = await storage.getTimetableForClass(request.classId);
      
      // Check for existing assignment at this time, excluding the entry being edited
      const conflictingEntry = classTimetable.find(entry => 
        entry.day === request.day && 
        entry.period === request.period &&
        entry.id !== request.existingEntryId
      );

      if (conflictingEntry) {
        const conflictingTeacher = conflictingEntry.teacherId ? await storage.getTeacher(conflictingEntry.teacherId) : null;
        const conflictingSubject = conflictingEntry.subjectId ? await storage.getSubject(conflictingEntry.subjectId) : null;
        
        return {
          type: 'class_conflict',
          severity: 'error',
          message: `Class already has an assignment at ${request.day} period ${request.period}`,
          details: {
            classId: request.classId,
            day: request.day,
            period: request.period,
            existingTeacher: conflictingTeacher?.name || 'Unknown Teacher',
            existingSubject: conflictingSubject?.name || 'Free Period'
          }
        };
      }

      return null;
    } catch (error) {
      console.error("[MANUAL VALIDATION] Error checking class conflict:", error);
      return {
        type: 'class_conflict',
        severity: 'error',
        message: 'Unable to verify class schedule',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  /**
   * Generate intelligent suggestions for resolving conflicts
   */
  private async generateSuggestions(request: ManualAssignmentRequest, schoolId: string): Promise<ValidationSuggestion[]> {
    const suggestions: ValidationSuggestion[] = [];

    try {
      // If no subject specified, can't suggest alternative teachers
      if (!request.subjectId) {
        return suggestions;
      }

      // Get available teachers for this subject at this time
      const availableTeachers = await storage.getAvailableTeachers(
        request.day,
        request.period,
        request.subjectId,
        schoolId
      );

      // Filter out the requested teacher if they have conflicts
      const alternativeTeachers = availableTeachers.filter(teacher => teacher.id !== request.teacherId);

      // Add suggestions for alternative teachers
      for (const teacher of alternativeTeachers.slice(0, 3)) { // Limit to top 3
        suggestions.push({
          type: 'alternative_teacher',
          teacherId: teacher.id,
          teacherName: teacher.name,
          reason: `${teacher.name} is available and qualified to teach this subject`
        });
      }

      // TODO: Add suggestions for alternative time slots
      // This would require more complex logic to find free slots for both teacher and class

    } catch (error) {
      console.error("[MANUAL VALIDATION] Error generating suggestions:", error);
    }

    return suggestions;
  }

  /**
   * Helper function to get date for a specific day of the week
   */
  private getDateForDayOfWeek(weekStart: Date, dayName: string): Date {
    const dayMap: { [key: string]: number } = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 0
    };

    const targetDay = dayMap[dayName.toLowerCase()];
    if (targetDay === undefined) {
      throw new Error(`Invalid day name: ${dayName}`);
    }

    const result = new Date(weekStart);
    const currentDay = result.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Adjust for Sunday = 0
    
    result.setDate(result.getDate() + mondayOffset + (targetDay - 1));
    return result;
  }
}

// Export singleton instance
export const manualTimetableValidationService = new ManualTimetableValidationService();