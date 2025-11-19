import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All class grades
const allClasses = [
  'Playschool', 'Pre-Nursery', 'Nursery', 'LKG', 'UKG',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

// Common subjects for each level
const subjectsByGrade = {
  'Playschool': ['Play Activities', 'Rhymes', 'Art & Craft', 'Story Time', 'General Awareness'],
  'Pre-Nursery': ['Pre-Math', 'Pre-Reading', 'Art', 'Music', 'Physical Education'],
  'Nursery': ['English', 'Mathematics', 'EVS', 'Art', 'Games'],
  'LKG': ['English', 'Mathematics', 'General Awareness', 'Art & Craft', 'Physical Education'],
  'UKG': ['English', 'Mathematics', 'EVS', 'Drawing', 'Games'],
  '1': ['English', 'Mathematics', 'EVS', 'Hindi', 'Computer Science'],
  '2': ['English', 'Mathematics', 'EVS', 'Hindi', 'Computer Science'],
  '3': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '4': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '5': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '6': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '7': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '8': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '9': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '10': ['English', 'Mathematics', 'Science', 'Social Studies', 'Hindi'],
  '11': ['English', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science'],
  '12': ['English', 'Mathematics', 'Physics', 'Chemistry', 'Computer Science']
};

// Indian names for diversity
const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Reyansh', 'Aarush', 'Kabir', 'Veer', 'Aayan', 'Darsh',
  'Aadhya', 'Ananya', 'Pari', 'Anika', 'Navya', 'Angel', 'Diya', 'Myra', 'Sara', 'Ira',
  'Anvi', 'Saanvi', 'Pihu', 'Riya', 'Avni', 'Kiara', 'Ishita', 'Prisha', 'Shanaya', 'Kavya',
  'Rajesh', 'Suresh', 'Amit', 'Rohit', 'Nikhil', 'Karan', 'Varun', 'Akash', 'Manish', 'Rahul'
];

const lastNames = [
  'Kumar', 'Singh', 'Sharma', 'Patel', 'Verma', 'Gupta', 'Reddy', 'Joshi', 'Nair', 'Iyer',
  'Mehta', 'Shah', 'Desai', 'Rao', 'Bhat', 'Agarwal', 'Malhotra', 'Chopra', 'Kapoor', 'Sinha'
];

const teacherDesignations = [
  'Primary Teacher', 'Secondary Teacher', 'Senior Teacher', 'Subject Teacher',
  'Mathematics Teacher', 'Science Teacher', 'English Teacher', 'Social Studies Teacher'
];

const genders = ['male', 'female'];
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const categories = ['General', 'OBC', 'SC', 'ST'];
const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'];

// Generate random date of birth
function generateDOB(minAge, maxAge) {
  const today = new Date();
  const year = today.getFullYear() - Math.floor(Math.random() * (maxAge - minAge + 1)) - minAge;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Generate random mobile number
function generateMobile(startingDigit = 98) {
  return `${startingDigit}${Math.floor(Math.random() * 90000000) + 10000000}`;
}

// Generate random email
function generateEmail(firstName, lastName, domain = 'school.com') {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
}

console.log('Generating large sample data for Smart Upload...');

// ========== Generate 40 Teachers ==========
console.log('Generating 40 teachers...');
const teachersData = [];
for (let i = 1; i <= 40; i++) {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const gender = genders[Math.floor(Math.random() * genders.length)];
  
  teachersData.push({
    'Name*': `${firstName} ${lastName}`,
    'Mobile Number*': generateMobile(98),
    'Email': generateEmail(firstName, lastName, 'school.com'),
    'Designation': teacherDesignations[Math.floor(Math.random() * teacherDesignations.length)],
    'School ID*': `T${String(i).padStart(3, '0')}`,
    'Max Periods/Day': Math.floor(Math.random() * 3) + 6, // 6-8 periods
    'Aadhaar Number': `${Math.floor(Math.random() * 900000000000) + 100000000000}`,
    'Gender': gender,
    'Blood Group': bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
    'Date of Birth': generateDOB(25, 55),
    'Father/Husband Name': `Mr. ${lastNames[Math.floor(Math.random() * lastNames.length)]}`,
    'Address': `${Math.floor(Math.random() * 999) + 1} ${['Main Street', 'Park Avenue', 'Lake Road', 'Hill View', 'Garden Street'][Math.floor(Math.random() * 5)]}, City`,
    'Category': categories[Math.floor(Math.random() * categories.length)],
    'Religion': religions[Math.floor(Math.random() * religions.length)]
  });
}

// ========== Generate 1500 Students ==========
console.log('Generating 1500 students across all classes...');
const studentsData = [];
let studentCounter = 1;

// Calculate students per section (17 classes × 2 sections = 34 sections)
const totalSections = allClasses.length * 2;
const studentsPerSection = Math.floor(1500 / totalSections); // 44 per section
const extraStudents = 1500 % totalSections; // Distribute remainder

allClasses.forEach((grade, gradeIndex) => {
  ['A', 'B'].forEach((section, sectionIndex) => {
    // Add 1 extra student to first sections to reach exactly 1500
    const studentsInThisSection = studentsPerSection + 
      (gradeIndex * 2 + sectionIndex < extraStudents ? 1 : 0);
    
    for (let i = 1; i <= studentsInThisSection; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const gender = genders[Math.floor(Math.random() * genders.length)];
      
      // Calculate age based on grade
      let minAge, maxAge;
      if (['Playschool', 'Pre-Nursery'].includes(grade)) {
        minAge = 2; maxAge = 3;
      } else if (['Nursery', 'LKG'].includes(grade)) {
        minAge = 3; maxAge = 5;
      } else if (grade === 'UKG') {
        minAge = 5; maxAge = 6;
      } else {
        const gradeNum = parseInt(grade);
        minAge = gradeNum + 5;
        maxAge = gradeNum + 7;
      }
      
      studentsData.push({
        'First Name*': firstName,
        'Last Name*': lastName,
        'Admission Number*': `STU${String(studentCounter).padStart(4, '0')}`,
        'Grade*': grade,
        'Section': section,
        'Roll Number': String(i),
        'Email': studentCounter % 3 === 0 ? generateEmail(firstName, lastName, 'student.com') : '',
        'Contact Number': studentCounter % 2 === 0 ? generateMobile(98) : '',
        'Date of Birth': generateDOB(minAge, maxAge),
        'Gender': gender,
        'Blood Group': bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
        'Address': `${Math.floor(Math.random() * 999) + 1} ${['Main Street', 'Park Avenue', 'Lake Road', 'Hill View', 'Garden Street'][Math.floor(Math.random() * 5)]}, City`,
        'Emergency Contact': generateMobile(99),
        '': '',
        '📋 Allowed Classes (Reference Only)': allClasses.slice(0, 5).join(', ')
      });
      
      studentCounter++;
    }
  });
});

console.log(`Generated ${studentsData.length} students`);

// ========== Generate Assignments ==========
console.log('Generating class-subject-teacher assignments...');
const assignmentsData = [];
let teacherIndex = 0;

allClasses.forEach(grade => {
  const subjects = subjectsByGrade[grade];
  
  subjects.forEach((subject, subjectIndex) => {
    // Assign a teacher (rotate through available teachers)
    const teacherSchoolId = `T${String((teacherIndex % 40) + 1).padStart(3, '0')}`;
    teacherIndex++;
    
    // Both sections share the same subject
    ['A', 'B'].forEach(section => {
      assignmentsData.push({
        'Teacher School ID*': teacherSchoolId,
        'Grade*': grade,
        'Section': section,
        'Subject Name*': subject,
        'Weekly Frequency*': Math.floor(Math.random() * 4) + 5, // 5-8 periods per week
        '': '',
        '📋 Allowed Classes (Reference Only)': allClasses.slice(0, 5).join(', ')
      });
    });
  });
});

console.log(`Generated ${assignmentsData.length} assignments`);

// ========== Create Excel Workbook ==========
console.log('Creating Excel workbook...');
const workbook = XLSX.utils.book_new();

// Teachers Sheet
const teachersSheet = XLSX.utils.json_to_sheet(teachersData);
teachersSheet['!cols'] = [
  { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 },
  { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, 
  { wch: 20 }, { wch: 35 }, { wch: 12 }, { wch: 12 }
];
XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

// Students Sheet
const studentsSheet = XLSX.utils.json_to_sheet(studentsData);
studentsSheet['!cols'] = [
  { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 10 },
  { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
  { wch: 12 }, { wch: 35 }, { wch: 18 }, { wch: 2 }, { wch: 40 }
];
XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');

// Assignments Sheet
const assignmentsSheet = XLSX.utils.json_to_sheet(assignmentsData);
assignmentsSheet['!cols'] = [
  { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 18 }, { wch: 2 }, { wch: 40 }
];
XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Assignments');

// Instructions Sheet
const instructionsData = [
  ['SMART UPLOAD TEMPLATE - BULK DATA IMPORT'],
  [''],
  ['OVERVIEW:'],
  ['This template contains sample data for a complete school setup:'],
  ['- 40 Teachers across all subjects and grades'],
  ['- 1,500 Students distributed across all classes (Playschool to Class 12)'],
  ['- Each class has two sections: A and B'],
  ['- Each class has 5 subjects shared by both sections'],
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
  ['Assignments: Teacher School ID*, Grade*, Subject Name*, Weekly Frequency* are mandatory'],
  [''],
  ['DATA SUMMARY:'],
  [`Total Teachers: 40`],
  [`Total Students: ${studentsData.length}`],
  [`Total Assignments: ${assignmentsData.length} (covering all class-sections and subjects)`],
  ['Distribution: ~44 students per section, balanced across all grades'],
  [''],
  ['VALIDATION TIPS:'],
  ['- Admission Numbers are unique across all students'],
  ['- Mobile Numbers are exactly 10 digits'],
  ['- Each Grade-Section combination creates a separate class'],
  ['- Teacher School IDs in Assignments match Teachers sheet'],
  ['- Subject codes are auto-generated: same subject in same grade gets same code']
];

const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
instructionsSheet['!cols'] = [{ wch: 100 }];
XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

// ========== Save the File ==========
const outputDir = path.join(__dirname, '..', 'attached_assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'Smart_Upload_Sample_1500_Students.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log('\n✅ Sample file generated successfully!');
console.log(`📁 Location: ${outputPath}`);
console.log('\nData Summary:');
console.log(`- Teachers: ${teachersData.length}`);
console.log(`- Students: ${studentsData.length}`);
console.log(`- Assignments: ${assignmentsData.length}`);
console.log(`- Classes: ${allClasses.length} (each with sections A and B)`);
console.log(`- Total Sections: ${allClasses.length * 2}`);
console.log('\nYou can now upload this file using the Smart Upload feature in Chrona!');
