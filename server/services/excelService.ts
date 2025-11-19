import * as XLSX from 'xlsx';
import { storage } from '../storage';

interface ExcelField {
  id: string;
  label: string;
  category: string;
}

interface ExcelGenerationRequest {
  type: 'students' | 'teachers';
  fields: string[];
}

class ExcelService {
  /**
   * Generate Excel file for students or teachers with selected fields
   */
  async generateExcel(request: ExcelGenerationRequest, schoolId: string): Promise<Buffer> {
    const { type, fields } = request;
    
    let data: any[] = [];
    
    // Fetch the data
    if (type === 'students') {
      data = await this.fetchStudentData(schoolId, fields);
    } else if (type === 'teachers') {
      data = await this.fetchTeacherData(schoolId, fields);
    }
    
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const columnWidths = this.calculateColumnWidths(data);
    worksheet['!cols'] = columnWidths;
    
    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, type === 'students' ? 'Students' : 'Teachers');
    
    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return excelBuffer;
  }
  
  /**
   * Fetch student data with selected fields
   */
  private async fetchStudentData(schoolId: string, fields: string[]): Promise<any[]> {
    const students = await storage.getStudents(schoolId);
    const classes = await storage.getClasses(schoolId);
    
    // Create class mapping for quick lookup
    const classMap = new Map(classes.map(c => [c.id, `${c.grade}${c.section}`]));
    
    return students.map(student => {
      const formattedStudent: any = {};
      
      fields.forEach(field => {
        switch (field) {
          case 'admissionNumber':
            formattedStudent['Admission Number'] = student.admissionNumber;
            break;
          case 'firstName':
            formattedStudent['First Name'] = student.firstName;
            break;
          case 'lastName':
            formattedStudent['Last Name'] = student.lastName;
            break;
          case 'rollNumber':
            formattedStudent['Roll Number'] = student.rollNumber || '';
            break;
          case 'className':
            formattedStudent['Class'] = classMap.get(student.classId!) || 'Not Assigned';
            break;
          case 'email':
            formattedStudent['Email'] = student.email || '';
            break;
          case 'contactNumber':
            formattedStudent['Contact Number'] = student.contactNumber || '';
            break;
          case 'dateOfBirth':
            formattedStudent['Date of Birth'] = student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '';
            break;
          case 'gender':
            formattedStudent['Gender'] = student.gender || '';
            break;
          case 'bloodGroup':
            formattedStudent['Blood Group'] = student.bloodGroup || '';
            break;
          case 'address':
            formattedStudent['Address'] = student.address || '';
            break;
          case 'guardianName':
            formattedStudent['Guardian Name'] = student.guardianName || '';
            break;
          case 'guardianRelation':
            formattedStudent['Guardian Relation'] = student.guardianRelation || '';
            break;
          case 'guardianContact':
            formattedStudent['Guardian Contact'] = student.guardianContact || '';
            break;
          case 'emergencyContact':
            formattedStudent['Emergency Contact'] = student.emergencyContact || '';
            break;
          case 'medicalInfo':
            formattedStudent['Medical Information'] = student.medicalInfo || '';
            break;
          case 'status':
            formattedStudent['Status'] = student.status;
            break;
        }
      });
      
      return formattedStudent;
    });
  }
  
  /**
   * Fetch teacher data with selected fields
   */
  private async fetchTeacherData(schoolId: string, fields: string[]): Promise<any[]> {
    const teachers = await storage.getTeachers(schoolId);
    const subjects = await storage.getSubjects(schoolId);
    const classes = await storage.getClasses(schoolId);
    
    // Create mappings for quick lookup
    const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
    const classMap = new Map(classes.map(c => [c.id, `${c.grade}${c.section}`]));
    
    return teachers.map(teacher => {
      const formattedTeacher: any = {};
      
      fields.forEach(field => {
        switch (field) {
          case 'employeeId':
            formattedTeacher['Employee ID'] = teacher.employeeId;
            break;
          case 'name':
            formattedTeacher['Name'] = teacher.name;
            break;
          case 'email':
            formattedTeacher['Email'] = teacher.email || '';
            break;
          case 'contactNumber':
            formattedTeacher['Contact Number'] = teacher.contactNumber || '';
            break;
          case 'schoolIdNumber':
            formattedTeacher['School ID Number'] = teacher.schoolIdNumber || '';
            break;
          case 'subjects':
            const teacherSubjects = Array.isArray(teacher.subjects) 
              ? teacher.subjects.map(subjectId => subjectMap.get(subjectId) || subjectId).join(', ')
              : '';
            formattedTeacher['Subjects Taught'] = teacherSubjects;
            break;
          case 'classes':
            const teacherClasses = Array.isArray(teacher.classes)
              ? teacher.classes.map(classId => classMap.get(classId) || classId).join(', ')
              : '';
            formattedTeacher['Classes Assigned'] = teacherClasses;
            break;
          case 'maxDailyPeriods':
            formattedTeacher['Max Daily Periods'] = teacher.maxDailyPeriods || 0;
            break;
          case 'availability':
            const availability = teacher.availability && typeof teacher.availability === 'object'
              ? this.formatAvailability(teacher.availability)
              : '';
            formattedTeacher['Availability Schedule'] = availability;
            break;
          case 'status':
            formattedTeacher['Status'] = teacher.status;
            break;
        }
      });
      
      return formattedTeacher;
    });
  }
  
  /**
   * Format teacher availability schedule for Excel
   */
  private formatAvailability(availability: any): string {
    if (!availability || typeof availability !== 'object') return '';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const schedule = days
      .map(day => {
        const periods = availability[day];
        if (Array.isArray(periods) && periods.length > 0) {
          return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${periods.join(', ')}`;
        }
        return null;
      })
      .filter(Boolean)
      .join(' | ');
    
    return schedule;
  }
  
  /**
   * Calculate optimal column widths for the worksheet
   */
  private calculateColumnWidths(data: any[]): any[] {
    if (data.length === 0) return [];
    
    const headers = Object.keys(data[0]);
    const columnWidths = headers.map(header => {
      const maxLength = Math.max(
        header.length,
        ...data.map(row => String(row[header] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }; // Min 10, max 50 characters
    });
    
    return columnWidths;
  }
}

export const excelService = new ExcelService();