/**
 * Script to run academic session backfill for existing schools
 */

import { db } from '../server/db.ts';
import { schools, academicSessions } from '../shared/schema.ts';
import { eq, sql } from 'drizzle-orm';

// IST-based academic year calculation
function calculateAcademicYearDates() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(now.getTime() + istOffset);
  const currentYear = istDate.getFullYear();
  const currentMonth = istDate.getMonth() + 1; // getMonth() returns 0-11, we want 1-12
  
  let academicStartYear;
  
  if (currentMonth >= 4) {
    // April to December: academic year starts in current year
    academicStartYear = currentYear;
  } else {
    // January to March: academic year started in previous year
    academicStartYear = currentYear - 1;
  }
  
  const startDate = `${academicStartYear}-04-01`;
  const endDate = `${academicStartYear + 1}-03-31`;
  
  return { startDate, endDate };
}

async function runBackfill() {
  console.log('🚀 Starting academic session backfill...');
  
  let created = 0;
  let skipped = 0;
  const errors = [];

  try {
    // Get all schools
    const allSchools = await db.select().from(schools);
    console.log(`📋 Found ${allSchools.length} schools to check`);

    for (const school of allSchools) {
      try {
        // Check if school has any academic sessions
        const existingSessions = await db
          .select()
          .from(academicSessions)
          .where(eq(academicSessions.schoolId, school.id));
        
        const sessionCount = existingSessions.length;
        
        if (sessionCount > 0) {
          console.log(`⏭️  "${school.name}" already has ${sessionCount} session(s), skipping`);
          skipped++;
          continue;
        }

        // Create academic session
        const { startDate, endDate } = calculateAcademicYearDates();
        
        await db.insert(academicSessions).values({
          schoolId: school.id,
          startDate,
          endDate,
          isActive: true
        });

        console.log(`✅ Created session for "${school.name}" (${startDate} to ${endDate})`);
        created++;

      } catch (error) {
        const errorMsg = `Failed to process "${school.name}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log('\n🎯 === BACKFILL RESULTS ===');
    console.log(`✅ Sessions created: ${created}`);
    console.log(`⏭️  Schools skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n💥 === ERROR DETAILS ===');
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n🎉 Backfill completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('💀 Critical backfill error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

runBackfill();