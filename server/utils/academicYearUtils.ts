/**
 * Utility functions for calculating Indian Standard Time (IST) based academic year dates
 * Academic year in India typically runs from April 1st to March 31st
 */

/**
 * Get the current date in IST timezone
 */
export function getCurrentDateIST(): Date {
  // Use proper timezone-aware date calculation with formatToParts
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value);
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  
  // Create date in UTC representing the IST date at midnight
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Calculate academic year start and end dates based on current IST date
 * Indian academic year: April 1st to March 31st
 * 
 * Logic:
 * - If current month is April-March (next year): use current year as start year
 * - Example: Sept 2025 -> Academic year 2025-04-01 to 2026-03-31
 * - Example: April 2026 -> Academic year 2026-04-01 to 2027-03-31
 * 
 * @returns Object with startDate and endDate as ISO date strings
 */
export function calculateAcademicYearDates(): { startDate: string; endDate: string } {
  const currentDate = getCurrentDateIST();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() returns 0-11, we want 1-12
  
  let academicStartYear: number;
  
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

/**
 * Format academic year for display purposes
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Formatted string like "2025-2026"
 */
export function formatAcademicYearDisplay(startDate: string, endDate: string): string {
  const startYear = startDate.split('-')[0];
  const endYear = endDate.split('-')[0];
  return `${startYear}-${endYear}`;
}

/**
 * Check if a date falls within an academic year period
 * @param dateToCheck - Date to check in YYYY-MM-DD format
 * @param startDate - Academic year start date in YYYY-MM-DD format
 * @param endDate - Academic year end date in YYYY-MM-DD format
 * @returns boolean indicating if date is within the academic year
 */
export function isDateInAcademicYear(dateToCheck: string, startDate: string, endDate: string): boolean {
  return dateToCheck >= startDate && dateToCheck <= endDate;
}