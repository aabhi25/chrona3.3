import cron from 'node-cron';
import { storage } from '../storage';
import type { Class, TimetableEntry } from '@shared/schema';
import { getCurrentDateTimeIST, getCurrentDateIST } from '@shared/utils/dateUtils';

/**
 * Cron Service for Chrona
 * Handles scheduled tasks including automatic weekly timetable creation
 */

/**
 * Get the upcoming Monday date in IST timezone
 * This ensures the cron job creates timetables for the next week starting from Monday
 * Uses shared IST utilities to guarantee IST timezone regardless of server environment
 */
function getUpcomingMondayIST(): Date {
  const now = getCurrentDateTimeIST();
  
  // Get IST weekday using Intl.DateTimeFormat to avoid UTC conversion issues
  const formatter = new Intl.DateTimeFormat('en-US', { 
    weekday: 'long',
    timeZone: 'Asia/Kolkata'
  });
  const dayName = formatter.format(now).toLowerCase();
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  const currentDay = dayMap[dayName];
  
  // Calculate days until next Monday
  // If today is Sunday (0), next Monday is 1 day away
  // If today is Monday (1), next Monday is 7 days away (next week)
  // If today is Tuesday (2), next Monday is 6 days away, etc.
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Create upcoming Monday date using proper date arithmetic to handle month/year rollover
  const istDateStr = getCurrentDateIST();
  const currentDateParts = istDateStr.split('-').map(Number);
  // Use Date constructor with proper rollover handling, then convert to IST
  const tempDate = new Date(Date.UTC(currentDateParts[0], currentDateParts[1] - 1, currentDateParts[2] + daysUntilNextMonday));
  // Get the rolled-over date parts
  const mondayYear = tempDate.getUTCFullYear();
  const mondayMonth = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
  const mondayDay = String(tempDate.getUTCDate()).padStart(2, '0');
  // Create final Monday date at midnight IST with explicit offset
  const upcomingMonday = new Date(`${mondayYear}-${mondayMonth}-${mondayDay}T00:00:00+05:30`);
  
  const weekStartDateIST = upcomingMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  console.log(`[CRON] Trigger time: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`[CRON] Current IST day: ${dayName} (${currentDay}), Days until next Monday: ${daysUntilNextMonday}`);
  console.log(`[CRON] Computed upcoming Monday: ${upcomingMonday.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`[CRON] Week start date (IST): ${weekStartDateIST}`);
  
  return upcomingMonday;
}

/**
 * Automatic Weekly Timetable Creation Job
 * Runs every Sunday at midnight IST
 * Creates weekly timetables from master timetables for the upcoming week
 */
async function createWeeklyTimetablesForUpcomingWeek() {
  console.log('[CRON] Starting weekly timetable creation job...');
  
  try {
    const upcomingMonday = getUpcomingMondayIST();
    const weekStartDate = upcomingMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    console.log(`[CRON] Creating weekly timetables for week starting: ${weekStartDate}`);
    
    // Get all schools with active academic sessions
    const schools = await storage.getSchools();
    
    if (schools.length === 0) {
      console.log('[CRON] No schools found. Skipping weekly timetable creation.');
      return;
    }
    
    let totalClassesProcessed = 0;
    let totalTimetablesCreated = 0;
    let totalErrors = 0;
    
    // Process each school
    for (const school of schools) {
      try {
        console.log(`[CRON] Processing school: ${school.name} (ID: ${school.id})`);
        
        // Get all classes with master timetables for this school
        const classesWithTimetables = await storage.getClassesWithTimetables(school.id);
        
        if (classesWithTimetables.length === 0) {
          console.log(`[CRON] No classes with master timetables found for school ${school.name}`);
          continue;
        }
        
        console.log(`[CRON] Found ${classesWithTimetables.length} classes with master timetables for school ${school.name}`);
        
        // Process each class
        for (const classData of classesWithTimetables) {
          try {
            totalClassesProcessed++;
            
            // Check if weekly timetable already exists for this class and upcoming week
            const existingWeeklyTimetable = await storage.getWeeklyTimetable(
              classData.id,
              upcomingMonday
            );
            
            if (existingWeeklyTimetable) {
              console.log(
                `[CRON] Weekly timetable already exists for class ${classData.grade} ${classData.section} ` +
                `for week ${weekStartDate} - skipping`
              );
              continue;
            }
            
            // Get the master timetable entries for this class
            const masterEntries = await storage.getTimetableEntriesForClass(classData.id);
            
            if (masterEntries.length === 0) {
              console.log(
                `[CRON] No master timetable entries found for class ${classData.grade} ${classData.section} - skipping`
              );
              continue;
            }
            
            // Convert master entries to weekly timetable data format
            const weeklyTimetableData = masterEntries.map((entry: TimetableEntry) => ({
              day: entry.day,
              period: entry.period,
              teacherId: entry.teacherId,
              subjectId: entry.subjectId,
              startTime: entry.startTime,
              endTime: entry.endTime,
              room: entry.room || null,
              isModified: false, // Not modified since it's a direct copy from master
            }));
            
            // Get an admin user from the school to use as the creator
            const adminUsers = await storage.getUsersBySchoolId(school.id);
            const adminUser = adminUsers.find((u: any) => u.role === 'admin' || u.role === 'super_admin');
            
            if (!adminUser) {
              console.error(
                `[CRON] No admin user found for school ${school.name} - ` +
                `skipping weekly timetable creation for class ${classData.grade} ${classData.section}`
              );
              totalErrors++;
              continue;
            }
            
            // Create the weekly timetable
            await storage.createOrUpdateWeeklyTimetable(
              classData.id,
              upcomingMonday,
              weeklyTimetableData,
              adminUser.id,
              school.id
            );
            
            totalTimetablesCreated++;
            console.log(
              `[CRON] ✓ Created weekly timetable for class ${classData.grade} ${classData.section} ` +
              `with ${weeklyTimetableData.length} entries`
            );
          } catch (classError) {
            totalErrors++;
            console.error(
              `[CRON] Error processing class ${classData.grade} ${classData.section}:`,
              classError
            );
          }
        }
        
        console.log(
          `[CRON] Completed processing school ${school.name}: ` +
          `${totalTimetablesCreated} timetables created`
        );
      } catch (schoolError) {
        console.error(`[CRON] Error processing school ${school.name}:`, schoolError);
        totalErrors++;
      }
    }
    
    console.log(
      `[CRON] Weekly timetable creation job completed:\n` +
      `  - Schools processed: ${schools.length}\n` +
      `  - Classes processed: ${totalClassesProcessed}\n` +
      `  - Timetables created: ${totalTimetablesCreated}\n` +
      `  - Errors: ${totalErrors}`
    );
  } catch (error) {
    console.error('[CRON] Fatal error in weekly timetable creation job:', error);
  }
}

/**
 * Initialize and start all cron jobs
 */
export function initializeCronJobs() {
  console.log('[CRON] Initializing cron jobs...');
  
  // Schedule weekly timetable creation job
  // Runs every Sunday at 00:00 (midnight) IST
  // Cron expression: '0 0 * * 0' means "At 00:00 on Sunday"
  // Note: Since process.env.TZ is set to 'Asia/Kolkata', node-cron runs in IST time
  const cronSchedule = '0 0 * * 0'; // Midnight on Sunday IST
  
  cron.schedule(cronSchedule, async () => {
    console.log('[CRON] Triggered: Weekly timetable creation job');
    await createWeeklyTimetablesForUpcomingWeek();
  });
  
  console.log(`[CRON] Weekly timetable creation job scheduled: ${cronSchedule} (midnight IST on Sunday)`);
  
  // Schedule substitution processing job
  // Runs every day at 8:00 AM IST
  // Processes pending substitutions for dates 1-3 days in the future
  const substitutionCronSchedule = '0 8 * * *'; // 8 AM daily
  
  cron.schedule(substitutionCronSchedule, async () => {
    console.log('[CRON] Triggered: Substitution processing job');
    await processPendingSubstitutions();
  });
  
  console.log(`[CRON] Substitution processing job scheduled: ${substitutionCronSchedule} (8 AM IST daily)`);
  
  // Schedule annual academic session creation job
  // Runs every April 1st at 00:00 (midnight) IST
  // Cron expression: '0 0 1 4 *' means "At 00:00 on April 1st every year"
  const annualSessionCronSchedule = '0 0 1 4 *'; // Midnight on April 1st IST
  
  cron.schedule(annualSessionCronSchedule, async () => {
    console.log('[CRON] Triggered: Annual academic session creation job');
    await createAnnualAcademicSessions();
  });
  
  console.log(`[CRON] Annual academic session creation job scheduled: ${annualSessionCronSchedule} (midnight IST on April 1st)`);
  
  // Optional: Run the job immediately on server startup for testing (can be removed in production)
  // Uncomment the line below to run the job on server startup
  // console.log('[CRON] Running weekly timetable creation job on startup for testing...');
  // createWeeklyTimetablesForUpcomingWeek();
  
  console.log('[CRON] All cron jobs initialized successfully');
}

/**
 * Process pending substitutions for upcoming dates
 * Runs daily at 8 AM IST
 */
async function processPendingSubstitutions() {
  console.log('[CRON] Starting substitution processing job...');
  
  try {
    const { substitutionService } = await import('./substitution');
    await substitutionService.processPendingSubstitutions();
    console.log('[CRON] Substitution processing job completed successfully');
  } catch (error) {
    console.error('[CRON] Error in substitution processing job:', error);
  }
}

/**
 * Create annual academic sessions for all schools
 * Runs every April 1st at midnight IST
 * Creates next academic year session (e.g., 2026-2027 when run on April 1, 2026)
 */
async function createAnnualAcademicSessions() {
  console.log('[CRON] Starting annual academic session creation job...');
  
  try {
    const { calculateAcademicYearDates } = await import('../utils/academicYearUtils');
    const { startDate, endDate } = calculateAcademicYearDates();
    
    console.log(`[CRON] Creating academic sessions for year: ${startDate} to ${endDate}`);
    
    // Get all active schools
    const schools = await storage.getSchools();
    
    if (schools.length === 0) {
      console.log('[CRON] No schools found. Skipping academic session creation.');
      return;
    }
    
    let totalSessionsCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Process each school
    for (const school of schools) {
      try {
        console.log(`[CRON] Processing school: ${school.name} (ID: ${school.id})`);
        
        // Check if academic session already exists for this year
        const existingSessions = await storage.getAcademicSessions(school.id);
        const sessionExists = existingSessions.some(
          session => session.startDate === startDate && session.endDate === endDate
        );
        
        if (sessionExists) {
          console.log(
            `[CRON] Academic session ${startDate} to ${endDate} already exists for school ${school.name} - skipping`
          );
          totalSkipped++;
          continue;
        }
        
        // Create the new academic session
        await storage.createAcademicSession({
          schoolId: school.id,
          startDate,
          endDate,
        });
        
        totalSessionsCreated++;
        console.log(
          `[CRON] ✓ Created academic session ${startDate} to ${endDate} for school ${school.name}`
        );
      } catch (schoolError) {
        totalErrors++;
        console.error(
          `[CRON] Error creating academic session for school ${school.name}:`,
          schoolError
        );
      }
    }
    
    console.log(
      `[CRON] Annual academic session creation job completed:\n` +
      `  - Schools processed: ${schools.length}\n` +
      `  - Sessions created: ${totalSessionsCreated}\n` +
      `  - Sessions skipped (already exist): ${totalSkipped}\n` +
      `  - Errors: ${totalErrors}`
    );
  } catch (error) {
    console.error('[CRON] Fatal error in annual academic session creation job:', error);
  }
}

// Export the manual trigger functions for testing/debugging
export { createWeeklyTimetablesForUpcomingWeek, createAnnualAcademicSessions };
