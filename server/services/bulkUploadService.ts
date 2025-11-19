import * as XLSX from 'xlsx';
import { storage } from '../storage';
import { classPeriodValidator } from './classPeriodAllocationValidator';
import { db } from '../db';
import { teachers as teachersTable, students as studentsTable, subjects, classSubjectAssignments } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { getWorkingDaysFromAvailability, calculateWeeklyCapacity } from '@shared/utils/teacherUtils';
import { getClassName } from '@shared/classUtils';
import { generateGradeSpecificSubjectCode } from '@shared/utils/subjectCodeUtils';

// Type definitions for parsed data
export interface TeacherImportData {
  name: string;
  contactNumber: string;
  email?: string;
  designation?: string;
  schoolIdNumber?: string;
  maxDailyPeriods?: number;
  aadhar?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  dateOfBirth?: string;
  fatherHusbandName?: string;
  address?: string;
  category?: string;
  religion?: string;
  originalRowNumber: number;
}

export interface StudentImportData {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  grade: string;
  section: string;
  rollNumber?: string;
  email?: string;
  contactNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: string;
  address?: string;
  emergencyContact?: string;
  originalRowNumber: number;
}

export interface AssignmentImportData {
  teacherSchoolId: string;
  grade: string;
  section: string;
  subjectCode?: string; // Optional - auto-generated if not provided
  subjectName: string;
  weeklyFrequency: number;
  originalRowNumber: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedBulkData {
  teachers: TeacherImportData[];
  students: StudentImportData[];
  assignments: AssignmentImportData[];
  errors: ValidationError[];
  classesToCreate: Array<{ grade: string; section: string }>;
  schoolId: string;
}

export class BulkUploadService {
  
  // Generate Excel template with example data and comprehensive instructions
  async generateTemplate(): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();

    // Teachers sheet - Multiple diverse examples
    const teachersData = [
      {
        'Name*': 'Rajesh Kumar',
        'Mobile Number*': '9876543210',
        'Email': 'rajesh.kumar@school.com',
        'Designation': 'Primary Teacher',
        'School ID*': 'T001',
        'Max Periods/Day': '6',
        'Aadhaar Number': '123456789012',
        'Gender': 'male',
        'Blood Group': 'O+',
        'Date of Birth': '1985-05-15',
        'Father/Husband Name': 'Mr. Kumar Sr.',
        'Address': '123 Main Street, City',
        'Category': 'General',
        'Religion': 'Hindu'
      },
      {
        'Name*': 'Priya Sharma',
        'Mobile Number*': '9876543211',
        'Email': 'priya.sharma@school.com',
        'Designation': 'Mathematics Teacher',
        'School ID*': 'T002',
        'Max Periods/Day': '7',
        'Aadhaar Number': '234567890123',
        'Gender': 'female',
        'Blood Group': 'A+',
        'Date of Birth': '1990-03-20',
        'Father/Husband Name': 'Mr. Sharma',
        'Address': '456 Park Avenue, City',
        'Category': 'General',
        'Religion': 'Hindu'
      },
      {
        'Name*': 'Amit Patel',
        'Mobile Number*': '9876543212',
        'Email': 'amit.patel@school.com',
        'Designation': 'Science Teacher',
        'School ID*': 'T003',
        'Max Periods/Day': '6',
        'Aadhaar Number': '345678901234',
        'Gender': 'male',
        'Blood Group': 'B+',
        'Date of Birth': '1988-11-10',
        'Father/Husband Name': 'Mr. Patel Sr.',
        'Address': '789 Lake Road, City',
        'Category': 'OBC',
        'Religion': 'Hindu'
      }
    ];
    const teachersSheet = XLSX.utils.json_to_sheet(teachersData);
    teachersSheet['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 },
      { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, 
      { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

    // Students sheet - Diverse examples covering all grade types with reference column
    const studentsData = [
      {
        'First Name*': 'Aarav',
        'Last Name*': 'Kumar',
        'Admission Number*': 'STU001',
        'Grade*': 'Playschool',
        'Section': '',
        'Roll Number': '1',
        'Email': '',
        'Contact Number': '9876543220',
        'Date of Birth': '2019-03-15',
        'Gender': 'male',
        'Blood Group': 'O+',
        'Address': '100 Garden Street, City',
        'Emergency Contact': '9876543221',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Playschool'
      },
      {
        'First Name*': 'Priya',
        'Last Name*': 'Sharma',
        'Admission Number*': 'STU002',
        'Grade*': 'LKG',
        'Section': 'A',
        'Roll Number': '2',
        'Email': '',
        'Contact Number': '9876543222',
        'Date of Birth': '2018-08-22',
        'Gender': 'female',
        'Blood Group': 'A+',
        'Address': '200 Park Lane, City',
        'Emergency Contact': '9876543223',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Pre-Nursery'
      },
      {
        'First Name*': 'Rahul',
        'Last Name*': 'Patel',
        'Admission Number*': 'STU003',
        'Grade*': '5',
        'Section': 'B',
        'Roll Number': '15',
        'Email': 'rahul.patel@student.com',
        'Contact Number': '9876543224',
        'Date of Birth': '2013-11-10',
        'Gender': 'male',
        'Blood Group': 'B+',
        'Address': '300 Lake View, City',
        'Emergency Contact': '9876543225',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Nursery'
      },
      {
        'First Name*': 'Ananya',
        'Last Name*': 'Singh',
        'Admission Number*': 'STU004',
        'Grade*': '10',
        'Section': 'A',
        'Roll Number': '8',
        'Email': 'ananya.singh@student.com',
        'Contact Number': '9876543226',
        'Date of Birth': '2008-05-18',
        'Gender': 'female',
        'Blood Group': 'AB+',
        'Address': '400 Hill Station, City',
        'Emergency Contact': '9876543227',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'LKG'
      },
      {
        'First Name*': '',
        'Last Name*': '',
        'Admission Number*': '',
        'Grade*': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'UKG'
      },
      {
        'First Name*': '',
        'Last Name*': '',
        'Admission Number*': '',
        'Grade*': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '1, 2, 3, 4, 5'
      },
      {
        'First Name*': '',
        'Last Name*': '',
        'Admission Number*': '',
        'Grade*': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '6, 7, 8, 9, 10'
      },
      {
        'First Name*': '',
        'Last Name*': '',
        'Admission Number*': '',
        'Grade*': '',
        'Section': '',
        'Roll Number': '',
        'Email': '',
        'Contact Number': '',
        'Date of Birth': '',
        'Gender': '',
        'Blood Group': '',
        'Address': '',
        'Emergency Contact': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '11, 12'
      }
    ];
    const studentsSheet = XLSX.utils.json_to_sheet(studentsData);
    studentsSheet['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 10 },
      { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
      { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 3 }, { wch: 28 }
    ];
    
    // Apply light background color to reference column (column O, index 14)
    const studentRange = XLSX.utils.decode_range(studentsSheet['!ref'] || 'A1');
    for (let row = studentRange.s.r; row <= studentRange.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 14 }); // Column O (0-indexed = 14)
      if (studentsSheet[cellAddress]) {
        studentsSheet[cellAddress].s = {
          fill: { 
            patternType: "solid",
            fgColor: { rgb: "E8F4F8" },
            bgColor: { rgb: "E8F4F8" }
          },
          alignment: { vertical: "center" }
        };
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');

    // Assignments sheet - Multiple examples with reference column (Subject codes auto-generated)
    const assignmentsData = [
      {
        'Teacher School ID*': 'T001',
        'Grade*': 'Playschool',
        'Section': '',
        'Subject Name*': 'Play Activities',
        'Weekly Frequency*': 5,
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Playschool'
      },
      {
        'Teacher School ID*': 'T001',
        'Grade*': 'LKG',
        'Section': 'A',
        'Subject Name*': 'English',
        'Weekly Frequency*': 6,
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Pre-Nursery'
      },
      {
        'Teacher School ID*': 'T002',
        'Grade*': '5',
        'Section': 'B',
        'Subject Name*': 'Mathematics',
        'Weekly Frequency*': 8,
        '': '',
        '📋 Allowed Classes (Reference Only)': 'Nursery'
      },
      {
        'Teacher School ID*': 'T003',
        'Grade*': '10',
        'Section': 'A',
        'Subject Name*': 'Science',
        'Weekly Frequency*': 7,
        '': '',
        '📋 Allowed Classes (Reference Only)': 'LKG'
      },
      {
        'Teacher School ID*': '',
        'Grade*': '',
        'Section': '',
        'Subject Name*': '',
        'Weekly Frequency*': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': 'UKG'
      },
      {
        'Teacher School ID*': '',
        'Grade*': '',
        'Section': '',
        'Subject Name*': '',
        'Weekly Frequency*': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '1, 2, 3, 4, 5'
      },
      {
        'Teacher School ID*': '',
        'Grade*': '',
        'Section': '',
        'Subject Name*': '',
        'Weekly Frequency*': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '6, 7, 8, 9, 10'
      },
      {
        'Teacher School ID*': '',
        'Grade*': '',
        'Section': '',
        'Subject Name*': '',
        'Weekly Frequency*': '',
        '': '',
        '📋 Allowed Classes (Reference Only)': '11, 12'
      }
    ];
    const assignmentsSheet = XLSX.utils.json_to_sheet(assignmentsData);
    assignmentsSheet['!cols'] = [
      { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 18 }, { wch: 3 }, { wch: 28 }
    ];
    
    // Apply light background color to reference column (column G, index 6)
    const assignmentRange = XLSX.utils.decode_range(assignmentsSheet['!ref'] || 'A1');
    for (let row = assignmentRange.s.r; row <= assignmentRange.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 6 }); // Column G (0-indexed = 6)
      if (assignmentsSheet[cellAddress]) {
        assignmentsSheet[cellAddress].s = {
          fill: { 
            patternType: "solid",
            fgColor: { rgb: "E8F4F8" },
            bgColor: { rgb: "E8F4F8" }
          },
          alignment: { vertical: "center" }
        };
      }
    }
    
    XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Assignments');

    // Instructions sheet
    const instructions = [
      ['SMART UPLOAD - COMPREHENSIVE INSTRUCTIONS'],
      [''],
      ['ALLOWED CLASS GRADES:'],
      ['Pre-Primary: Playschool, Pre-Nursery, Nursery, LKG, UKG'],
      ['Primary & Secondary: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10'],
      ['Senior Secondary: 11, 12'],
      [''],
      ['IMPORTANT NOTES:'],
      ['- Grade: Use EXACT values from the allowed list above (case-sensitive)'],
      ['- Section: Use single letter (A, B, C, etc.) or leave blank for no section'],
      ['- Teacher School ID: Must match the School ID from Teachers sheet'],
      ['- Subject Codes: AUTO-GENERATED based on subject name and grade (e.g., MAT5, SCI10)'],
      ['- Same subject in same grade will share the same code across all sections'],
      ['- Weekly Frequency: Number of periods per week (typically 5-8)'],
      ['- Max Periods/Day: Optional for teachers (defaults to 6 if not provided)'],
      [''],
      ['UPLOAD ORDER:'],
      ['1. Upload Teachers sheet first (creates teacher accounts)'],
      ['2. Upload Students sheet second (creates student accounts and classes)'],
      ['3. Upload Assignments sheet last (assigns teachers to class-subject combinations)'],
      [''],
      ['FIELD REQUIREMENTS:'],
      ['Teachers: Name*, Mobile Number*, School ID* are mandatory'],
      ['Students: First Name*, Last Name*, Admission Number*, Grade* are mandatory (Section is optional)'],
      ['Assignments: Teacher School ID*, Grade*, Subject Name*, Weekly Frequency* are mandatory (Section is optional)'],
      [''],
      ['EXAMPLES:'],
      ['- Pre-primary without section: Grade="Playschool", Section=""'],
      ['- Pre-primary with section: Grade="LKG", Section="A"'],
      ['- Numeric grade with section: Grade="10", Section="B"'],
      ['- Assignment: Teacher="T001", Grade="5", Section="A", Subject="Mathematics", Frequency=8'],
      ['- Subject Code Auto-Generation: "Mathematics" in Grade 5 → "MAT5" (shared across 5A, 5B, 5C)'],
      [''],
      ['VALIDATION TIPS:'],
      ['- Admission Numbers must be unique across all students'],
      ['- Mobile Numbers must be exactly 10 digits'],
      ['- Each Grade-Section combination creates a separate class'],
      ['- Teacher School IDs in Assignments must match Teachers sheet'],
      ['- Subject codes are auto-generated: same subject in same grade gets same code'],
    ];
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 85 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  }

  // Parse Excel file and return structured data with validation errors
  async parseExcelFile(buffer: Buffer, schoolId: string): Promise<ParsedBulkData> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const errors: ValidationError[] = [];

    // Parse Teachers sheet
    const teachers: TeacherImportData[] = [];
    if (workbook.SheetNames.includes('Teachers')) {
      const teachersSheet = workbook.Sheets['Teachers'];
      const teachersJson = XLSX.utils.sheet_to_json(teachersSheet);
      
      teachersJson.forEach((row: any, index) => {
        const teacher: any = { originalRowNumber: index + 2 };
        
        // Support both asterisk and non-asterisk column names for flexibility
        if (row['Name*'] || row['Name']) teacher.name = (row['Name*'] || row['Name']).toString().trim();
        if (row['Mobile Number*'] || row['Mobile Number']) teacher.contactNumber = (row['Mobile Number*'] || row['Mobile Number']).toString().trim();
        if (row['Email']) teacher.email = row['Email'].toString().trim();
        if (row['Designation']) teacher.designation = row['Designation'].toString().trim();
        if (row['School ID*'] || row['School ID']) teacher.schoolIdNumber = (row['School ID*'] || row['School ID']).toString().trim();
        
        // Parse Max Periods/Day (optional, defaults to 6)
        if (row['Max Periods/Day']) {
          const maxPeriods = parseInt(row['Max Periods/Day'].toString().trim());
          if (!isNaN(maxPeriods) && maxPeriods > 0) {
            teacher.maxDailyPeriods = maxPeriods;
          }
        }
        
        if (row['Aadhaar Number']) teacher.aadhar = row['Aadhaar Number'].toString().trim();
        if (row['Gender']) teacher.gender = row['Gender'].toString().toLowerCase().trim();
        if (row['Blood Group']) teacher.bloodGroup = row['Blood Group'].toString().trim();
        if (row['Date of Birth']) teacher.dateOfBirth = row['Date of Birth'].toString().trim();
        if (row['Father/Husband Name']) teacher.fatherHusbandName = row['Father/Husband Name'].toString().trim();
        if (row['Address']) teacher.address = row['Address'].toString().trim();
        if (row['Category']) teacher.category = row['Category'].toString().trim();
        if (row['Religion']) teacher.religion = row['Religion'].toString().trim();
        
        teachers.push(teacher);
      });
    }

    // Parse Students sheet
    const students: StudentImportData[] = [];
    if (workbook.SheetNames.includes('Students')) {
      const studentsSheet = workbook.Sheets['Students'];
      const studentsJson = XLSX.utils.sheet_to_json(studentsSheet);
      
      studentsJson.forEach((row: any, index) => {
        const student: any = { originalRowNumber: index + 2 };
        
        // Support both asterisk and non-asterisk column names for flexibility
        if (row['First Name*'] || row['First Name']) student.firstName = (row['First Name*'] || row['First Name']).toString().trim();
        if (row['Last Name*'] || row['Last Name']) student.lastName = (row['Last Name*'] || row['Last Name']).toString().trim();
        if (row['Admission Number*'] || row['Admission Number']) student.admissionNumber = (row['Admission Number*'] || row['Admission Number']).toString().trim();
        if (row['Grade*'] || row['Grade']) student.grade = (row['Grade*'] || row['Grade']).toString().trim();
        if (row['Section*'] || row['Section']) student.section = (row['Section*'] || row['Section']).toString().trim().toUpperCase();
        if (row['Roll Number']) student.rollNumber = row['Roll Number'].toString().trim();
        if (row['Email']) student.email = row['Email'].toString().trim();
        if (row['Contact Number']) student.contactNumber = row['Contact Number'].toString().trim();
        if (row['Date of Birth']) student.dateOfBirth = row['Date of Birth'].toString().trim();
        if (row['Gender']) student.gender = row['Gender'].toString().toLowerCase().trim();
        if (row['Blood Group']) student.bloodGroup = row['Blood Group'].toString().trim();
        if (row['Address']) student.address = row['Address'].toString().trim();
        if (row['Emergency Contact']) student.emergencyContact = row['Emergency Contact'].toString().trim();
        
        students.push(student);
      });
    }

    // Parse Assignments sheet
    const assignments: AssignmentImportData[] = [];
    if (workbook.SheetNames.includes('Assignments')) {
      const assignmentsSheet = workbook.Sheets['Assignments'];
      const assignmentsJson = XLSX.utils.sheet_to_json(assignmentsSheet);
      
      assignmentsJson.forEach((row: any, index) => {
        const assignment: any = { originalRowNumber: index + 2 };
        
        // Support both asterisk and non-asterisk column names for flexibility
        if (row['Teacher School ID*'] || row['Teacher School ID']) assignment.teacherSchoolId = (row['Teacher School ID*'] || row['Teacher School ID']).toString().trim();
        if (row['Grade*'] || row['Grade']) assignment.grade = (row['Grade*'] || row['Grade']).toString().trim();
        if (row['Section*'] || row['Section']) assignment.section = (row['Section*'] || row['Section']).toString().trim().toUpperCase();
        if (row['Subject Code*'] || row['Subject Code']) assignment.subjectCode = (row['Subject Code*'] || row['Subject Code']).toString().trim().toUpperCase();
        if (row['Subject Name*'] || row['Subject Name']) assignment.subjectName = (row['Subject Name*'] || row['Subject Name']).toString().trim();
        
        // Parse weekly frequency - handle both column names and check for valid numeric values
        const weeklyFreqValue = row['Weekly Frequency*'] || row['Weekly Frequency'] || row['Weekly Freq*'] || row['Weekly Freq'];
        if (weeklyFreqValue !== undefined && weeklyFreqValue !== null && weeklyFreqValue !== '') {
          const parsed = parseInt(weeklyFreqValue.toString());
          if (!isNaN(parsed)) {
            assignment.weeklyFrequency = parsed;
          }
        }
        
        assignments.push(assignment);
      });
    }

    // Perform comprehensive validation
    const classesToCreate = await this.validateData(teachers, students, assignments, schoolId, errors);

    return { teachers, students, assignments, errors, classesToCreate, schoolId };
  }

  // Helper function to extract unique classes
  private extractUniqueClasses(
    students: StudentImportData[],
    assignments: AssignmentImportData[]
  ): Array<{ grade: string; section: string }> {
    const classSet = new Set<string>();
    
    students.forEach(s => {
      if (s.grade) {
        // Section is optional - use empty string if not provided
        const section = s.section || '';
        classSet.add(`${s.grade}|${section}`);
      }
    });
    
    assignments.forEach(a => {
      if (a.grade) {
        // Section is optional - use empty string if not provided
        const section = a.section || '';
        classSet.add(`${a.grade}|${section}`);
      }
    });
    
    return Array.from(classSet).map(c => {
      const [grade, section] = c.split('|');
      return { grade, section };
    });
  }

  // Comprehensive validation
  private async validateData(
    teachers: TeacherImportData[],
    students: StudentImportData[],
    assignments: AssignmentImportData[],
    schoolId: string,
    errors: ValidationError[]
  ): Promise<Array<{ grade: string; section: string }>> {
    // Track duplicates within file
    const teacherMobileMap = new Map<string, number>();
    const teacherSchoolIdMap = new Map<string, number>();
    const studentAdmissionMap = new Map<string, number>();
    const subjectCodeMap = new Map<string, number>();
    const assignmentMap = new Map<string, number>();

    // Get existing data from database
    const existingTeachers = await storage.getTeachers(schoolId);
    const existingStudents = await storage.getStudents(schoolId);
    const existingSubjects = await storage.getSubjects(schoolId);
    const existingClasses = await storage.getClasses(schoolId);

    // Validate Teachers
    teachers.forEach((teacher, index) => {
      const row = teacher.originalRowNumber;

      // Required fields
      if (!teacher.name || teacher.name.trim() === '') {
        errors.push({ row, field: 'name', message: 'Name is required' });
      }

      if (!teacher.contactNumber || teacher.contactNumber.trim() === '') {
        errors.push({ row, field: 'contactNumber', message: 'Mobile number is required' });
      } else if (!/^\d{10}$/.test(teacher.contactNumber)) {
        errors.push({ row, field: 'contactNumber', message: 'Mobile number must be exactly 10 digits' });
      } else {
        // Check duplicate within file
        if (teacherMobileMap.has(teacher.contactNumber)) {
          const firstRow = teacherMobileMap.get(teacher.contactNumber)!;
          errors.push({ row, field: 'contactNumber', message: `Duplicate mobile number (first in row ${firstRow})` });
        } else {
          teacherMobileMap.set(teacher.contactNumber, row);
          
          // Check duplicate in database
          const existingTeacher = existingTeachers.find(t => t.contactNumber === teacher.contactNumber);
          if (existingTeacher) {
            errors.push({ row, field: 'contactNumber', message: 'Mobile number already exists in database' });
          }
        }
      }

      // School ID is now mandatory
      if (!teacher.schoolIdNumber || teacher.schoolIdNumber.trim() === '') {
        errors.push({ row, field: 'schoolIdNumber', message: 'School ID is required' });
      } else {
        // Check duplicate within file
        if (teacherSchoolIdMap.has(teacher.schoolIdNumber)) {
          const firstRow = teacherSchoolIdMap.get(teacher.schoolIdNumber)!;
          errors.push({ row, field: 'schoolIdNumber', message: `Duplicate School ID (first in row ${firstRow})` });
        } else {
          teacherSchoolIdMap.set(teacher.schoolIdNumber, row);
          
          // Check duplicate in database
          const existingTeacher = existingTeachers.find(t => t.schoolIdNumber === teacher.schoolIdNumber);
          if (existingTeacher) {
            errors.push({ row, field: 'schoolIdNumber', message: 'School ID already exists in database' });
          }
        }
      }

      // Email validation (if provided)
      if (teacher.email && teacher.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(teacher.email)) {
          errors.push({ row, field: 'email', message: 'Invalid email format' });
        }
      }

      // Gender validation (if provided)
      if (teacher.gender && !['male', 'female', 'other'].includes(teacher.gender)) {
        errors.push({ row, field: 'gender', message: 'Gender must be male, female, or other' });
      }
    });

    // Validate Students
    students.forEach((student, index) => {
      const row = student.originalRowNumber;

      // Required fields
      if (!student.firstName || student.firstName.trim() === '') {
        errors.push({ row, field: 'firstName', message: 'First name is required' });
      }

      if (!student.lastName || student.lastName.trim() === '') {
        errors.push({ row, field: 'lastName', message: 'Last name is required' });
      }

      if (!student.admissionNumber || student.admissionNumber.trim() === '') {
        errors.push({ row, field: 'admissionNumber', message: 'Admission number is required' });
      } else {
        // Check duplicate within file
        if (studentAdmissionMap.has(student.admissionNumber)) {
          const firstRow = studentAdmissionMap.get(student.admissionNumber)!;
          errors.push({ row, field: 'admissionNumber', message: `Duplicate admission number (first in row ${firstRow})` });
        } else {
          studentAdmissionMap.set(student.admissionNumber, row);
          
          // Check duplicate in database
          const existingStudent = existingStudents.find(s => s.admissionNumber === student.admissionNumber);
          if (existingStudent) {
            errors.push({ row, field: 'admissionNumber', message: 'Admission number already exists in database' });
          }
        }
      }

      if (!student.grade || student.grade.trim() === '') {
        errors.push({ row, field: 'grade', message: 'Grade is required' });
      }

      // Section is optional - some grades like Playschool may not have sections

      // Email validation (if provided)
      if (student.email && student.email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(student.email)) {
          errors.push({ row, field: 'email', message: 'Invalid email format' });
        }
      }

      // Contact number validation (if provided)
      if (student.contactNumber && student.contactNumber.trim() !== '') {
        if (!/^\d{10}$/.test(student.contactNumber)) {
          errors.push({ row, field: 'contactNumber', message: 'Contact number must be exactly 10 digits' });
        }
      }

      // Gender validation (if provided)
      if (student.gender && !['male', 'female', 'other'].includes(student.gender)) {
        errors.push({ row, field: 'gender', message: 'Gender must be male, female, or other' });
      }
    });

    // Validate roll number uniqueness within same class-section
    const rollNumberMap = new Map<string, { rollNumber: string; row: number }>();
    students.forEach((student) => {
      const row = student.originalRowNumber;
      
      // Only validate roll number if it's provided
      if (student.rollNumber && student.rollNumber.trim() !== '') {
        const classKey = `${student.grade}-${student.section || ''}`;
        const rollKey = `${classKey}|${student.rollNumber.trim()}`;
        
        if (rollNumberMap.has(rollKey)) {
          const firstOccurrence = rollNumberMap.get(rollKey)!;
          const sectionDisplay = student.section ? `-${student.section}` : '';
          errors.push({ 
            row, 
            field: 'rollNumber', 
            message: `Roll number ${student.rollNumber} already assigned in Class ${student.grade}${sectionDisplay} (first in row ${firstOccurrence.row})` 
          });
        } else {
          rollNumberMap.set(rollKey, { rollNumber: student.rollNumber, row });
        }
      }
    });

    // Validate Assignments
    assignments.forEach((assignment, index) => {
      const row = assignment.originalRowNumber;

      // Required fields
      if (!assignment.teacherSchoolId || assignment.teacherSchoolId.trim() === '') {
        errors.push({ row, field: 'teacherSchoolId', message: 'Teacher School ID is required' });
      } else {
        // Check if teacher exists in teachers sheet (cross-sheet validation)
        const teacherExists = teachers.find(t => t.schoolIdNumber === assignment.teacherSchoolId);
        if (!teacherExists) {
          // Check if teacher exists in database
          const dbTeacher = existingTeachers.find(t => t.schoolIdNumber === assignment.teacherSchoolId);
          if (!dbTeacher) {
            errors.push({ row, field: 'teacherSchoolId', message: 'Teacher with this School ID not found in Teachers sheet or database' });
          }
        }
      }

      if (!assignment.grade || assignment.grade.trim() === '') {
        errors.push({ row, field: 'grade', message: 'Grade is required' });
      }

      // Section is optional - some grades like Playschool may not have sections
      
      // Subject code is now auto-generated, not validated

      if (!assignment.subjectName || assignment.subjectName.trim() === '') {
        errors.push({ row, field: 'subjectName', message: 'Subject name is required' });
      }

      if (!assignment.weeklyFrequency || assignment.weeklyFrequency < 1) {
        errors.push({ row, field: 'weeklyFrequency', message: 'Weekly frequency must be at least 1' });
      }

      // Check for duplicate class-subject assignments
      if (assignment.grade && assignment.subjectCode) {
        // Normalize section to empty string if not provided
        const section = assignment.section || '';
        const assignmentKey = `${assignment.grade}-${section}-${assignment.subjectCode}`;
        if (assignmentMap.has(assignmentKey)) {
          const firstRow = assignmentMap.get(assignmentKey)!;
          errors.push({ row, field: 'subjectCode', message: `Duplicate assignment (first in row ${firstRow})` });
        } else {
          assignmentMap.set(assignmentKey, row);
        }
      }
    });

    // Validate period allocation for each class
    await this.validatePeriodAllocation(assignments, existingClasses, schoolId, errors);

    // Validate teacher workload
    await this.validateTeacherWorkload(assignments, existingTeachers, teachers, schoolId, errors);

    // Extract unique classes and determine which need to be created
    const uniqueClasses = this.extractUniqueClasses(students, assignments);
    const classesToCreate: Array<{ grade: string; section: string }> = [];
    
    for (const classInfo of uniqueClasses) {
      const classExists = existingClasses.find(c => 
        c.grade === classInfo.grade && c.section === classInfo.section
      );
      if (!classExists) {
        classesToCreate.push(classInfo);
      }
    }

    return classesToCreate;
  }

  // Validate period allocation for bulk assignments
  private async validatePeriodAllocation(
    assignments: AssignmentImportData[],
    existingClasses: any[],
    schoolId: string,
    errors: ValidationError[]
  ): Promise<void> {
    // Group assignments by class
    const assignmentsByClass = new Map<string, Array<AssignmentImportData>>();
    
    for (const assignment of assignments) {
      const classKey = `${assignment.grade}-${assignment.section}`;
      if (!assignmentsByClass.has(classKey)) {
        assignmentsByClass.set(classKey, []);
      }
      assignmentsByClass.get(classKey)!.push(assignment);
    }

    // Validate each class
    for (const [classKey, classAssignments] of Array.from(assignmentsByClass.entries())) {
      const [grade, section] = classKey.split('-');
      
      // Find the class ID
      const classObj = existingClasses.find((c: any) => 
        c.grade === grade && c.section === section
      );

      if (!classObj) {
        // Class doesn't exist yet - will be created during import
        // Validate against the default weekly period cap
        try {
          const weeklyPeriodCap = await classPeriodValidator.getWeeklyPeriodCap(schoolId);
          const totalPeriods = classAssignments.reduce((sum, a) => sum + a.weeklyFrequency, 0);
          
          if (totalPeriods > weeklyPeriodCap) {
            const className = getClassName(grade, section);
            const exceedBy = totalPeriods - weeklyPeriodCap;
            
            // Add error for each assignment in this class
            for (const assignment of classAssignments) {
              errors.push({
                row: assignment.originalRowNumber,
                field: 'weeklyFrequency',
                message: `${className}: Total of ${totalPeriods} periods exceeds weekly limit of ${weeklyPeriodCap} (over by ${exceedBy}). Reduce period counts for this class.`
              });
            }
          }
        } catch (error: any) {
          // If timetable structure not configured, add error
          if (error.statusCode === 400) {
            for (const assignment of classAssignments) {
              errors.push({
                row: assignment.originalRowNumber,
                field: 'weeklyFrequency',
                message: error.message
              });
            }
          } else {
            // Unexpected error - log and rethrow
            console.error('Unexpected error validating period allocation for new class:', error);
            throw error;
          }
        }
      } else {
        // Class exists - validate against current + new assignments
        try {
          const assignmentData = classAssignments.map(a => ({
            classId: classObj.id,
            weeklyFrequency: a.weeklyFrequency,
            originalRowNumber: a.originalRowNumber
          }));

          const validationResult = await classPeriodValidator.validateBulkAssignments(assignmentData);
          
          if (!validationResult.valid) {
            // Add errors for each row in the over-allocated class
            for (const [rowNumber, error] of Array.from(validationResult.errorsByRow.entries())) {
              errors.push({
                row: rowNumber,
                field: 'weeklyFrequency',
                message: error.message
              });
            }
          }
        } catch (error: any) {
          // If timetable structure not configured or validator error, add error to all rows
          if (error.statusCode === 400 || error.statusCode === 404) {
            for (const assignment of classAssignments) {
              errors.push({
                row: assignment.originalRowNumber,
                field: 'weeklyFrequency',
                message: error.message
              });
            }
          } else {
            // Unexpected error - log and rethrow
            console.error('Unexpected error validating period allocation for existing class:', error);
            throw error;
          }
        }
      }
    }
  }

  // Validate teacher workload for bulk assignments
  private async validateTeacherWorkload(
    assignments: AssignmentImportData[],
    existingTeachers: any[],
    newTeachers: TeacherImportData[],
    schoolId: string,
    errors: ValidationError[]
  ): Promise<void> {
    // Get school default max periods per day
    const school = await storage.getSchool(schoolId);
    const schoolDefaultMaxPeriods = school?.defaultMaxPeriodsPerDay || 6;

    // Group assignments by teacher School ID
    const assignmentsByTeacher = new Map<string, Array<AssignmentImportData>>();
    
    for (const assignment of assignments) {
      const teacherId = assignment.teacherSchoolId;
      if (!assignmentsByTeacher.has(teacherId)) {
        assignmentsByTeacher.set(teacherId, []);
      }
      assignmentsByTeacher.get(teacherId)!.push(assignment);
    }

    // Validate each teacher's workload
    for (const [teacherSchoolId, teacherAssignments] of Array.from(assignmentsByTeacher.entries())) {
      // Find teacher from existing database or new teachers in upload
      let teacher = existingTeachers.find(t => t.schoolIdNumber === teacherSchoolId);
      let maxDailyPeriods = schoolDefaultMaxPeriods; // Use school default
      let teacherName = teacherSchoolId; // Fallback name
      
      if (teacher) {
        // Teacher exists in database - use their settings
        maxDailyPeriods = teacher.maxDailyPeriods || schoolDefaultMaxPeriods;
        teacherName = teacher.name;
      } else {
        // Check if teacher is in the new teachers being uploaded
        const newTeacher = newTeachers.find(t => t.schoolIdNumber === teacherSchoolId);
        if (newTeacher) {
          maxDailyPeriods = newTeacher.maxDailyPeriods || schoolDefaultMaxPeriods;
          teacherName = newTeacher.name;
        }
      }
      
      // Calculate total periods being assigned in this upload
      const newPeriods = teacherAssignments.reduce((sum: number, a: AssignmentImportData) => sum + a.weeklyFrequency, 0);
      
      // Get existing assignments for this teacher (if teacher exists in DB)
      let currentPeriods = 0;
      if (teacher) {
        const existingAssignments = await storage.getClassSubjectAssignmentsByTeacher(teacher.id);
        currentPeriods = existingAssignments.reduce((sum, a) => sum + (a.weeklyFrequency || 0), 0);
      }
      
      // Calculate teacher's weekly capacity
      const availability = teacher?.availability || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false
      };
      const workingDays = getWorkingDaysFromAvailability(availability);
      const weeklyCapacity = calculateWeeklyCapacity(maxDailyPeriods, workingDays);
      
      const totalAfterAssignment = currentPeriods + newPeriods;
      
      // Check if exceeds capacity
      if (totalAfterAssignment > weeklyCapacity) {
        // Add error to ALL rows for this teacher with consistent message format
        for (const assignment of teacherAssignments) {
          errors.push({
            row: assignment.originalRowNumber,
            field: 'teacherSchoolId',
            message: `Teacher limit reached - ${totalAfterAssignment} periods assigned, max ${weeklyCapacity} allowed`
          });
        }
      }
    }
  }

  // Import validated data with transactions and bulk inserts
  async importData(
    teachers: TeacherImportData[],
    students: StudentImportData[],
    assignments: AssignmentImportData[],
    schoolId: string,
    userId: string,
    progressCallback?: (stage: string, percentage: number) => void
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Get school default max periods per day
      const school = await storage.getSchool(schoolId);
      const schoolDefaultMaxPeriods = school?.defaultMaxPeriodsPerDay || 6;

      return await db.transaction(async (tx) => {
        // Get current academic session
        const sessions = await storage.getAcademicSessions(schoolId);
        const currentSession = sessions.find((s: any) => {
          const now = new Date();
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          return now >= start && now <= end;
        });

        if (!currentSession) {
          throw new Error('No active academic session found for this school');
        }

        const academicSessionId = currentSession.id;

        // Step 1: Prefetch all existing data
        let existingClasses = await storage.getClasses(schoolId);
        const existingTeachersData = await storage.getTeachers(schoolId);
        let existingSubjects = await storage.getSubjects(schoolId);

        // Build lookup maps for existing data
        const existingTeacherBySchoolId = new Map<string, any>();
        existingTeachersData.forEach(t => {
          if (t.schoolIdNumber) {
            existingTeacherBySchoolId.set(t.schoolIdNumber, t);
          }
        });

        const existingSubjectByCode = new Map<string, any>();
        existingSubjects.forEach(s => {
          existingSubjectByCode.set(s.code, s);
        });

        const existingClassByGradeSection = new Map<string, any>();
        existingClasses.forEach(c => {
          const key = `${c.grade}-${c.section}`;
          existingClassByGradeSection.set(key, c);
        });

        // Step 2: Auto-create missing classes
        progressCallback?.('Creating classes', 10);
        const uniqueClasses = this.extractUniqueClasses(students, assignments);
        const createdClassesList: string[] = [];

        for (const classInfo of uniqueClasses) {
          const key = `${classInfo.grade}-${classInfo.section}`;
          if (!existingClassByGradeSection.has(key)) {
            // Count students in this class
            const studentCount = students.filter(s => 
              s.grade === classInfo.grade && s.section === classInfo.section
            ).length;

            // Create the class
            const newClass = await storage.createClass({
              grade: classInfo.grade,
              section: classInfo.section,
              schoolId,
              academicSessionId,
              studentCount,
              room: null,
              requiredSubjects: []
            });

            existingClassByGradeSection.set(key, newClass);
            createdClassesList.push(key);
          }
        }

        // Refresh classes list after creation
        existingClasses = await storage.getClasses(schoolId);
        existingClassByGradeSection.clear();
        existingClasses.forEach(c => {
          const key = `${c.grade}-${c.section}`;
          existingClassByGradeSection.set(key, c);
        });

        // Step 3: Bulk insert teachers in chunks
        progressCallback?.('Importing teachers', 30);
        const teacherIdMap = new Map<string, string>(); // schoolIdNumber -> teacherId
        const CHUNK_SIZE = 200;

        if (teachers.length > 0) {
          for (let i = 0; i < teachers.length; i += CHUNK_SIZE) {
            const chunk = teachers.slice(i, i + CHUNK_SIZE);
            const teacherValues = chunk.map(teacher => ({
              name: teacher.name,
              employeeId: teacher.schoolIdNumber || `T${Date.now()}_${i}`,
              contactNumber: teacher.contactNumber,
              email: teacher.email || null,
              designation: teacher.designation || null,
              schoolIdNumber: teacher.schoolIdNumber || null,
              aadhar: teacher.aadhar || null,
              gender: teacher.gender || null,
              bloodGroup: teacher.bloodGroup || null,
              dateOfBirth: teacher.dateOfBirth || null,
              fatherHusbandName: teacher.fatherHusbandName || null,
              address: teacher.address || null,
              category: teacher.category || null,
              religion: teacher.religion || null,
              schoolId,
              classes: [],
              availability: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: true,
                sunday: false
              },
              maxDailyPeriods: teacher.maxDailyPeriods || schoolDefaultMaxPeriods, // Use from Excel or school default
              isActive: true,
              status: 'active' as const
            }));

            const insertedTeachers = await tx.insert(teachersTable).values(teacherValues).returning();
            
            // Build teacher ID map
            insertedTeachers.forEach((insertedTeacher: any, index: number) => {
              const originalTeacher = chunk[index];
              if (originalTeacher.schoolIdNumber) {
                teacherIdMap.set(originalTeacher.schoolIdNumber, insertedTeacher.id);
              }
            });
          }
        }

        // Step 4: Bulk insert students in chunks
        progressCallback?.('Importing students', 60);
        if (students.length > 0) {
          for (let i = 0; i < students.length; i += CHUNK_SIZE) {
            const chunk = students.slice(i, i + CHUNK_SIZE);
            const studentValues = chunk.map(student => {
              const key = `${student.grade}-${student.section}`;
              const classObj = existingClassByGradeSection.get(key);
              
              if (!classObj) {
                throw new Error(`Class ${student.grade} ${student.section} not found`);
              }

              return {
                admissionNumber: student.admissionNumber,
                firstName: student.firstName,
                lastName: student.lastName,
                classId: classObj.id,
                schoolId,
                rollNumber: student.rollNumber || null,
                email: student.email || null,
                contactNumber: student.contactNumber || null,
                dateOfBirth: student.dateOfBirth || null,
                gender: student.gender || null,
                bloodGroup: student.bloodGroup || null,
                address: student.address || null,
                emergencyContact: student.emergencyContact || null,
                isActive: true
              };
            });

            await tx.insert(studentsTable).values(studentValues);
          }
        }

        // Step 5: Auto-generate subject codes and create missing subjects
        progressCallback?.('Auto-generating subject codes', 70);
        
        // Track grade-subject combinations to ensure same subject in same grade gets same code
        const gradeSubjectCodeMap = new Map<string, string>(); // key: "grade-subjectName" -> value: subjectCode
        
        // First, populate map with existing subjects that match grade pattern
        existingSubjects.forEach(subject => {
          // Try to extract grade from code (e.g., MAT5 -> grade 5, ENGLKG -> grade LKG)
          const codeMatch = subject.code.match(/^([A-Z]+)(.+)$/);
          if (codeMatch) {
            const grade = codeMatch[2].replace(/_\d+$/, ''); // Remove counter suffix if present
            const key = `${grade}-${subject.name.toLowerCase()}`;
            gradeSubjectCodeMap.set(key, subject.code);
          }
        });
        
        // Auto-generate codes for all assignments
        for (const assignment of assignments) {
          const normalizedName = assignment.subjectName.toLowerCase();
          const gradeSubjectKey = `${assignment.grade}-${normalizedName}`;
          
          // Check if we already have a code for this grade-subject combination
          if (gradeSubjectCodeMap.has(gradeSubjectKey)) {
            assignment.subjectCode = gradeSubjectCodeMap.get(gradeSubjectKey);
          } else {
            // Generate new grade-specific code using shared utility
            const newCode = await generateGradeSpecificSubjectCode(
              assignment.subjectName,
              assignment.grade,
              schoolId
            );
            assignment.subjectCode = newCode;
            gradeSubjectCodeMap.set(gradeSubjectKey, newCode);
          }
        }
        
        // Now create missing subjects
        const missingSubjects = new Map<string, { name: string; code: string; weeklyFrequency: number }>();
        
        for (const assignment of assignments) {
          if (!existingSubjectByCode.has(assignment.subjectCode!)) {
            if (!missingSubjects.has(assignment.subjectCode!)) {
              missingSubjects.set(assignment.subjectCode!, {
                name: assignment.subjectName,
                code: assignment.subjectCode!,
                weeklyFrequency: assignment.weeklyFrequency
              });
            }
          }
        }

        if (missingSubjects.size > 0) {
          const subjectValues = Array.from(missingSubjects.values()).map(subject => ({
            name: subject.name,
            code: subject.code,
            periodsPerWeek: subject.weeklyFrequency,
            color: this.generateColorForSubjectCode(subject.code),
            schoolId
          }));

          const insertedSubjects = await tx.insert(subjects).values(subjectValues).returning();
          
          // Update existing subjects map
          insertedSubjects.forEach((subject: any) => {
            existingSubjectByCode.set(subject.code, subject);
          });
        }

        // Step 6: Bulk insert assignments
        progressCallback?.('Creating assignments', 90);
        if (assignments.length > 0) {
          const assignmentValues = assignments.map(assignment => {
            // Get teacher ID from map or existing teachers
            let teacherId: string | undefined = teacherIdMap.get(assignment.teacherSchoolId);
            
            if (!teacherId) {
              const existingTeacher = existingTeacherBySchoolId.get(assignment.teacherSchoolId);
              if (existingTeacher) {
                teacherId = existingTeacher.id;
              }
            }

            if (!teacherId) {
              throw new Error(`Teacher with School ID ${assignment.teacherSchoolId} not found`);
            }

            // Get subject ID from map (subjectCode is guaranteed to exist after auto-generation)
            const subject = existingSubjectByCode.get(assignment.subjectCode!);
            if (!subject) {
              throw new Error(`Subject with code ${assignment.subjectCode} not found`);
            }

            // Get class ID from map
            const key = `${assignment.grade}-${assignment.section}`;
            const classObj = existingClassByGradeSection.get(key);
            
            if (!classObj) {
              throw new Error(`Class ${assignment.grade} ${assignment.section} not found`);
            }

            return {
              classId: classObj.id,
              subjectId: subject.id,
              weeklyFrequency: assignment.weeklyFrequency,
              assignedTeacherId: teacherId,
              academicSessionId
            };
          });

          await tx.insert(classSubjectAssignments).values(assignmentValues);
        }

        progressCallback?.('Finalizing', 100);
        
        return {
          success: true,
          message: 'Data imported successfully! Next step: Generate login credentials for teachers and students in User Management.',
          details: {
            teachersImported: teachers.length,
            studentsImported: students.length,
            assignmentsImported: assignments.length,
            classesCreated: createdClassesList.length,
            classesCreatedList: createdClassesList
          }
        };
      });
    } catch (error: any) {
      console.error('Import error:', error);
      return {
        success: false,
        message: error.message || 'Failed to import data'
      };
    }
  }

  // Helper function to generate consistent colors

  private generateColorForSubjectCode(subjectCode: string): string {
    const colors = [
      "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
      "#06B6D4", "#F97316", "#84CC16", "#EC4899", "#6366F1",
      "#14B8A6", "#DC2626", "#7C3AED", "#059669", "#D97706",
      "#2563EB", "#BE123C", "#0891B2", "#CA8A04", "#9333EA"
    ];
    
    let hash = 0;
    for (let i = 0; i < subjectCode.length; i++) {
      const char = subjectCode.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  }
}

export const bulkUploadService = new BulkUploadService();
