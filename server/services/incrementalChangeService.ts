import { storage } from "../storage";
import { scheduler } from "./scheduler";
import type { 
  IncrementalChangeRequest, 
  InsertIncrementalChangeRequest,
  ConflictDetectionResult,
  InsertConflictDetectionResult,
  ChangeImpactAnalysis,
  InsertChangeImpactAnalysis,
  Class,
  Teacher,
  Subject,
  ClassSubjectAssignment
} from "@shared/schema";
import { getCurrentDateIST } from "@shared/utils/dateUtils";

export interface ChangeDetectionResult {
  hasChanges: boolean;
  changeType: 'add_class' | 'update_subject' | 'reassign_teacher' | 'add_subject' | 'remove_subject' | 'update_class_schedule';
  affectedEntities: {
    classes: string[];
    teachers: string[];
    subjects: string[];
  };
  estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'major';
  requiresApproval: boolean;
}

export interface ConflictInfo {
  type: 'teacher_overlap' | 'classroom_conflict' | 'subject_frequency' | 'teacher_capacity' | 'time_constraint';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedEntities: {
    teachers?: string[];
    classes?: string[];
    timeSlots?: { day: string; period: number }[];
  };
  proposedResolutions: {
    type: string;
    description: string;
    action: string;
    requiredApproval: boolean;
  }[];
}

export class IncrementalChangeService {
  
  /**
   * Detect changes when a new class is added
   */
  async detectClassAddition(classData: {
    grade: string;
    section: string;
    schoolId: string;
    academicSessionId: string;
  }): Promise<ChangeDetectionResult> {
    console.log(`[INCREMENTAL] Detecting changes for new class: ${classData.grade} ${classData.section}`);
    
    try {
      // Check for existing classes in the same grade
      const existingClasses = await storage.getClasses(classData.schoolId, classData.academicSessionId);
      const sameGradeClasses = existingClasses.filter(c => c.grade === classData.grade);
      
      // Analyze impact
      const estimatedImpact = sameGradeClasses.length > 0 ? 'moderate' : 'significant';
      const requiresApproval = sameGradeClasses.length > 2; // Require approval if many classes in grade
      
      return {
        hasChanges: true,
        changeType: 'add_class',
        affectedEntities: {
          classes: sameGradeClasses.map(c => c.id),
          teachers: [], // Will be determined during assignment
          subjects: [] // Will be determined during assignment
        },
        estimatedImpact,
        requiresApproval
      };
    } catch (error) {
      console.error("[INCREMENTAL] Error detecting class addition changes:", error);
      throw error;
    }
  }

  /**
   * Detect changes when a subject is modified
   */
  async detectSubjectUpdate(subjectId: string, changes: Partial<Subject>): Promise<ChangeDetectionResult> {
    console.log(`[INCREMENTAL] Detecting changes for subject update: ${subjectId}`);
    
    try {
      // Get affected class assignments
      const assignments = await storage.getClassSubjectAssignmentsBySubject(subjectId);
      const affectedClasses = assignments.map(a => a.classId);
      
      // Get teachers assigned to this subject
      const affectedTeachers = assignments
        .filter(a => a.assignedTeacherId)
        .map(a => a.assignedTeacherId!)
        .filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
      
      // Determine impact based on number of affected entities
      let estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'major' = 'minimal';
      if (affectedClasses.length > 5) {
        estimatedImpact = 'major';
      } else if (affectedClasses.length > 2) {
        estimatedImpact = 'significant';
      } else if (affectedClasses.length > 0) {
        estimatedImpact = 'moderate';
      }
      
      return {
        hasChanges: affectedClasses.length > 0,
        changeType: 'update_subject',
        affectedEntities: {
          classes: affectedClasses,
          teachers: affectedTeachers,
          subjects: [subjectId]
        },
        estimatedImpact,
        requiresApproval: estimatedImpact === 'major' || estimatedImpact === 'significant'
      };
    } catch (error) {
      console.error("[INCREMENTAL] Error detecting subject update changes:", error);
      throw error;
    }
  }

  /**
   * Detect changes when a teacher is reassigned
   */
  async detectTeacherReassignment(reassignmentData: {
    oldTeacherId: string;
    newTeacherId: string;
    affectedSubjects?: string[];
    affectedClasses?: string[];
  }): Promise<ChangeDetectionResult> {
    console.log(`[INCREMENTAL] Detecting changes for teacher reassignment: ${reassignmentData.oldTeacherId} -> ${reassignmentData.newTeacherId}`);
    
    try {
      // Get current assignments for the old teacher
      const oldTeacherAssignments = await storage.getClassSubjectAssignmentsByTeacher(reassignmentData.oldTeacherId);
      
      // Filter by affected subjects/classes if specified
      let affectedAssignments = oldTeacherAssignments;
      if (reassignmentData.affectedSubjects?.length) {
        affectedAssignments = affectedAssignments.filter(a => 
          reassignmentData.affectedSubjects!.includes(a.subjectId)
        );
      }
      if (reassignmentData.affectedClasses?.length) {
        affectedAssignments = affectedAssignments.filter(a => 
          reassignmentData.affectedClasses!.includes(a.classId)
        );
      }
      
      const affectedClasses = affectedAssignments.map(a => a.classId);
      const affectedSubjects = affectedAssignments.map(a => a.subjectId);
      
      // Check new teacher availability and capacity
      const newTeacher = await storage.getTeacher(reassignmentData.newTeacherId);
      if (!newTeacher) {
        throw new Error("New teacher not found");
      }
      
      // Determine impact
      let estimatedImpact: 'minimal' | 'moderate' | 'significant' | 'major' = 'moderate';
      if (affectedAssignments.length > 10) {
        estimatedImpact = 'major';
      } else if (affectedAssignments.length > 5) {
        estimatedImpact = 'significant';
      }
      
      return {
        hasChanges: affectedAssignments.length > 0,
        changeType: 'reassign_teacher',
        affectedEntities: {
          classes: affectedClasses,
          teachers: [reassignmentData.oldTeacherId, reassignmentData.newTeacherId],
          subjects: affectedSubjects
        },
        estimatedImpact,
        requiresApproval: estimatedImpact !== 'minimal'
      };
    } catch (error) {
      console.error("[INCREMENTAL] Error detecting teacher reassignment changes:", error);
      throw error;
    }
  }

  /**
   * Analyze the impact of a proposed change
   */
  async analyzeChangeImpact(
    changeRequestId: string,
    changeType: string,
    affectedEntities: {
      classes: string[];
      teachers: string[];
      subjects: string[];
    }
  ): Promise<ChangeImpactAnalysis> {
    console.log(`[INCREMENTAL] Analyzing impact for change request: ${changeRequestId}`);
    
    try {
      // Determine impact scope
      let impactScope: 'single_class' | 'multiple_classes' | 'school_wide' | 'teacher_specific' = 'single_class';
      if (affectedEntities.classes.length > 5) {
        impactScope = 'school_wide';
      } else if (affectedEntities.classes.length > 1) {
        impactScope = 'multiple_classes';
      } else if (affectedEntities.teachers.length > 0) {
        impactScope = 'teacher_specific';
      }
      
      // Determine impact level
      let impactLevel: 'minimal' | 'moderate' | 'significant' | 'major' = 'minimal';
      const totalAffected = affectedEntities.classes.length + affectedEntities.teachers.length + affectedEntities.subjects.length;
      if (totalAffected > 15) {
        impactLevel = 'major';
      } else if (totalAffected > 8) {
        impactLevel = 'significant';
      } else if (totalAffected > 3) {
        impactLevel = 'moderate';
      }
      
      // Get detailed entity information
      const [classes, teachers, subjects] = await Promise.all([
        Promise.all(affectedEntities.classes.map(id => storage.getClass(id))),
        Promise.all(affectedEntities.teachers.map(id => storage.getTeacher(id))),
        Promise.all(affectedEntities.subjects.map(id => storage.getSubject(id)))
      ]);
      
      // Estimate processing time based on complexity
      const estimatedProcessingTime = Math.max(1, Math.ceil(totalAffected * 0.5)); // 0.5 minutes per affected entity
      
      // Determine if full regeneration is needed
      const requiresFullRegeneration = impactLevel === 'major' || impactScope === 'school_wide';
      
      // Select generation strategy
      let generationStrategy: 'incremental_only' | 'hybrid_targeted' | 'full_regeneration' = 'incremental_only';
      if (requiresFullRegeneration) {
        generationStrategy = 'full_regeneration';
      } else if (impactLevel === 'significant') {
        generationStrategy = 'hybrid_targeted';
      }
      
      // Build recommendations
      const recommendations = {
        suggestedApproach: this.getRecommendedApproach(impactLevel, impactScope),
        alternativeOptions: this.getAlternativeOptions(impactLevel),
        riskFactors: this.getRiskFactors(changeType, impactLevel),
        prerequisites: this.getPrerequisites(changeType, affectedEntities)
      };
      
      // Get current timetable entries that might be affected
      const affectedTimetableEntries = await this.getAffectedTimetableEntries(affectedEntities);
      
      const analysisResults = {
        conflictsDetected: 0, // Will be updated by conflict detection
        entriesAffected: affectedTimetableEntries.length,
        teachersAffected: affectedEntities.teachers.length,
        classesAffected: affectedEntities.classes.length,
        estimatedSuccessRate: this.calculateSuccessRate(impactLevel, changeType)
      };
      
      const impactAnalysis: InsertChangeImpactAnalysis = {
        changeRequestId,
        impactScope,
        impactLevel,
        affectedEntities: {
          classes: classes.filter(c => c).map(c => ({ 
            id: c!.id, 
            name: `${c!.grade} ${c!.section || ''}`.trim(), 
            impactType: 'schedule_change' 
          })),
          teachers: teachers.filter(t => t).map(t => ({ 
            id: t!.id, 
            name: `${t!.firstName} ${t!.lastName}`.trim(), 
            impactType: 'assignment_change' 
          })),
          subjects: subjects.filter(s => s).map(s => ({ 
            id: s!.id, 
            name: s!.name, 
            impactType: 'schedule_change' 
          })),
          timetableEntries: affectedTimetableEntries.map(entry => ({ 
            id: entry.id, 
            impactType: 'modification' 
          }))
        },
        estimatedProcessingTime,
        requiresFullRegeneration,
        generationStrategy,
        recommendations,
        analysisResults
      };
      
      return await storage.createChangeImpactAnalysis(impactAnalysis);
    } catch (error) {
      console.error("[INCREMENTAL] Error analyzing change impact:", error);
      throw error;
    }
  }

  /**
   * Detect conflicts for a proposed change
   */
  async detectConflicts(
    changeRequestId: string,
    changeType: string,
    changeDetails: any,
    affectedEntities: {
      classes: string[];
      teachers: string[];
      subjects: string[];
    }
  ): Promise<ConflictDetectionResult[]> {
    console.log(`[INCREMENTAL] Detecting conflicts for change request: ${changeRequestId}`);
    
    const conflicts: ConflictInfo[] = [];
    
    try {
      // Check for teacher conflicts
      if (affectedEntities.teachers.length > 0) {
        const teacherConflicts = await this.detectTeacherConflicts(affectedEntities.teachers, changeDetails);
        conflicts.push(...teacherConflicts);
      }
      
      // Check for capacity conflicts
      if (changeType === 'add_class' || changeType === 'reassign_teacher') {
        const capacityConflicts = await this.detectCapacityConflicts(affectedEntities, changeDetails);
        conflicts.push(...capacityConflicts);
      }
      
      // Check for subject frequency conflicts
      if (changeType === 'update_subject' || changeType === 'add_subject') {
        const frequencyConflicts = await this.detectSubjectFrequencyConflicts(affectedEntities.subjects, changeDetails);
        conflicts.push(...frequencyConflicts);
      }
      
      // Create conflict detection results
      const results: ConflictDetectionResult[] = [];
      for (const conflict of conflicts) {
        const conflictResult: InsertConflictDetectionResult = {
          changeRequestId,
          conflictType: conflict.type,
          severity: conflict.severity,
          conflictDetails: {
            description: conflict.description,
            affectedTeachers: conflict.affectedEntities.teachers,
            affectedClasses: conflict.affectedEntities.classes,
            affectedTimeSlots: conflict.affectedEntities.timeSlots,
            proposedResolutions: conflict.proposedResolutions
          },
          resolutionStatus: 'unresolved'
        };
        
        const result = await storage.createConflictDetectionResult(conflictResult);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error("[INCREMENTAL] Error detecting conflicts:", error);
      throw error;
    }
  }

  // Helper methods for conflict detection
  private async detectTeacherConflicts(teacherIds: string[], changeDetails: any): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    for (const teacherId of teacherIds) {
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher) continue;
      
      // Check daily period limits
      const currentAssignments = await storage.getClassSubjectAssignmentsByTeacher(teacherId);
      const totalPeriods = currentAssignments.reduce((sum, assignment) => sum + assignment.weeklyFrequency, 0);
      
      if (totalPeriods >= teacher.maxDailyPeriods * 6) { // 6 working days
        conflicts.push({
          type: 'teacher_capacity',
          severity: 'high',
          description: `Teacher ${teacher.firstName} ${teacher.lastName} is at capacity (${totalPeriods} periods/week)`,
          affectedEntities: { teachers: [teacherId] },
          proposedResolutions: [
            {
              type: 'redistribute',
              description: 'Redistribute some assignments to other teachers',
              action: 'reassign_periods',
              requiredApproval: true
            },
            {
              type: 'increase_capacity',
              description: 'Increase teacher daily period limit',
              action: 'update_teacher_capacity',
              requiredApproval: true
            }
          ]
        });
      }
    }
    
    return conflicts;
  }
  
  private async detectCapacityConflicts(affectedEntities: any, changeDetails: any): Promise<ConflictInfo[]> {
    // Implementation for capacity conflict detection
    return [];
  }
  
  private async detectSubjectFrequencyConflicts(subjectIds: string[], changeDetails: any): Promise<ConflictInfo[]> {
    // Implementation for subject frequency conflict detection
    return [];
  }

  // Helper methods for impact analysis
  private getRecommendedApproach(impactLevel: string, impactScope: string): string {
    if (impactLevel === 'major' || impactScope === 'school_wide') {
      return 'Full timetable regeneration with smart algorithm selection';
    } else if (impactLevel === 'significant') {
      return 'Hybrid targeted approach with incremental updates';
    } else {
      return 'Incremental updates only';
    }
  }
  
  private getAlternativeOptions(impactLevel: string): string[] {
    const options = ['Incremental updates only'];
    if (impactLevel !== 'minimal') {
      options.push('Hybrid targeted approach');
    }
    if (impactLevel === 'major' || impactLevel === 'significant') {
      options.push('Full regeneration');
    }
    return options;
  }
  
  private getRiskFactors(changeType: string, impactLevel: string): string[] {
    const risks = [];
    if (impactLevel === 'major') {
      risks.push('High disruption to existing schedules');
    }
    if (changeType === 'reassign_teacher') {
      risks.push('Potential teacher overload');
      risks.push('Loss of subject continuity');
    }
    if (changeType === 'add_class') {
      risks.push('Resource allocation challenges');
    }
    return risks;
  }
  
  private getPrerequisites(changeType: string, affectedEntities: any): string[] {
    const prerequisites = [];
    if (changeType === 'add_class') {
      prerequisites.push('Verify classroom availability');
      prerequisites.push('Ensure sufficient teacher capacity');
    }
    if (changeType === 'reassign_teacher') {
      prerequisites.push('Confirm new teacher qualifications');
      prerequisites.push('Check teacher availability');
    }
    return prerequisites;
  }
  
  private async getAffectedTimetableEntries(affectedEntities: any): Promise<{ id: string }[]> {
    // Get all timetable entries for affected classes
    const entries = [];
    for (const classId of affectedEntities.classes) {
      const classEntries = await storage.getTimetableForClass(classId);
      entries.push(...classEntries.map(entry => ({ id: entry.id })));
    }
    return entries;
  }
  
  private calculateSuccessRate(impactLevel: string, changeType: string): number {
    let baseRate = 95;
    
    if (impactLevel === 'major') baseRate -= 20;
    else if (impactLevel === 'significant') baseRate -= 10;
    else if (impactLevel === 'moderate') baseRate -= 5;
    
    if (changeType === 'reassign_teacher') baseRate -= 5;
    if (changeType === 'add_class') baseRate -= 3;
    
    return Math.max(baseRate, 60);
  }
}

export const incrementalChangeService = new IncrementalChangeService();