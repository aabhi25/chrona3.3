import { storage } from "../storage";
import { scheduler } from "./scheduler";
import { incrementalChangeService } from "./incrementalChangeService";
import type { 
  IncrementalChangeRequest,
  InsertIncrementalChangeRequest,
  Class,
  Teacher,
  Subject,
  InsertClassSubjectAssignment,
  TimetableEntry
} from "@shared/schema";
import { getCurrentDateIST } from "@shared/utils/dateUtils";

export interface IncrementalGenerationResult {
  success: boolean;
  message: string;
  entriesCreated?: number;
  entriesModified?: number;
  entriesRemoved?: number;
  conflictsDetected?: number;
  generationStrategy?: string;
  requestId?: string;
  estimatedTime?: number;
}

export interface IncrementalUpdateOptions {
  requireApproval?: boolean;
  forceFullRegeneration?: boolean;
  dryRun?: boolean;
  requestedBy: string;
  schoolId: string;
}

export class IncrementalGenerationService {

  /**
   * Add a new class and generate its timetable
   */
  async addClass(
    classData: {
      grade: string;
      section: string | null;
      academicSessionId: string;
      maxStudents?: number;
      classTeacherId?: string;
    },
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Adding new class: ${classData.grade} ${classData.section || ''}`);
    
    try {
      // Step 1: Validate the request
      const existingClass = await storage.checkClassExists(
        classData.grade, 
        classData.section, 
        options.schoolId
      );
      
      if (existingClass) {
        return {
          success: false,
          message: `Class ${classData.grade} ${classData.section || ''} already exists`,
        };
      }

      // Step 2: Create the class first to get a valid UUID
      const newClass = await storage.createClass({
        grade: classData.grade,
        section: classData.section,
        maxStudents: classData.maxStudents || 30,
        schoolId: options.schoolId,
        academicSessionId: classData.academicSessionId,
        isActive: true
      });

      console.log(`[INCREMENTAL] Created class with ID: ${newClass.id}`);

      try {
        // Step 3: Detect changes and impact
        const changeDetection = await incrementalChangeService.detectClassAddition({
          ...classData,
          schoolId: options.schoolId
        });

        // Step 4: Create change request with the actual class ID
        const changeRequest: InsertIncrementalChangeRequest = {
          schoolId: options.schoolId,
          requestType: 'add_class',
          entityId: newClass.id, // Use actual class UUID
          entityType: 'class',
          changeDetails: {
            className: `${classData.grade} ${classData.section || ''}`.trim(),
            grade: classData.grade,
            section: classData.section,
            academicSessionId: classData.academicSessionId,
          },
          status: options.requireApproval || changeDetection.requiresApproval ? 'pending' : 'processing',
          requestedBy: options.requestedBy,
        };

        const request = await storage.createIncrementalChangeRequest(changeRequest);

        // Step 5: Analyze impact and detect conflicts
        const [impactAnalysis] = await Promise.all([
          incrementalChangeService.analyzeChangeImpact(
            request.id,
            'add_class',
            changeDetection.affectedEntities
          ),
          incrementalChangeService.detectConflicts(
            request.id,
            'add_class',
            classData,
            changeDetection.affectedEntities
          )
        ]);

        // Step 6: If dry run, return analysis without execution
        if (options.dryRun) {
          // Clean up the created class since it was just for dry run
          await storage.deleteClass(newClass.id);
          return {
            success: true,
            message: "Dry run completed - no changes made",
            generationStrategy: impactAnalysis.generationStrategy,
            conflictsDetected: impactAnalysis.analysisResults.conflictsDetected,
            estimatedTime: impactAnalysis.estimatedProcessingTime,
            requestId: request.id
          };
        }

        // Step 7: If approval required, return pending status (class already created)
        if (options.requireApproval || changeDetection.requiresApproval) {
          return {
            success: true,
            message: `Class created and addition request pending approval`,
            requestId: request.id,
            generationStrategy: impactAnalysis.generationStrategy,
            estimatedTime: impactAnalysis.estimatedProcessingTime
          };
        }

        // Step 8: Execute the rest of the addition workflow (timetable generation, etc.)
        return await this.executeClassAdditionWorkflow(request.id, newClass, classData, options);

      } catch (error) {
        // If anything fails after class creation, clean up the class
        console.error("[INCREMENTAL] Error in post-creation workflow, cleaning up class:", error);
        try {
          await storage.deleteClass(newClass.id);
        } catch (cleanupError) {
          console.error("[INCREMENTAL] Failed to cleanup class after error:", cleanupError);
        }
        throw error;
      }

    } catch (error) {
      console.error("[INCREMENTAL] Error adding class:", error);
      return {
        success: false,
        message: `Failed to add class: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Update a subject and regenerate affected timetables
   */
  async updateSubject(
    subjectId: string,
    changes: Partial<Subject>,
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Updating subject: ${subjectId}`);

    try {
      // Step 1: Get current subject
      const currentSubject = await storage.getSubject(subjectId);
      if (!currentSubject) {
        return {
          success: false,
          message: "Subject not found"
        };
      }

      // Step 2: Detect changes and impact
      const changeDetection = await incrementalChangeService.detectSubjectUpdate(subjectId, changes);

      if (!changeDetection.hasChanges) {
        return {
          success: true,
          message: "No timetable impact from subject changes",
          entriesModified: 0
        };
      }

      // Step 3: Create change request
      const changeRequest: InsertIncrementalChangeRequest = {
        schoolId: options.schoolId,
        requestType: 'update_subject',
        entityId: subjectId,
        entityType: 'subject',
        changeDetails: {
          subjectChanges: changes,
          affectedClassIds: changeDetection.affectedEntities.classes
        },
        status: options.requireApproval || changeDetection.requiresApproval ? 'pending' : 'processing',
        requestedBy: options.requestedBy,
      };

      const request = await storage.createIncrementalChangeRequest(changeRequest);

      // Step 4: Analyze impact
      const impactAnalysis = await incrementalChangeService.analyzeChangeImpact(
        request.id,
        'update_subject',
        changeDetection.affectedEntities
      );

      // Step 5: Handle dry run or approval
      if (options.dryRun) {
        return {
          success: true,
          message: "Dry run completed - no changes made",
          entriesModified: impactAnalysis.analysisResults.entriesAffected,
          generationStrategy: impactAnalysis.generationStrategy,
          requestId: request.id
        };
      }

      if (options.requireApproval || changeDetection.requiresApproval) {
        return {
          success: true,
          message: "Subject update request created and pending approval",
          requestId: request.id,
          estimatedTime: impactAnalysis.estimatedProcessingTime
        };
      }

      // Step 6: Execute the update
      return await this.executeSubjectUpdate(request.id, subjectId, changes, options);

    } catch (error) {
      console.error("[INCREMENTAL] Error updating subject:", error);
      return {
        success: false,
        message: `Failed to update subject: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Reject a change request with proper cleanup and rollback
   */
  async rejectChangeRequest(
    requestId: string,
    rejectionData: {
      rejectedBy: string;
      rejectionReason?: string;
      schoolId: string;
    }
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Rejecting change request: ${requestId}`);

    try {
      // Step 1: Get the change request and validate
      const request = await storage.getIncrementalChangeRequest(requestId);
      
      if (!request) {
        return {
          success: false,
          message: "Change request not found"
        };
      }

      if (!['pending', 'processing'].includes(request.status)) {
        return {
          success: false,
          message: `Cannot reject request with status: ${request.status}`
        };
      }

      console.log(`[INCREMENTAL] Rejecting ${request.requestType} request for entity: ${request.entityId}`);

      // Step 2: Clean up related records that were created for this request
      await this.cleanupChangeRequestArtifacts(requestId, request);

      // Step 3: Handle entity-specific rollback if needed
      if (request.status === 'processing') {
        await this.rollbackEntityChanges(request, rejectionData.schoolId);
      }

      // Step 4: Update the request status to rejected
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'rejected',
        rejectedBy: rejectionData.rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: rejectionData.rejectionReason
      });

      // Step 5: Log the rejection
      await storage.createAuditLog({
        action: "incremental_request_rejected",
        entityType: "incremental_change_request",
        entityId: requestId,
        userId: rejectionData.rejectedBy,
        description: `Rejected ${request.requestType} request for ${request.entityType} ${request.entityId}${rejectionData.rejectionReason ? `: ${rejectionData.rejectionReason}` : ''}`,
        schoolId: rejectionData.schoolId
      });

      return {
        success: true,
        message: `Change request rejected successfully`
      };

    } catch (error) {
      console.error("[INCREMENTAL] Error rejecting change request:", error);
      return {
        success: false,
        message: `Failed to reject change request: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clean up artifacts created for a change request
   */
  private async cleanupChangeRequestArtifacts(
    requestId: string, 
    request: any
  ): Promise<void> {
    console.log(`[INCREMENTAL] Cleaning up artifacts for request: ${requestId}`);

    try {
      // Clean up conflict detection results
      await storage.deleteConflictDetectionResultsByRequest(requestId);
      
      // Clean up impact analysis
      await storage.deleteChangeImpactAnalysisByRequest(requestId);
      
      console.log(`[INCREMENTAL] Cleaned up artifacts for request: ${requestId}`);
    } catch (error) {
      console.error("[INCREMENTAL] Error cleaning up artifacts:", error);
      // Don't throw here - we still want to proceed with rejection
    }
  }

  /**
   * Roll back entity-specific changes if the request was in processing state
   */
  private async rollbackEntityChanges(
    request: any, 
    schoolId: string
  ): Promise<void> {
    console.log(`[INCREMENTAL] Rolling back entity changes for request: ${request.id}, type: ${request.requestType}`);

    try {
      switch (request.requestType) {
        case 'add_class':
          // If class was created but approval was pending, remove it
          if (request.entityId && request.entityId !== 'pending') {
            const classExists = await storage.getClass(request.entityId);
            if (classExists) {
              // Remove any timetable entries first
              const timetableEntries = await storage.getTimetableForClass(request.entityId);
              for (const entry of timetableEntries) {
                await storage.deleteTimetableEntry(entry.id);
              }
              
              // Remove class subject assignments
              const assignments = await storage.getClassSubjectAssignments(request.entityId);
              for (const assignment of assignments) {
                await storage.deleteClassSubjectAssignment(assignment.id);
              }
              
              // Finally, remove the class
              await storage.deleteClass(request.entityId);
              console.log(`[INCREMENTAL] Rolled back class creation: ${request.entityId}`);
            }
          }
          break;

        case 'update_subject':
          // For subject updates, we could potentially revert changes
          // but typically we don't roll back subject data unless explicitly requested
          console.log(`[INCREMENTAL] Subject update rollback not implemented - manual review may be needed`);
          break;

        case 'reassign_teacher':
          // For teacher reassignments, we could revert to previous assignments
          console.log(`[INCREMENTAL] Teacher reassignment rollback not implemented - manual review may be needed`);
          break;

        default:
          console.log(`[INCREMENTAL] No rollback implemented for request type: ${request.requestType}`);
      }
    } catch (error) {
      console.error("[INCREMENTAL] Error during entity rollback:", error);
      // Don't throw here - log the error but continue with rejection
    }
  }

  /**
   * Reassign a teacher and update affected timetables
   */
  async reassignTeacher(
    reassignmentData: {
      oldTeacherId: string;
      newTeacherId: string;
      affectedSubjects?: string[];
      affectedClasses?: string[];
    },
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Reassigning teacher: ${reassignmentData.oldTeacherId} -> ${reassignmentData.newTeacherId}`);

    try {
      // Step 1: Validate teachers exist
      const [oldTeacher, newTeacher] = await Promise.all([
        storage.getTeacher(reassignmentData.oldTeacherId),
        storage.getTeacher(reassignmentData.newTeacherId)
      ]);

      if (!oldTeacher || !newTeacher) {
        return {
          success: false,
          message: "One or both teachers not found"
        };
      }

      // Step 2: Detect changes and impact
      const changeDetection = await incrementalChangeService.detectTeacherReassignment(reassignmentData);

      if (!changeDetection.hasChanges) {
        return {
          success: true,
          message: "No assignments found for the specified criteria",
          entriesModified: 0
        };
      }

      // Step 3: Create change request
      const changeRequest: InsertIncrementalChangeRequest = {
        schoolId: options.schoolId,
        requestType: 'reassign_teacher',
        entityId: reassignmentData.oldTeacherId,
        entityType: 'teacher',
        changeDetails: {
          oldTeacherId: reassignmentData.oldTeacherId,
          newTeacherId: reassignmentData.newTeacherId,
          affectedClassIds: changeDetection.affectedEntities.classes
        },
        status: options.requireApproval || changeDetection.requiresApproval ? 'pending' : 'processing',
        requestedBy: options.requestedBy,
      };

      const request = await storage.createIncrementalChangeRequest(changeRequest);

      // Step 4: Analyze impact and detect conflicts
      const [impactAnalysis, conflicts] = await Promise.all([
        incrementalChangeService.analyzeChangeImpact(
          request.id,
          'reassign_teacher',
          changeDetection.affectedEntities
        ),
        incrementalChangeService.detectConflicts(
          request.id,
          'reassign_teacher',
          reassignmentData,
          changeDetection.affectedEntities
        )
      ]);

      // Step 5: Handle dry run or approval
      if (options.dryRun) {
        return {
          success: true,
          message: "Dry run completed - no changes made",
          entriesModified: impactAnalysis.analysisResults.entriesAffected,
          conflictsDetected: conflicts.length,
          generationStrategy: impactAnalysis.generationStrategy,
          requestId: request.id
        };
      }

      if (options.requireApproval || changeDetection.requiresApproval || conflicts.length > 0) {
        return {
          success: true,
          message: `Teacher reassignment request created and pending approval${conflicts.length > 0 ? ` (${conflicts.length} conflicts detected)` : ''}`,
          requestId: request.id,
          conflictsDetected: conflicts.length,
          estimatedTime: impactAnalysis.estimatedProcessingTime
        };
      }

      // Step 6: Execute the reassignment
      return await this.executeTeacherReassignment(request.id, reassignmentData, options);

    } catch (error) {
      console.error("[INCREMENTAL] Error reassigning teacher:", error);
      return {
        success: false,
        message: `Failed to reassign teacher: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Execute class addition workflow with appropriate generation strategy
   * (Class already created, this handles timetable generation and finalization)
   */
  private async executeClassAdditionWorkflow(
    requestId: string,
    newClass: any,
    classData: any,
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Executing class addition workflow for request: ${requestId}, class: ${newClass.id}`);

    try {
      // Update request status
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'processing',
        processedAt: new Date()
      });

      // Step 1: Copy subject assignments from existing classes in same grade
      const existingClasses = await storage.getClasses(options.schoolId, classData.academicSessionId);
      const sameGradeClasses = existingClasses.filter(c => c.grade === classData.grade && c.id !== newClass.id);

      let entriesCreated = 0;
      
      if (sameGradeClasses.length > 0) {
        // Copy assignments from the first class in the same grade
        const sourceClass = sameGradeClasses[0];
        const sourceAssignments = await storage.getClassSubjectAssignments(sourceClass.id);
        
        for (const assignment of sourceAssignments) {
          await storage.createClassSubjectAssignment({
            classId: newClass.id,
            subjectId: assignment.subjectId,
            assignedTeacherId: null, // Will be assigned during timetable generation
            weeklyFrequency: assignment.weeklyFrequency,
            academicSessionId: classData.academicSessionId
          });
        }

        // Step 2: Generate timetable for the new class
        const generationResult = await scheduler.generateTimetable(newClass.id, options.schoolId);
        entriesCreated = generationResult.entriesCreated || 0;

        if (!generationResult.success) {
          throw new Error(generationResult.message);
        }
      }

      // Step 3: Update request as completed
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'completed',
        affectedEntries: [] // Will be populated with actual timetable entry IDs
      });

      // Step 4: Log the action
      await storage.createAuditLog({
        action: "incremental_class_addition",
        entityType: "class",
        entityId: newClass.id,
        userId: options.requestedBy,
        description: `Added class ${classData.grade} ${classData.section || ''} with ${entriesCreated} timetable entries`,
        schoolId: options.schoolId
      });

      return {
        success: true,
        message: `Successfully added class ${classData.grade} ${classData.section || ''} with ${entriesCreated} timetable entries`,
        entriesCreated,
        generationStrategy: entriesCreated > 0 ? 'individual' : 'none',
        requestId
      };

    } catch (error) {
      // Update request as failed
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Execute subject update with affected class regeneration
   */
  private async executeSubjectUpdate(
    requestId: string,
    subjectId: string,
    changes: Partial<Subject>,
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Executing subject update for request: ${requestId}`);

    try {
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'processing',
        processedAt: new Date()
      });

      // Step 1: Update the subject
      await storage.updateSubject(subjectId, changes);

      // Step 2: Get affected classes and regenerate their timetables if needed
      const assignments = await storage.getClassSubjectAssignmentsBySubject(subjectId);
      const affectedClassIds = assignments.map(a => a.classId);
      
      let entriesModified = 0;
      let generationStrategy = 'none';

      // Only regenerate if changes might affect scheduling
      const schedulingRelevantChanges = ['name', 'code'].some(field => field in changes);
      
      if (schedulingRelevantChanges && affectedClassIds.length > 0) {
        // Use smart generation strategy based on scale
        if (affectedClassIds.length > 5) {
          // Large impact - use full regeneration for affected classes
          generationStrategy = 'full_regeneration';
          for (const classId of affectedClassIds) {
            const result = await scheduler.generateTimetable(classId, options.schoolId);
            if (result.success) {
              entriesModified += result.entriesCreated || 0;
            }
          }
        } else {
          // Small impact - individual class regeneration
          generationStrategy = 'individual';
          for (const classId of affectedClassIds) {
            const result = await scheduler.generateTimetable(classId, options.schoolId);
            if (result.success) {
              entriesModified += result.entriesCreated || 0;
            }
          }
        }
      }

      // Step 3: Update request as completed
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'completed'
      });

      // Step 4: Log the action
      await storage.createAuditLog({
        action: "incremental_subject_update",
        entityType: "subject",
        entityId: subjectId,
        userId: options.requestedBy,
        description: `Updated subject affecting ${affectedClassIds.length} classes with ${entriesModified} timetable entries modified`,
        schoolId: options.schoolId
      });

      return {
        success: true,
        message: `Successfully updated subject affecting ${affectedClassIds.length} classes`,
        entriesModified,
        generationStrategy,
        requestId
      };

    } catch (error) {
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute teacher reassignment with intelligent conflict resolution
   */
  private async executeTeacherReassignment(
    requestId: string,
    reassignmentData: any,
    options: IncrementalUpdateOptions
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Executing teacher reassignment for request: ${requestId}`);

    try {
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'processing',
        processedAt: new Date()
      });

      // Step 1: Get affected assignments
      let assignments = await storage.getClassSubjectAssignmentsByTeacher(reassignmentData.oldTeacherId);
      
      // Filter by affected subjects/classes if specified
      if (reassignmentData.affectedSubjects?.length) {
        assignments = assignments.filter(a => 
          reassignmentData.affectedSubjects.includes(a.subjectId)
        );
      }
      if (reassignmentData.affectedClasses?.length) {
        assignments = assignments.filter(a => 
          reassignmentData.affectedClasses.includes(a.classId)
        );
      }

      // Step 2: Update assignments to new teacher
      for (const assignment of assignments) {
        await storage.updateClassSubjectAssignment(assignment.id, {
          assignedTeacherId: reassignmentData.newTeacherId
        });
      }

      // Step 3: Regenerate timetables for affected classes
      const affectedClassIds = [...new Set(assignments.map(a => a.classId))];
      let entriesModified = 0;
      let generationStrategy = 'individual';

      // Use appropriate generation strategy based on impact
      if (affectedClassIds.length > 8) {
        generationStrategy = 'lightweight_bulk';
        const result = await scheduler.generateTimetable(undefined, options.schoolId);
        entriesModified = result.entriesCreated || 0;
      } else if (affectedClassIds.length > 3) {
        generationStrategy = 'staged_hybrid';
        for (const classId of affectedClassIds) {
          const result = await scheduler.generateTimetable(classId, options.schoolId);
          if (result.success) {
            entriesModified += result.entriesCreated || 0;
          }
        }
      } else {
        for (const classId of affectedClassIds) {
          const result = await scheduler.generateTimetable(classId, options.schoolId);
          if (result.success) {
            entriesModified += result.entriesCreated || 0;
          }
        }
      }

      // Step 4: Update request as completed
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'completed'
      });

      // Step 5: Log the action
      await storage.createAuditLog({
        action: "incremental_teacher_reassignment",
        entityType: "teacher",
        entityId: reassignmentData.oldTeacherId,
        userId: options.requestedBy,
        description: `Reassigned teacher affecting ${assignments.length} assignments and ${affectedClassIds.length} classes`,
        schoolId: options.schoolId
      });

      return {
        success: true,
        message: `Successfully reassigned teacher affecting ${assignments.length} assignments across ${affectedClassIds.length} classes`,
        entriesModified,
        generationStrategy,
        requestId
      };

    } catch (error) {
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process a pending incremental change request (for approval workflow)
   */
  async processChangeRequest(
    requestId: string,
    approvedBy: string
  ): Promise<IncrementalGenerationResult> {
    console.log(`[INCREMENTAL] Processing change request: ${requestId}`);

    try {
      const request = await storage.getIncrementalChangeRequest(requestId);
      if (!request) {
        return {
          success: false,
          message: "Change request not found"
        };
      }

      if (request.status !== 'pending') {
        return {
          success: false,
          message: `Change request is not pending (current status: ${request.status})`
        };
      }

      // Update request with approval
      await storage.updateIncrementalChangeRequest(requestId, {
        approvedBy,
        approvedAt: new Date(),
        status: 'processing'
      });

      const options: IncrementalUpdateOptions = {
        requireApproval: false,
        requestedBy: request.requestedBy,
        schoolId: request.schoolId
      };

      // Execute based on request type
      switch (request.requestType) {
        case 'add_class': {
          // The class was already created when the request was made; run the rest of the addition now
          const newClass = request.entityId ? await storage.getClass(request.entityId) : undefined;
          if (!newClass) {
            throw new Error("The class for this request no longer exists");
          }
          return await this.executeClassAdditionWorkflow(requestId, newClass, { ...request.changeDetails, schoolId: request.schoolId }, options);
        }
        
        case 'update_subject':
          return await this.executeSubjectUpdate(
            requestId, 
            request.entityId, 
            request.changeDetails.subjectChanges || {}, 
            options
          );
        
        case 'reassign_teacher':
          return await this.executeTeacherReassignment(requestId, {
            oldTeacherId: request.changeDetails.oldTeacherId,
            newTeacherId: request.changeDetails.newTeacherId,
            affectedClassIds: request.changeDetails.affectedClassIds
          }, options);
        
        default:
          throw new Error(`Unsupported request type: ${request.requestType}`);
      }

    } catch (error) {
      console.error("[INCREMENTAL] Error processing change request:", error);
      
      // Update request as failed
      await storage.updateIncrementalChangeRequest(requestId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        message: `Failed to process change request: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const incrementalGenerationService = new IncrementalGenerationService();