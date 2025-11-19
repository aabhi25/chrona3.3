const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Generate comprehensive sample data for Smart Upload
function generateSmartUploadData() {
  // Define all grade levels as requested
  const gradeLevels = [
    { grade: 'Nursery', sections: ['A', 'B'] },
    { grade: 'LKG', sections: ['A', 'B'] },
    { grade: 'UKG', sections: ['A', 'B'] },
    { grade: '1', sections: ['A', 'B'] },
    { grade: '2', sections: ['A', 'B'] },
    { grade: '3', sections: ['A', 'B'] },
    { grade: '4', sections: ['A', 'B'] },
    { grade: '5', sections: ['A', 'B'] },
    { grade: '6', sections: ['A', 'B'] },
    { grade: '7', sections: ['A', 'B'] },
    { grade: '8', sections: ['A', 'B'] },
    { grade: '9', sections: ['A', 'B'] },
    { grade: '10', sections: ['A', 'B'] },
    { grade: '11', sections: ['A', 'B'] },
    { grade: '12', sections: ['A', 'B'] }
  ];

  // 5 subjects for each grade level
  const subjectsMapping = {
    'Nursery': [
      { code: 'NURS-ENG', name: 'English' },
      { code: 'NURS-MATH', name: 'Mathematics' },
      { code: 'NURS-EVS', name: 'Environmental Studies' },
      { code: 'NURS-ART', name: 'Art & Craft' },
      { code: 'NURS-RHYM', name: 'Rhymes & Music' }
    ],
    'LKG': [
      { code: 'LKG-ENG', name: 'English' },
      { code: 'LKG-MATH', name: 'Mathematics' },
      { code: 'LKG-EVS', name: 'Environmental Studies' },
      { code: 'LKG-ART', name: 'Art & Craft' },
      { code: 'LKG-PHYS', name: 'Physical Education' }
    ],
    'UKG': [
      { code: 'UKG-ENG', name: 'English' },
      { code: 'UKG-MATH', name: 'Mathematics' },
      { code: 'UKG-EVS', name: 'Environmental Studies' },
      { code: 'UKG-ART', name: 'Art & Craft' },
      { code: 'UKG-PHYS', name: 'Physical Education' }
    ],
    '1-5': [
      { code: 'PRIM-ENG', name: 'English' },
      { code: 'PRIM-MATH', name: 'Mathematics' },
      { code: 'PRIM-SCI', name: 'Science' },
      { code: 'PRIM-SST', name: 'Social Studies' },
      { code: 'PRIM-COMP', name: 'Computer Science' }
    ],
    '6-8': [
      { code: 'MID-ENG', name: 'English' },
      { code: 'MID-MATH', name: 'Mathematics' },
      { code: 'MID-SCI', name: 'Science' },
      { code: 'MID-SST', name: 'Social Studies' },
      { code: 'MID-COMP', name: 'Computer Science' }
    ],
    '9-10': [
      { code: 'SEC-ENG', name: 'English' },
      { code: 'SEC-MATH', name: 'Mathematics' },
      { code: 'SEC-SCI', name: 'Science' },
      { code: 'SEC-SST', name: 'Social Studies' },
      { code: 'SEC-COMP', name: 'Computer Science' }
    ],
    '11-12': [
      { code: 'SNR-ENG', name: 'English' },
      { code: 'SNR-MATH', name: 'Mathematics' },
      { code: 'SNR-PHY', name: 'Physics' },
      { code: 'SNR-CHEM', name: 'Chemistry' },
      { code: 'SNR-BIO', name: 'Biology' }
    ]
  };

  function getSubjectsForGrade(grade) {
    if (grade === 'Nursery') return subjectsMapping['Nursery'];
    if (grade === 'LKG') return subjectsMapping['LKG'];
    if (grade === 'UKG') return subjectsMapping['UKG'];
    
    const numGrade = parseInt(grade);
    if (!isNaN(numGrade)) {
      if (numGrade <= 5) return subjectsMapping['1-5'];
      if (numGrade <= 8) return subjectsMapping['6-8'];
      if (numGrade <= 10) return subjectsMapping['9-10'];
      if (numGrade >= 11) return subjectsMapping['11-12'];
    }
    
    return subjectsMapping['1-5'];
  }

  // Generate exactly 40 unique teachers
  const teachersData = [];
  const firstNames = [
    'Rajesh', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Suresh', 'Kavita',
    'Ravi', 'Meera', 'Arjun', 'Divya', 'Karan', 'Pooja', 'Rahul', 'Neha',
    'Arun', 'Sita', 'Krishna', 'Lakshmi', 'Deepak', 'Asha', 'Rohan', 'Priyanka',
    'Nikhil', 'Swati', 'Sanjay', 'Sunita', 'Manoj', 'Rekha', 'Anil', 'Geeta',
    'Vijay', 'Rani', 'Sandeep', 'Madhuri', 'Rakesh', 'Nalini', 'Gopal', 'Kamala'
  ];
  
  const lastNames = [
    'Kumar', 'Sharma', 'Patel', 'Singh', 'Gupta', 'Reddy', 'Nair', 'Iyer',
    'Rao', 'Verma', 'Joshi', 'Pillai', 'Desai', 'Mehta', 'Shah', 'Trivedi',
    'Malhotra', 'Kapoor', 'Chopra', 'Kulkarni', 'Banerjee', 'Das', 'Menon', 'Shetty',
    'Pandey', 'Mishra', 'Agarwal', 'Jain', 'Saxena', 'Bose', 'Dutta', 'Ghosh',
    'Sinha', 'Roy', 'Nambiar', 'Hegde', 'Sood', 'Bedi', 'Kaur', 'Yadav'
  ];
  
  const usedTeacherNames = new Set();
  let teacherId = 1001;
  
  // Generate 40 unique teachers
  for (let i = 0; i < 40; i++) {
    let name, email;
    let attempts = 0;
    
    do {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      name = `${firstName} ${lastName}`;
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${attempts > 0 ? attempts : ''}@school.com`;
      attempts++;
    } while (usedTeacherNames.has(name) && attempts < 100);
    
    usedTeacherNames.add(name);
    
    const mobile = `98${String(teacherId).padStart(8, '0')}`;
    const schoolId = `T${teacherId}`;
    
    teachersData.push({
      Name: name,
      'Mobile Number': mobile,
      'School ID': schoolId,
      Email: email
    });
    
    teacherId++;
  }

  // Generate exactly 1500 unique students
  const studentsData = [];
  const studentFirstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan',
    'Krishna', 'Ishaan', 'Dhruv', 'Aryan', 'Reyansh', 'Shaurya', 'Rudra',
    'Atharv', 'Kiaan', 'Pranav', 'Advait', 'Vedant', 'Aadhya', 'Ananya',
    'Diya', 'Aarohi', 'Pari', 'Anika', 'Saanvi', 'Myra', 'Sara', 'Riya',
    'Isha', 'Avni', 'Navya', 'Prisha', 'Aaradhya', 'Anvi', 'Shanaya', 'Nisha',
    'Divya', 'Ishita', 'Anaya', 'Siya', 'Kiara', 'Pihu', 'Kavya', 'Tanya',
    'Zara', 'Jiya', 'Aditi', 'Sia'
  ];
  
  const studentLastNames = [
    'Sharma', 'Kumar', 'Patel', 'Singh', 'Gupta', 'Reddy', 'Nair', 'Joshi',
    'Mehta', 'Shah', 'Verma', 'Iyer', 'Rao', 'Desai', 'Pillai', 'Trivedi',
    'Malhotra', 'Kapoor', 'Chopra', 'Kulkarni', 'Banerjee', 'Das', 'Menon',
    'Shetty', 'Pandey', 'Mishra', 'Agarwal', 'Jain', 'Saxena', 'Bose'
  ];
  
  const usedStudentNames = new Set();
  let admissionNumber = 2001;
  
  // Calculate students per class (1500 students / 30 classes = 50 students per class)
  const totalClasses = gradeLevels.reduce((sum, gl) => sum + gl.sections.length, 0);
  const studentsPerClass = Math.floor(1500 / totalClasses);
  const extraStudents = 1500 % totalClasses;
  
  let classIndex = 0;
  gradeLevels.forEach((gradeLevel) => {
    gradeLevel.sections.forEach((section) => {
      let classStudents = studentsPerClass;
      if (classIndex < extraStudents) classStudents++;
      
      for (let s = 0; s < classStudents; s++) {
        let fullName;
        let firstName, lastName;
        let attempts = 0;
        
        do {
          firstName = studentFirstNames[admissionNumber % studentFirstNames.length];
          lastName = studentLastNames[Math.floor(admissionNumber / studentFirstNames.length) % studentLastNames.length];
          fullName = `${firstName} ${lastName}`;
          attempts++;
          
          if (attempts > 1) {
            lastName = studentLastNames[(Math.floor(admissionNumber / studentFirstNames.length) + attempts) % studentLastNames.length];
            fullName = `${firstName} ${lastName}`;
          }
        } while (usedStudentNames.has(fullName) && attempts < 100);
        
        usedStudentNames.add(fullName);
        
        const contactNumber = `97${String(admissionNumber).padStart(8, '0')}`;
        const parentContact = `96${String(admissionNumber).padStart(8, '0')}`;
        
        studentsData.push({
          'First Name': firstName,
          'Last Name': lastName,
          'Admission Number': `ADM${admissionNumber}`,
          Grade: gradeLevel.grade,
          Section: section,
          'Contact Number': contactNumber,
          'Parent Name': `${firstName}'s Parent`,
          'Parent Contact': parentContact
        });
        
        admissionNumber++;
      }
      classIndex++;
    });
  });

  // Generate Assignments - Each class gets 5 subjects with assigned teachers
  const assignmentsData = [];
  let teacherIndex = 0;
  
  gradeLevels.forEach((gradeLevel) => {
    const gradeSubjects = getSubjectsForGrade(gradeLevel.grade);
    
    gradeLevel.sections.forEach((section) => {
      gradeSubjects.forEach((subject, subjectIdx) => {
        // Rotate through the 40 teachers
        const teacher = teachersData[teacherIndex % teachersData.length];
        teacherIndex++;
        
        // Set weekly frequency based on subject type and grade
        let weeklyFrequency;
        if (gradeLevel.grade === 'Nursery' || gradeLevel.grade === 'LKG' || gradeLevel.grade === 'UKG') {
          weeklyFrequency = subjectIdx < 2 ? 6 : 5; // English and Math get more periods
        } else if (gradeLevel.grade === '11' || gradeLevel.grade === '12') {
          weeklyFrequency = 8; // Senior secondary
        } else {
          weeklyFrequency = subjectIdx < 2 ? 7 : 6; // English and Math get more periods
        }
        
        assignmentsData.push({
          'Teacher School ID': teacher['School ID'],
          Grade: gradeLevel.grade,
          Section: section,
          'Subject Code': subject.code,
          'Subject Name': subject.name,
          'Weekly Frequency': weeklyFrequency
        });
      });
    });
  });

  return {
    teachers: teachersData,
    students: studentsData,
    assignments: assignmentsData,
    totalClasses: totalClasses
  };
}

// Create Excel file
const data = generateSmartUploadData();

const workbook = XLSX.utils.book_new();

// Add Instructions sheet first
const instructions = [
  ['SMART UPLOAD - COMPREHENSIVE SAMPLE DATA'],
  [''],
  ['📋 DATA SUMMARY:'],
  [`- Teachers: ${data.teachers.length} unique teachers`],
  [`- Students: ${data.students.length} unique students`],
  [`- Total Classes: ${data.totalClasses} (Nursery, LKG, UKG, Classes 1-12 with 2 sections each)`],
  [`- Assignments: ${data.assignments.length} (Each class has 5 subjects)`],
  [''],
  ['ALLOWED CLASS GRADES:'],
  ['Kindergarten: Nursery, LKG, UKG'],
  ['Primary: 1, 2, 3, 4, 5'],
  ['Middle: 6, 7, 8'],
  ['Secondary: 9, 10'],
  ['Senior Secondary: 11, 12'],
  [''],
  ['IMPORTANT NOTES:'],
  ['- Grade: Use EXACT values from the allowed list above (case-sensitive)'],
  ['- Section: Use single letter (A, B, etc.)'],
  ['- Teacher School ID: Must match the School ID from Teachers sheet'],
  ['- Subject Code: Unique identifier for each subject'],
  ['- Weekly Frequency: Number of periods per week (typically 5-8)'],
  ['- All names are unique - no duplicates in teachers or students'],
  [''],
  ['UPLOAD ORDER:'],
  ['1. Upload Teachers sheet first (creates teacher accounts)'],
  ['2. Upload Students sheet second (creates student accounts and classes)'],
  ['3. Upload Assignments sheet last (assigns teachers to class-subject combinations)'],
  [''],
  ['DISTRIBUTION:'],
  ['- Each class (grade-section): 50 students'],
  ['- Each class: 5 subjects assigned'],
  ['- Teachers are distributed across all classes and subjects'],
  [''],
  ['EXAMPLES:'],
  ['- Kindergarten: Grade="Nursery", Section="A"'],
  ['- Primary: Grade="3", Section="B"'],
  ['- Secondary: Grade="10", Section="A"'],
  ['- Assignment: Teacher="T1001", Grade="5", Section="A", Subject="PRIM-ENG", Frequency=7'],
];
const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
instructionsSheet['!cols'] = [{ wch: 85 }];
XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

// Add Teachers sheet
const teachersSheet = XLSX.utils.json_to_sheet(data.teachers);
teachersSheet['!cols'] = [
  { wch: 25 }, // Name
  { wch: 15 }, // Mobile
  { wch: 12 }, // School ID
  { wch: 30 }  // Email
];
XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

// Add Students sheet
const studentsSheet = XLSX.utils.json_to_sheet(data.students);
studentsSheet['!cols'] = [
  { wch: 15 }, // First Name
  { wch: 15 }, // Last Name
  { wch: 18 }, // Admission Number
  { wch: 10 }, // Grade
  { wch: 10 }, // Section
  { wch: 15 }, // Contact Number
  { wch: 20 }, // Parent Name
  { wch: 15 }  // Parent Contact
];
XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');

// Add Assignments sheet
const assignmentsSheet = XLSX.utils.json_to_sheet(data.assignments);
assignmentsSheet['!cols'] = [
  { wch: 18 }, // Teacher School ID
  { wch: 10 }, // Grade
  { wch: 10 }, // Section
  { wch: 15 }, // Subject Code
  { wch: 25 }, // Subject Name
  { wch: 18 }  // Weekly Frequency
];
XLSX.utils.book_append_sheet(workbook, assignmentsSheet, 'Assignments');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'attached_assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write file
const outputPath = path.join(outputDir, 'Smart_Upload_Comprehensive_Sample.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Excel file generated successfully!`);
console.log(`📁 Location: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Teachers: ${data.teachers.length} (all unique)`);
console.log(`   - Students: ${data.students.length} (all unique)`);
console.log(`   - Assignments: ${data.assignments.length}`);
console.log(`   - Total Classes: ${data.totalClasses}`);
console.log(`\n📝 Structure:`);
console.log(`   - Grades: Nursery, LKG, UKG, 1-12`);
console.log(`   - Sections per grade: 2 (A, B)`);
console.log(`   - Students per class: 50`);
console.log(`   - Subjects per class: 5`);
console.log(`\n✨ All teacher and student names are unique - no duplicates!`);
