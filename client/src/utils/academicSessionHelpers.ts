/**
 * Frontend helper functions for working with simplified academic sessions
 */

export interface AcademicSession {
  id: string;
  startDate: string; // YYYY-MM-DD format
  endDate: string;   // YYYY-MM-DD format
  schoolId: string;
  createdAt: string | null;
  updatedAt: string | null;
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
 * Format academic session for display with full date range
 * @param session - Academic session object
 * @returns Formatted string like "2025-2026 (Apr 1, 2025 - Mar 31, 2026)"
 */
export function formatSessionDisplay(session: AcademicSession): string {
  const yearRange = formatAcademicYearDisplay(session.startDate, session.endDate);
  const startDate = new Date(session.startDate).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const endDate = new Date(session.endDate).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  return `${yearRange} (${startDate} - ${endDate})`;
}

/**
 * Check if an academic session is current based on today's date
 * Uses IST timezone for accurate date comparison
 * @param session - Academic session object
 * @returns boolean indicating if session is current
 */
export function isCurrentSession(session: AcademicSession): boolean {
  // Get current date in IST timezone
  const todayIST = new Date().toLocaleString("en-CA", { 
    timeZone: "Asia/Kolkata",
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit'
  }); // Returns YYYY-MM-DD format
  return todayIST >= session.startDate && todayIST <= session.endDate;
}

/**
 * Get display name for academic session (backward compatibility)
 * @param session - Academic session object
 * @returns Formatted academic year string
 */
export function getSessionName(session: AcademicSession): string {
  return formatAcademicYearDisplay(session.startDate, session.endDate);
}

/**
 * Get school year for academic session (backward compatibility)
 * @param session - Academic session object
 * @returns Formatted academic year string
 */
export function getSessionSchoolYear(session: AcademicSession): string {
  return formatAcademicYearDisplay(session.startDate, session.endDate);
}