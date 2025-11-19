/**
 * Calculate a teacher's maximum weekly capacity based on their daily limit and working days
 * @param maxDailyPeriods - Maximum periods the teacher can teach per day
 * @param workingDays - Number of working days in the week (default: 6)
 * @returns Maximum periods the teacher can teach per week
 */
export function calculateWeeklyCapacity(maxDailyPeriods: number, workingDays: number = 6): number {
  return maxDailyPeriods * workingDays;
}

/**
 * Get the number of working days from teacher availability
 * @param availability - Teacher's availability schedule
 * @returns Number of days the teacher is available
 */
export function getWorkingDaysFromAvailability(availability: {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}): number {
  return Object.values(availability).filter(Boolean).length;
}
