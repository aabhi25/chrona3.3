/**
 * Utility script to backfill academic sessions for existing schools
 * that don't have any academic sessions
 */

import { storage } from '../storage';
import { calculateAcademicYearDates } from './academicYearUtils';

/**
 * Backfill academic sessions for schools that don't have any
 * @returns Promise<{ created: number; skipped: number; errors: string[] }>
 */
export async function backfillAcademicSessions(): Promise<{ created: number; skipped: number; errors: string[] }> {
  const results = {
    created: 0,
    skipped: 0,
    errors: [] as string[]
  };

  try {
    // Get all schools
    const schools = await storage.getSchoolsWithAdminEmails();
    console.log(`Found ${schools.length} schools to check for academic sessions`);

    for (const school of schools) {
      try {
        // Check if school already has academic sessions
        const hasSession = await storage.hasAcademicSession(school.id);
        
        if (hasSession) {
          console.log(`School "${school.name}" already has academic sessions, skipping`);
          results.skipped++;
          continue;
        }

        // Create academic session for this school
        const { startDate, endDate } = calculateAcademicYearDates();
        
        await storage.createAcademicSession({
          schoolId: school.id,
          startDate,
          endDate,
          isActive: true
        });

        console.log(`Created academic session for school "${school.name}" (${startDate} to ${endDate})`);
        results.created++;

      } catch (error) {
        const errorMsg = `Failed to create academic session for school "${school.name}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log(`Backfill completed: ${results.created} created, ${results.skipped} skipped, ${results.errors.length} errors`);
    return results;

  } catch (error) {
    const errorMsg = `Critical error during backfill: ${error instanceof Error ? error.message : String(error)}`;
    console.error(errorMsg);
    results.errors.push(errorMsg);
    return results;
  }
}

/**
 * Backfill academic sessions for a specific school by ID
 * @param schoolId - The ID of the school to backfill
 * @returns Promise<boolean> - Success status
 */
export async function backfillSchoolAcademicSession(schoolId: string): Promise<boolean> {
  try {
    // Check if school already has academic sessions
    const hasSession = await storage.hasAcademicSession(schoolId);
    
    if (hasSession) {
      console.log(`School with ID "${schoolId}" already has academic sessions`);
      return true;
    }

    // Get school info for logging
    const school = await storage.getSchool(schoolId);
    const schoolName = school?.name || schoolId;

    // Create academic session for this school
    const { startDate, endDate } = calculateAcademicYearDates();
    
    await storage.createAcademicSession({
      schoolId,
      startDate,
      endDate,
      isActive: true
    });

    console.log(`Created academic session for school "${schoolName}" (${startDate} to ${endDate})`);
    return true;

  } catch (error) {
    console.error(`Failed to create academic session for school ID "${schoolId}": ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}