// Date utility functions for IST timezone handling

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * TypeScript type for IST date strings in YYYY-MM-DD format
 * Use this type to make IST date strings explicit in function signatures
 */
export type ISTDateString = string; // YYYY-MM-DD format in IST timezone

/**
 * Get current date in IST timezone as YYYY-MM-DD string
 */
export function getCurrentDateIST(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/**
 * Get current time in IST timezone as HH:MM string
 */
export function getCurrentTimeIST(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
}

/**
 * Get current date and time in IST timezone
 */
export function getCurrentDateTimeIST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));
}

/**
 * Convert a date string to IST date string
 */
export function toISTDateString(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Format date for display in IST
 */
export function formatDateIST(dateInput: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid date passed to formatDateIST:', dateInput);
    return 'Invalid Date';
  }
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Intl.DateTimeFormat('en-IN', {
    ...defaultOptions,
    ...options
  }).format(date);
}

/**
 * Check if a date string is today in IST
 */
export function isToday(dateString: string): boolean {
  return dateString === getCurrentDateIST();
}

/**
 * Parse a YYYY-MM-DD date string to a Date object with explicit IST offset
 * This ensures the date is interpreted as IST midnight, not server local time
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing midnight IST on the given date
 */
export function parseISTDate(dateString: ISTDateString): Date {
  // Append IST offset to ensure correct timezone interpretation
  return new Date(`${dateString}T00:00:00+05:30`);
}

/**
 * Get ISO string with explicit IST offset (+05:30)
 * Use this instead of toISOString() which always converts to UTC
 * 
 * @param date - Date object to convert
 * @returns ISO string with IST offset (e.g., "2025-10-04T14:30:00+05:30")
 */
export function getDateTimeInIST(date: Date): string {
  const istDate = toISTDateString(date);
  const istTime = date.toLocaleTimeString('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  return `${istDate}T${istTime}+05:30`;
}

/**
 * Add or subtract days from a date while maintaining IST timezone
 * Handles month and year boundaries correctly
 * 
 * @param date - Starting date
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New Date object with days added, preserving IST timezone
 */
export function addDaysIST(date: Date, days: number): Date {
  const istDateStr = toISTDateString(date);
  const [year, month, day] = istDateStr.split('-').map(Number);
  
  // Use Date.UTC for proper rollover handling
  const tempDate = new Date(Date.UTC(year, month - 1, day + days));
  
  // Get rolled-over date parts
  const newYear = tempDate.getUTCFullYear();
  const newMonth = String(tempDate.getUTCMonth() + 1).padStart(2, '0');
  const newDay = String(tempDate.getUTCDate()).padStart(2, '0');
  
  // Create final date at midnight IST
  return new Date(`${newYear}-${newMonth}-${newDay}T00:00:00+05:30`);
}

/**
 * Get the Monday (start) of the week for a given date in IST
 * Week starts on Monday and ends on Sunday
 * 
 * @param date - Any date in the week
 * @returns Date object representing Monday of that week in IST
 */
export function getWeekStartDateIST(date: Date): Date {
  // Get IST weekday using Intl to avoid UTC conversion issues
  const formatter = new Intl.DateTimeFormat('en-US', { 
    weekday: 'long',
    timeZone: IST_TIMEZONE
  });
  const dayName = formatter.format(date).toLowerCase();
  const dayMap: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  const currentDay = dayMap[dayName];
  
  // Calculate days to subtract to get to Monday
  // If Sunday (0), go back 6 days
  // If Monday (1), go back 0 days
  // If Tuesday (2), go back 1 day, etc.
  const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
  
  return addDaysIST(date, -daysToMonday);
}

/**
 * Get the Sunday (end) of the week for a given date in IST
 * Week starts on Monday and ends on Sunday
 * 
 * @param date - Any date in the week
 * @returns Date object representing Sunday of that week in IST
 */
export function getWeekEndDateIST(date: Date): Date {
  const weekStart = getWeekStartDateIST(date);
  return addDaysIST(weekStart, 6); // Sunday is 6 days after Monday
}

/**
 * Get IST date string (YYYY-MM-DD) from a Date object
 * Alias for toISTDateString for consistency with other helper names
 * 
 * @param date - Date object to format
 * @returns Date string in YYYY-MM-DD format (IST timezone)
 */
export function getISTDateString(date: Date): ISTDateString {
  return toISTDateString(date);
}