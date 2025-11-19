import XLSX from 'xlsx';

// Create a new workbook
const workbook = XLSX.utils.book_new();

// Sample Teachers Data
const teachersData = [
  {
    'Teacher Name*': 'Aabhi Kumar',
    'Employee ID*': 'ST001',
    'Contact Number': '9876543210',
    'Email': 'aabhi.kumar@school.com',
    'Max Periods per day': 7
  },
  {
    'Teacher Name*': 'Sur Patel',
    'Employee ID*': 'ST002',
    'Contact Number': '9876543211',
    'Email': 'sur.patel@school.com',
    'Max Periods per day': 6
  },
  {
    'Teacher Name*': 'Priya Sharma',
    'Employee ID*': 'ST003',
    'Contact Number': '9876543212',
    'Email': 'priya.sharma@school.com',
    'Max Periods per day': 7
  },
  {
    'Teacher Name*': 'Rajesh Verma',
    'Employee ID*': 'ST004',
    'Contact Number': '9876543213',
    'Email': 'rajesh.verma@school.com',
    'Max Periods per day': 8
  },
  {
    'Teacher Name*': 'Meera Singh',
    'Employee ID*': 'ST005',
    'Contact Number': '9876543214',
    'Email': 'meera.singh@school.com',
    'Max Periods per day': 7
  },
  {
    'Teacher Name*': 'Amit Desai',
    'Employee ID*': 'ST006',
    'Contact Number': '9876543215',
    'Email': 'amit.desai@school.com',
    'Max Periods per day': 6
  },
  {
    'Teacher Name*': 'Kavita Joshi',
    'Employee ID*': 'ST007',
    'Contact Number': '9876543216',
    'Email': 'kavita.joshi@school.com',
    'Max Periods per day': 7
  },
  {
    'Teacher Name*': 'Deepak Rao',
    'Employee ID*': 'ST008',
    'Contact Number': '9876543217',
    'Email': 'deepak.rao@school.com',
    'Max Periods per day': 8
  }
];

// Sample Classes & Subjects Data
const classSubjectsData = [
  // Playschool
  {
    'Class/Grade*': 'Playschool',
    'Section': '',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST001'
  },
  {
    'Class/Grade*': 'Playschool',
    'Section': '',
    'Subject Name*': 'Science',
    'Subject Code': 'SCIE',
    'Weekly Periods*': 9,
    'Teacher Employee ID': 'ST002'
  },
  
  // Nursery
  {
    'Class/Grade*': 'Nursery',
    'Section': '',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': 'Nursery',
    'Section': '',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 6,
    'Teacher Employee ID': 'ST001'
  },
  {
    'Class/Grade*': 'Nursery',
    'Section': '',
    'Subject Name*': 'Art & Craft',
    'Subject Code': 'ART',
    'Weekly Periods*': 4,
    'Teacher Employee ID': 'ST004'
  },
  
  // LKG - Section A
  {
    'Class/Grade*': 'LKG',
    'Section': 'A',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': 'LKG',
    'Section': 'A',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST001'
  },
  {
    'Class/Grade*': 'LKG',
    'Section': 'A',
    'Subject Name*': 'Environmental Studies',
    'Subject Code': 'EVS',
    'Weekly Periods*': 5,
    'Teacher Employee ID': 'ST005'
  },
  
  // LKG - Section B
  {
    'Class/Grade*': 'LKG',
    'Section': 'B',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': 'LKG',
    'Section': 'B',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST001'
  },
  {
    'Class/Grade*': 'LKG',
    'Section': 'B',
    'Subject Name*': 'Environmental Studies',
    'Subject Code': 'EVS',
    'Weekly Periods*': 5,
    'Teacher Employee ID': 'ST005'
  },
  
  // Class 1
  {
    'Class/Grade*': '1',
    'Section': '',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 9,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': '1',
    'Section': '',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST006'
  },
  {
    'Class/Grade*': '1',
    'Section': '',
    'Subject Name*': 'Science',
    'Subject Code': 'SCIE',
    'Weekly Periods*': 6,
    'Teacher Employee ID': 'ST002'
  },
  {
    'Class/Grade*': '1',
    'Section': '',
    'Subject Name*': 'Hindi',
    'Subject Code': 'HIND',
    'Weekly Periods*': 5,
    'Teacher Employee ID': 'ST007'
  },
  
  // Class 5 - Multiple Sections Example
  {
    'Class/Grade*': '5',
    'Section': 'A',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': '5',
    'Section': 'A',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 9,
    'Teacher Employee ID': 'ST006'
  },
  {
    'Class/Grade*': '5',
    'Section': 'A',
    'Subject Name*': 'Science',
    'Subject Code': 'SCIE',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST002'
  },
  {
    'Class/Grade*': '5',
    'Section': 'A',
    'Subject Name*': 'Social Studies',
    'Subject Code': 'SST',
    'Weekly Periods*': 6,
    'Teacher Employee ID': 'ST008'
  },
  {
    'Class/Grade*': '5',
    'Section': 'A',
    'Subject Name*': 'Computer Science',
    'Subject Code': 'CS',
    'Weekly Periods*': 4,
    'Teacher Employee ID': 'ST004'
  },
  
  // Class 5 - Section B
  {
    'Class/Grade*': '5',
    'Section': 'B',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': '5',
    'Section': 'B',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 9,
    'Teacher Employee ID': 'ST006'
  },
  {
    'Class/Grade*': '5',
    'Section': 'B',
    'Subject Name*': 'Science',
    'Subject Code': 'SCIE',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST002'
  },
  {
    'Class/Grade*': '5',
    'Section': 'B',
    'Subject Name*': 'Social Studies',
    'Subject Code': 'SST',
    'Weekly Periods*': 6,
    'Teacher Employee ID': 'ST008'
  },
  {
    'Class/Grade*': '5',
    'Section': 'B',
    'Subject Name*': 'Physical Education',
    'Subject Code': 'PE',
    'Weekly Periods*': 3,
    'Teacher Employee ID': 'ST005'
  },
  
  // Class 10 - Example of higher class
  {
    'Class/Grade*': '10',
    'Section': '',
    'Subject Name*': 'English',
    'Subject Code': 'ENG',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST003'
  },
  {
    'Class/Grade*': '10',
    'Section': '',
    'Subject Name*': 'Mathematics',
    'Subject Code': 'MATH',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST006'
  },
  {
    'Class/Grade*': '10',
    'Section': '',
    'Subject Name*': 'Science',
    'Subject Code': 'SCIE',
    'Weekly Periods*': 8,
    'Teacher Employee ID': 'ST002'
  },
  {
    'Class/Grade*': '10',
    'Section': '',
    'Subject Name*': 'Social Studies',
    'Subject Code': 'SST',
    'Weekly Periods*': 7,
    'Teacher Employee ID': 'ST008'
  },
  {
    'Class/Grade*': '10',
    'Section': '',
    'Subject Name*': 'Hindi',
    'Subject Code': 'HIND',
    'Weekly Periods*': 5,
    'Teacher Employee ID': 'ST007'
  }
];

// Create Teachers sheet
const teachersSheet = XLSX.utils.json_to_sheet(teachersData);
teachersSheet['!cols'] = [
  { wch: 20 }, // Teacher Name
  { wch: 15 }, // Employee ID
  { wch: 18 }, // Contact Number
  { wch: 30 }, // Email
  { wch: 20 }  // Max Periods per day
];
XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

// Create Classes & Subjects sheet
const classSubjectsSheet = XLSX.utils.json_to_sheet(classSubjectsData);
classSubjectsSheet['!cols'] = [
  { wch: 15 }, // Class/Grade
  { wch: 10 }, // Section
  { wch: 25 }, // Subject Name
  { wch: 15 }, // Subject Code
  { wch: 18 }, // Weekly Periods
  { wch: 22 }  // Teacher Employee ID
];
XLSX.utils.book_append_sheet(workbook, classSubjectsSheet, 'Classes & Subjects');

// Create Instructions sheet
const instructionsData = [
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '📚 SAMPLE DATA INCLUDED' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': 'This file contains sample data to demonstrate the bulk upload format.' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '👥 TEACHERS (8 sample teachers)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • ST001 - Aabhi Kumar (7 periods/day)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • ST002 - Sur Patel (6 periods/day)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • ST003 - Priya Sharma (7 periods/day)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • And 5 more teachers...' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '📖 CLASSES & SUBJECTS' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Playschool: Mathematics (8), Science (9)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Nursery: English (7), Mathematics (6), Art (4)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • LKG A & B: English (8), Mathematics (7), EVS (5) each' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Class 1: English (9), Math (8), Science (6), Hindi (5)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Class 5 A & B: 5 subjects each' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Class 10: 5 core subjects' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '✨ HOW TO USE' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   1. Review the sample data in Teachers and Classes & Subjects sheets' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   2. Modify the data to match your school requirements' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   3. Add or remove rows as needed' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   4. Upload this file via "More > Add via Excel" in the simulation' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '⚠️ IMPORTANT NOTES' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Max Periods per day default is 7 (= 42 periods/week for 6 working days)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Weekly periods must not exceed school timetable limit (typically 48)' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Employee IDs must be unique and match between sheets' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Leave Section empty if class has no sections' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   • Teacher assignments are optional - can be added later' },
  { '': '' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '📋 ALLOWED CLASS NAMES' },
  { 'LOAD SIMULATION BULK UPLOAD - SAMPLE DATA': '   Playschool, Pre-Nursery, Nursery, LKG, UKG, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12' }
];

const instructionsSheet = XLSX.utils.json_to_sheet(instructionsData);
instructionsSheet['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

// Write the file
XLSX.writeFile(workbook, 'load-simulation-sample-data.xlsx');
console.log('✅ Sample Excel file created: load-simulation-sample-data.xlsx');
