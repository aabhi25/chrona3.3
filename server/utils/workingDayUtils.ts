/**
 * Utility functions for working day validation
 */

import { db } from "../db";
import { timetableStructures } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Check if a given date is a working day for a school
 * @param schoolId - The school ID
 * @param date - Date string in YYYY-MM-DD format
 * @returns boolean indicating if the date is a working day
 */
export async function isWorkingDay(schoolId: string, date: string): Promise<boolean> {
  try {
    // Get the day of week for the given date
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Get the timetable structure for the school
    const [timetableStructure] = await db
      .select()
      .from(timetableStructures)
      .where(eq(timetableStructures.schoolId, schoolId))
      .limit(1);
    
    if (!timetableStructure) {
      // If no timetable structure found, default to Monday-Friday as working days
      const defaultWorkingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      return defaultWorkingDays.includes(dayOfWeek);
    }
    
    // Parse working days from JSONB (it's stored as an array of strings)
    const workingDays = Array.isArray(timetableStructure.workingDays) 
      ? timetableStructure.workingDays 
      : JSON.parse(timetableStructure.workingDays as string);
    
    return workingDays.includes(dayOfWeek);
  } catch (error) {
    console.error('Error checking working day:', error);
    // Default to Monday-Friday if there's an error
    const defaultWorkingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    return defaultWorkingDays.includes(dayOfWeek);
  }
}

/**
 * Get working days for a school
 * @param schoolId - The school ID
 * @returns Array of working day names (lowercase)
 */
export async function getWorkingDays(schoolId: string): Promise<string[]> {
  try {
    const [timetableStructure] = await db
      .select()
      .from(timetableStructures)
      .where(eq(timetableStructures.schoolId, schoolId))
      .limit(1);
    
    if (!timetableStructure) {
      return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    }
    
    const workingDays = Array.isArray(timetableStructure.workingDays) 
      ? timetableStructure.workingDays 
      : JSON.parse(timetableStructure.workingDays as string);
    
    return workingDays;
  } catch (error) {
    console.error('Error getting working days:', error);
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }
}