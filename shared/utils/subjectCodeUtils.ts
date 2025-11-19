import { storage } from '../../server/storage';

/**
 * Generates a grade-specific subject code following the pattern: 3 chars + grade
 * Example: Mathematics in Grade 5 -> MAT5, Science in Grade 10 -> SCI10
 * 
 * This is the standardized logic used across all subject creation in Chrona:
 * - AI Teacher Planner
 * - Smart Upload (Excel)
 * - Manual Subject Creation
 * - CSV Upload
 * - Load Simulation
 * 
 * @param subjectName - Name of the subject (e.g., "Mathematics", "Science")
 * @param grade - Grade/class (e.g., "5", "10", "Nursery")
 * @param schoolId - School ID for uniqueness check
 * @returns Promise<string> - Generated subject code (e.g., "MAT5", "SCI10")
 */
export async function generateGradeSpecificSubjectCode(
  subjectName: string, 
  grade: string, 
  schoolId: string
): Promise<string> {
  // Generate base code from subject name (first 3 alphanumeric characters)
  const baseCode = subjectName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3);
  
  // Create grade-specific code
  let code = `${baseCode}${grade}`;
  let counter = 1;
  
  // Ensure uniqueness within the school
  while (await storage.checkSubjectCodeExists(code, schoolId)) {
    code = `${baseCode}${grade}_${counter}`;
    counter++;
  }
  
  return code;
}

/**
 * Generates subject code when grade is not available (fallback)
 * Uses 3 chars + counter pattern
 * 
 * @param subjectName - Name of the subject
 * @param schoolId - School ID for uniqueness check
 * @returns Promise<string> - Generated subject code
 */
export async function generateSubjectCodeWithoutGrade(
  subjectName: string, 
  schoolId: string
): Promise<string> {
  // Generate base code from subject name (first 3 alphanumeric characters)
  const baseCode = subjectName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 3);
  
  let code = baseCode;
  let counter = 1;
  
  // Ensure uniqueness within the school
  while (await storage.checkSubjectCodeExists(code, schoolId)) {
    code = `${baseCode}${counter}`;
    counter++;
  }
  
  return code;
}
