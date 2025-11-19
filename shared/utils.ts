/**
 * Utility functions shared between client and server
 */

/**
 * Parses a date string (YYYY-MM-DD format) safely without timezone issues
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object set to start of day in local timezone
 */
export function parseDateOnly(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // Month is 0-indexed
}

/**
 * Checks if a given date string represents a future date
 * @param dateString Date string in YYYY-MM-DD format
 * @returns true if the date is in the future, false otherwise
 */
export function isFutureDate(dateString: string): boolean {
  const targetDate = parseDateOnly(dateString);
  const today = new Date();
  
  // Set both dates to start of day for comparison
  targetDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  return targetDate > today;
}

/**
 * Gets today's date in YYYY-MM-DD format
 * @returns Today's date as a string
 */
export function getTodayDateString(): string {
  const today = new Date();
  return today.getFullYear() + '-' + 
         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
         String(today.getDate()).padStart(2, '0');
}