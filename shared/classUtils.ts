/**
 * Utility functions for handling flexible class names and formats
 * Supports: Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12
 */

export interface ClassInfo {
  grade: string;
  section?: string;
}

/**
 * Get display name for a class
 * @param grade - Grade/level (e.g., "LKG", "1", "11-Commerce")
 * @param section - Section (e.g., "A", "B", or empty string)
 * @returns Formatted class name (e.g., "LKG-A", "11-Commerce", "Nursery")
 */
export function getClassName(grade: string, section?: string | null): string {
  if (!section || section.trim() === '') {
    return grade;
  }
  return `${grade}-${section}`;
}

/**
 * Parse a class name string into grade and section
 * Handles various formats: "LKG A", "LKG-A", "1A", "11-Commerce-A", etc.
 * @param className - Class name string
 * @returns Object with grade and optional section
 */
export function parseClassName(className: string): ClassInfo {
  if (!className || !className.trim()) {
    return { grade: '', section: '' };
  }

  const trimmed = className.trim();
  
  // Try to parse different formats
  // Format: "LKG-A", "11-A" (but NOT "11-Commerce")
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-').map(p => p.trim());
    
    // Only treat as grade-section if last part is a single letter
    if (parts.length === 2) {
      const lastPart = parts[1];
      if (lastPart.length === 1 && /^[A-Za-z]$/.test(lastPart)) {
        return { grade: parts[0], section: lastPart.toUpperCase() };
      }
      // Otherwise, entire string is the grade (e.g., "11-Commerce")
      return { grade: trimmed, section: '' };
    }
    
    if (parts.length === 3) {
      // e.g., "11-Commerce-A"
      const lastPart = parts[2];
      if (lastPart.length === 1 && /^[A-Za-z]$/.test(lastPart)) {
        return { grade: `${parts[0]}-${parts[1]}`, section: lastPart.toUpperCase() };
      }
      // Otherwise, entire string is the grade
      return { grade: trimmed, section: '' };
    }
    
    // More than 3 parts, treat entire string as grade
    return { grade: trimmed, section: '' };
  }
  
  // Format: "LKG A", "11 Commerce A"
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      // Could be "LKG A" or "11 Commerce"
      // Check if last part is a single letter (likely section)
      if (parts[1].length === 1 && /^[A-Za-z]$/.test(parts[1])) {
        return { grade: parts[0], section: parts[1].toUpperCase() };
      }
      // Otherwise, it's part of the grade name
      return { grade: trimmed, section: '' };
    }
    if (parts.length === 3) {
      // e.g., "11 Commerce A"
      if (parts[2].length === 1 && /^[A-Za-z]$/.test(parts[2])) {
        return { grade: `${parts[0]}-${parts[1]}`, section: parts[2].toUpperCase() };
      }
    }
  }
  
  // Format: "1A", "11A" (single letter at end)
  const match = trimmed.match(/^(.+?)([A-Za-z])$/);
  if (match && match[2].length === 1) {
    return { grade: match[1], section: match[2].toUpperCase() };
  }
  
  // No section found, entire string is grade
  return { grade: trimmed, section: '' };
}

/**
 * Get numeric order for sorting grades
 * Order: Playschool → Pre-Nursery → Nursery → LKG → UKG → 1 → 2 → ... → 12
 * @param grade - Grade name
 * @returns Numeric value for sorting
 */
export function getGradeOrder(grade: string): number {
  if (!grade) return 9999;
  
  const normalized = grade.toUpperCase().trim();
  
  // Pre-primary grades
  const prePrimaryOrder: Record<string, number> = {
    'PLAYSCHOOL': 1,
    'PLAY SCHOOL': 1,
    'PRE-NURSERY': 2,
    'PRE NURSERY': 2,
    'PRENURSERY': 2,
    'NURSERY': 3,
    'LKG': 4,
    'LOWER KINDERGARTEN': 4,
    'UKG': 5,
    'UPPER KINDERGARTEN': 5,
    'KG': 5,
    'KINDERGARTEN': 5,
    'PLAYGROUP': 1,
    'PLAY GROUP': 1,
  };
  
  if (prePrimaryOrder[normalized] !== undefined) {
    return prePrimaryOrder[normalized];
  }
  
  // Extract numeric grade (handles "1", "Class 1", "Grade 1", "11", "11-Commerce", etc.)
  const numMatch = normalized.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num >= 1 && num <= 12) {
      // Offset by 10 to come after pre-primary (1-5)
      return num + 10;
    }
  }
  
  // Unknown grades go to the end
  return 9999;
}

/**
 * Sort classes array by grade and section
 * Order: Playschool → Pre-Nursery → Nursery → LKG → UKG → 1 → 2 → ... → 12, then by section A-Z
 * @param classes - Array of class objects with grade and section
 * @returns Sorted array
 */
export function sortClasses<T extends { grade: string; section?: string | null }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => {
    // First, sort by grade order
    const gradeCompare = getGradeOrder(a.grade) - getGradeOrder(b.grade);
    if (gradeCompare !== 0) {
      return gradeCompare;
    }
    
    // If grades are the same order, compare by full grade string
    const gradeStrCompare = a.grade.localeCompare(b.grade);
    if (gradeStrCompare !== 0) {
      return gradeStrCompare;
    }
    
    // Finally, sort by section
    const sectionA = (a.section || '').toUpperCase();
    const sectionB = (b.section || '').toUpperCase();
    return sectionA.localeCompare(sectionB);
  });
}

/**
 * Normalize grade name for comparison
 * @param grade - Grade name
 * @returns Normalized grade name
 */
export function normalizeGrade(grade: string): string {
  if (!grade) return '';
  
  const normalized = grade.trim();
  
  // Remove "Class" or "Grade" prefix if present
  const withoutPrefix = normalized.replace(/^(class|grade)\s+/i, '');
  
  return withoutPrefix;
}

/**
 * Check if a grade represents a senior secondary class (typically 11-12)
 * @param grade - Grade name
 * @returns True if grade is 11 or 12
 */
export function isSeniorSecondary(grade: string): boolean {
  const normalized = grade.toUpperCase().trim();
  return normalized.includes('11') || normalized.includes('12');
}

/**
 * Format class name for display with "Class" prefix if needed
 * @param grade - Grade name
 * @param section - Section
 * @param includeClassPrefix - Whether to include "Class" prefix for numeric grades
 * @returns Formatted display name
 */
export function getClassDisplayName(
  grade: string, 
  section?: string | null, 
  includeClassPrefix = false
): string {
  const baseName = getClassName(grade, section);
  
  if (includeClassPrefix && /^\d+/.test(grade)) {
    return `Class ${baseName}`;
  }
  
  return baseName;
}

/**
 * Allowed class grades in the system
 */
export const ALLOWED_GRADES = [
  'Playschool',
  'Pre-Nursery',
  'Nursery',
  'LKG',
  'UKG',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
] as const;

/**
 * Validate if a grade value matches allowed format
 * @param grade - Grade value to validate
 * @returns Object with isValid flag and optional error message with suggestion
 */
export function validateGrade(grade: string): { isValid: boolean; error?: string } {
  if (!grade || grade.trim() === '') {
    return { isValid: false, error: 'Grade is required' };
  }

  const trimmed = grade.trim();
  
  // Check if it's an exact match (case-sensitive)
  if (ALLOWED_GRADES.includes(trimmed as any)) {
    return { isValid: true };
  }

  // Check for common mistakes and provide helpful suggestions
  const normalized = trimmed.toUpperCase();
  
  // Check if it's a numeric grade with extra text
  const numMatch = trimmed.match(/^\d+$/);
  if (numMatch) {
    const num = parseInt(numMatch[0]);
    if (num >= 1 && num <= 12) {
      return { isValid: true };
    } else {
      return { 
        isValid: false, 
        error: `Grade "${trimmed}" is invalid. Numeric grades must be between 1 and 12` 
      };
    }
  }

  // Check for common misspellings or case issues
  const suggestions: Record<string, string> = {
    'PLAYSCHOOL': 'Playschool',
    'PLAY SCHOOL': 'Playschool',
    'PLAY-SCHOOL': 'Playschool',
    'PRE-NURSERY': 'Pre-Nursery',
    'PRENURSERY': 'Pre-Nursery',
    'PRE NURSERY': 'Pre-Nursery',
    'NURSERY': 'Nursery',
    'NURSARY': 'Nursery',
    'LKG': 'LKG',
    'LOWER KG': 'LKG',
    'LOWER KINDERGARTEN': 'LKG',
    'UKG': 'UKG',
    'UPPER KG': 'UKG',
    'UPPER KINDERGARTEN': 'UKG',
    'KG': 'UKG',
    'KINDERGARTEN': 'UKG',
  };

  const suggestion = suggestions[normalized];
  if (suggestion) {
    return { 
      isValid: false, 
      error: `Use "${suggestion}" instead of "${trimmed}"` 
    };
  }

  // Check for grades with "Class" or "Grade" prefix
  const withoutPrefix = trimmed.replace(/^(class|grade)\s*/i, '');
  if (withoutPrefix !== trimmed) {
    const numCheck = withoutPrefix.match(/^\d+$/);
    if (numCheck) {
      const num = parseInt(numCheck[0]);
      if (num >= 1 && num <= 12) {
        return { 
          isValid: false, 
          error: `Use "${num}" instead of "${trimmed}"` 
        };
      }
    }
    if (ALLOWED_GRADES.includes(withoutPrefix as any)) {
      return { 
        isValid: false, 
        error: `Use "${withoutPrefix}" instead of "${trimmed}"` 
      };
    }
  }

  // Generic error for unrecognized grades
  return { 
    isValid: false, 
    error: `Invalid grade "${trimmed}". Allowed values: Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12` 
  };
}
