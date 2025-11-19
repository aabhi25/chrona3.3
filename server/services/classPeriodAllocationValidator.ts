import { db } from '../db';
import { timetableStructures, classSubjectAssignments, classes } from '@shared/schema';
import { eq, and, sum, sql } from 'drizzle-orm';
import { getClassName } from '@shared/classUtils';

export interface PeriodValidationError {
  classId: string;
  className: string;
  currentPeriods: number;
  requestedPeriods: number;
  maxPeriods: number;
  exceedBy: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: PeriodValidationError[];
}

export class ClassPeriodAllocationValidator {
  
  async getWeeklyPeriodCap(schoolId: string): Promise<number> {
    const structure = await db.query.timetableStructures.findFirst({
      where: eq(timetableStructures.schoolId, schoolId)
    });

    if (!structure) {
      const error: any = new Error('Timetable structure not configured for this school. Please set up the timetable structure in Settings before assigning subjects.');
      error.statusCode = 400;
      throw error;
    }

    const teachingPeriods = structure.timeSlots.filter((slot: { isBreak?: boolean }) => !slot.isBreak).length;
    const workingDays = structure.workingDays.length;
    const weeklyPeriodCap = teachingPeriods * workingDays;

    return weeklyPeriodCap;
  }

  async getCurrentAssignedPeriods(classId: string): Promise<number> {
    const result = await db
      .select({
        total: sum(classSubjectAssignments.weeklyFrequency)
      })
      .from(classSubjectAssignments)
      .where(eq(classSubjectAssignments.classId, classId));

    return Number(result[0]?.total || 0);
  }

  async validateAssignments(
    classId: string,
    newAssignments: Array<{ weeklyFrequency: number; subjectId?: string; id?: string }>,
    excludeAssignmentId?: string
  ): Promise<ValidationResult> {
    const classInfo = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
      columns: {
        id: true,
        grade: true,
        section: true,
        schoolId: true
      }
    });

    if (!classInfo) {
      const error: any = new Error('Class not found. The class may have been deleted.');
      error.statusCode = 404;
      throw error;
    }

    const maxPeriods = await this.getWeeklyPeriodCap(classInfo.schoolId);
    
    let currentPeriods = await this.getCurrentAssignedPeriods(classId);

    if (excludeAssignmentId) {
      const excludedAssignment = await db.query.classSubjectAssignments.findFirst({
        where: eq(classSubjectAssignments.id, excludeAssignmentId)
      });
      if (excludedAssignment) {
        currentPeriods -= excludedAssignment.weeklyFrequency;
      }
    }

    const requestedPeriods = newAssignments.reduce((sum, a) => sum + a.weeklyFrequency, 0);
    const totalPeriods = currentPeriods + requestedPeriods;

    if (totalPeriods > maxPeriods) {
      const className = getClassName(classInfo.grade, classInfo.section);
      const exceedBy = totalPeriods - maxPeriods;
      
      return {
        valid: false,
        errors: [{
          classId: classInfo.id,
          className,
          currentPeriods,
          requestedPeriods,
          maxPeriods,
          exceedBy,
          message: `${className} already has ${currentPeriods} period${currentPeriods !== 1 ? 's' : ''} assigned. Adding ${requestedPeriods} period${requestedPeriods !== 1 ? 's' : ''} would exceed the weekly limit of ${maxPeriods} periods (over by ${exceedBy}).`
        }]
      };
    }

    return {
      valid: true,
      errors: []
    };
  }

  async validateBulkAssignments(
    assignments: Array<{
      classId: string;
      weeklyFrequency: number;
      subjectId?: string;
      originalRowNumber?: number;
    }>
  ): Promise<{
    valid: boolean;
    errorsByClass: Map<string, PeriodValidationError>;
    errorsByRow: Map<number, PeriodValidationError>;
  }> {
    const assignmentsByClass = new Map<string, Array<typeof assignments[0]>>();
    
    for (const assignment of assignments) {
      if (!assignmentsByClass.has(assignment.classId)) {
        assignmentsByClass.set(assignment.classId, []);
      }
      assignmentsByClass.get(assignment.classId)!.push(assignment);
    }

    const errorsByClass = new Map<string, PeriodValidationError>();
    const errorsByRow = new Map<number, PeriodValidationError>();
    let valid = true;

    for (const [classId, classAssignments] of Array.from(assignmentsByClass.entries())) {
      const result = await this.validateAssignments(classId, classAssignments);
      
      if (!result.valid) {
        valid = false;
        const error = result.errors[0];
        errorsByClass.set(classId, error);
        
        for (const assignment of classAssignments) {
          if (assignment.originalRowNumber) {
            errorsByRow.set(assignment.originalRowNumber, error);
          }
        }
      }
    }

    return {
      valid,
      errorsByClass,
      errorsByRow
    };
  }
}

export const classPeriodValidator = new ClassPeriodAllocationValidator();
