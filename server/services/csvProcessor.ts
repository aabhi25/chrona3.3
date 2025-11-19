import type { InsertTeacher, InsertSubject, InsertClass } from "@shared/schema";

interface CSVProcessingResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
}

export class CSVProcessor {
  static parseCSV(csvContent: string): string[][] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      values.push(current.trim());
      return values;
    });
  }

  static processTeachersCSV(csvContent: string): CSVProcessingResult<InsertTeacher> {
    const errors: string[] = [];
    const teachers: InsertTeacher[] = [];

    try {
      const rows = this.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return { success: false, data: [], errors: ["CSV file is empty"] };
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['name', 'email', 'subjects', 'availability'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, data: [], errors };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        try {
          const name = row[headers.indexOf('name')]?.trim();
          const email = row[headers.indexOf('email')]?.trim();
          const subjectsStr = row[headers.indexOf('subjects')]?.trim();
          const availabilityStr = row[headers.indexOf('availability')]?.trim();

          if (!name || !email) {
            errors.push(`Row ${i + 1}: Name and email are required`);
            continue;
          }

          const subjects = subjectsStr ? subjectsStr.split(';').map(s => s.trim()).filter(Boolean) : [];

          let availability: {
            monday: boolean;
            tuesday: boolean;
            wednesday: boolean;
            thursday: boolean;
            friday: boolean;
            saturday: boolean;
            sunday: boolean;
          } = {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: true,
            sunday: false
          };

          if (availabilityStr) {
            try {
              availability = JSON.parse(availabilityStr);
            } catch {
              // Default availability if parsing fails
              availability = {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
                sunday: false
              };
            }
          }

          teachers.push({
            name,
            email,
            subjects,
            availability,
            isActive: true,
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: Error processing data - ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        data: teachers,
        errors
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Failed to process CSV: ${error}`]
      };
    }
  }


  static processClassesCSV(csvContent: string): CSVProcessingResult<InsertClass> {
    const errors: string[] = [];
    const classes: InsertClass[] = [];

    try {
      const rows = this.parseCSV(csvContent);
      
      if (rows.length === 0) {
        return { success: false, data: [], errors: ["CSV file is empty"] };
      }

      const headers = rows[0].map(h => h.toLowerCase().trim());
      const expectedHeaders = ['grade', 'section', 'student_count', 'required_subjects', 'room'];
      
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
        return { success: false, data: [], errors };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < expectedHeaders.length) {
          errors.push(`Row ${i + 1}: Insufficient columns`);
          continue;
        }

        try {
          const grade = row[headers.indexOf('grade')]?.trim();
          const section = row[headers.indexOf('section')]?.trim();
          const studentCountStr = row[headers.indexOf('student_count')]?.trim();
          const requiredSubjectsStr = row[headers.indexOf('required_subjects')]?.trim();
          const room = row[headers.indexOf('room')]?.trim();

          if (!grade) {
            errors.push(`Row ${i + 1}: Grade is required`);
            continue;
          }

          // Allow blank sections - use empty string if section is not provided
          const finalSection = section || "";

          const studentCount = studentCountStr ? parseInt(studentCountStr) : 0;
          const requiredSubjects = requiredSubjectsStr ? 
            requiredSubjectsStr.split(';').map(s => s.trim()).filter(Boolean) : [];

          classes.push({
            grade,
            section: finalSection,
            studentCount,
            requiredSubjects,
            room,
          });

        } catch (error) {
          errors.push(`Row ${i + 1}: Error processing data - ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        data: classes,
        errors
      };

    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Failed to process CSV: ${error}`]
      };
    }
  }
}
