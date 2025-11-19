const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Generate comprehensive sample data matching Smart Upload template format
function generateComprehensiveSample() {
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
  
  const designations = ['Primary Teacher', 'Mathematics Teacher', 'Science Teacher', 'English Teacher', 'Senior Teacher'];
  const genders = ['male', 'female'];
  const bloodGroups = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'];
  const categories = ['General', 'OBC', 'SC', 'ST'];
  const religions = ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain'];
  
  const usedTeacherNames = new Set();
  let teacherId = 1001;
  
  // Generate 40 unique teachers
  for (let i = 0; i < 40; i++) {
    let name;
    let attempts = 0;
    
    do {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      name = `${firstName} ${lastName}`;
      attempts++;
      
      if (attempts > 1) {
        const altLastName = lastNames[(i + attempts) % lastNames.length];
        name = `${firstName} ${altLastName}`;
      }
    } while (usedTeacherNames.has(name) && attempts < 100);
    
    usedTeacherNames.add(name);
    
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    const mobile = `98${String(teacherId).padStart(8, '0')}`;
    const schoolId = `T${String(teacherId).padStart(3, '0')}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.com`;
    const maxPeriodsPerDay = 6 + (i % 3); // 6, 7, or 8 periods
    
    teachersData.push({
      'Name*': name,
      'Mobile Number*': mobile,
      'Email': email,
      'Designation': designations[i % designations.length],
      'School ID*': schoolId,
      'Max Periods/Day': maxPeriodsPerDay.toString(),
      'Aadhaar Number': String(123456789000 + teacherId),
      'Gender': genders[i % 2],
      'Blood Group': bloodGroups[i % bloodGroups.length],
      'Date of Birth': `19${85 + (i % 15)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
      'Father/Husband Name': `Mr. ${lastName} Sr.`,
      'Address': `${100 + i} Street ${i + 1}, City`,
      'Category': categories[i % categories.length],
      'Religion': religions[i % religions.length]
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
  const usedAdmissionNumbers = new Set();
  let admissionNumber = 2001;
  let rollNumber = 1;
  
  // Calculate students per class (1500 students / 30 classes = 50 students per class)
  const totalClasses = gradeLevels.reduce((sum, gl) => sum + gl.sections.length, 0);
  const studentsPerClass = Math.floor(1500 / totalClasses);
  const extraStudents = 1500 % totalClasses;
  
  let classIndex = 0;
  const allowedClassesReference = 'Playschool, Pre-Nursery, Nursery, LKG, UKG, 1-12';
  
  gradeLevels.forEach((gradeLevel) => {
    gradeLevel.sections.forEach((section) => {
      let classStudents = studentsPerClass;
      if (classIndex < extraStudents) classStudents++;
      
      for (let s = 0; s < classStudents; s++) {
        let fullName;
        let firstName, lastName;
        let attempts = 0;
        let admNo;
        
        do {
          firstName = studentFirstNames[admissionNumber % studentFirstNames.length];
          lastName = studentLastNames[Math.floor(admissionNumber / studentFirstNames.length) % studentLastNames.length];
          fullName = `${firstName} ${lastName}`;
          admNo = `STU${String(admissionNumber).padStart(4, '0')}`;
          attempts++;
          
          if (attempts > 1) {
            lastName = studentLastNames[(Math.floor(admissionNumber / studentFirstNames.length) + attempts) % studentLastNames.length];
            fullName = `${firstName} ${lastName}`;
            admNo = `STU${String(admissionNumber + attempts).padStart(4, '0')}`;
          }
        } while ((usedStudentNames.has(fullName) || usedAdmissionNumbers.has(admNo)) && attempts < 100);
        
        usedStudentNames.add(fullName);
        usedAdmissionNumbers.add(admNo);
        
        const contactNumber = `97${String(admissionNumber).padStart(8, '0')}`;
        const emergencyContact = `96${String(admissionNumber).padStart(8, '0')}`;
        const birthYear = 2024 - (parseInt(gradeLevel.grade) || 5);
        
        studentsData.push({
          'First Name*': firstName,
          'Last Name*': lastName,
          'Admission Number*': admNo,
          'Grade*': gradeLevel.grade,
          'Section': section,
          'Roll Number': String(rollNumber++),
          'Email': admissionNumber > 2500 ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@student.com` : '',
          'Contact Number': contactNumber,
          'Date of Birth': `${birthYear}-${String((s % 12) + 1).padStart(2, '0')}-${String((s % 28) + 1).padStart(2, '0')}`,
          'Gender': s % 2 === 0 ? 'male' : 'female',
          'Blood Group': bloodGroups[s % bloodGroups.length],
          'Address': `${200 + admissionNumber} Avenue ${s + 1}, City`,
          'Emergency Contact': emergencyContact,
          '': '',
          '📋 Allowed Classes (Reference Only)': allowedClassesReference
        });
        
        admissionNumber++;
      }
      rollNumber = 1; // Reset roll number for each class
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
          'Teacher School ID*': teacher['School ID*'],
          'Grade*': gradeLevel.grade,
          'Section': section,
          'Subject Code*': subject.code,
          'Subject Name*': subject.name,
          'Weekly Frequency*': weeklyFrequency,
          '': '',
          '📋 Allowed Classes (Reference Only)': allowedClassesReference
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
const data = generateComprehensiveSample();

const workbook = XLSX.utils.book_new();

// Add Instructions sheet first
const instructions = [
  ['SMART UPLOAD - COMPREHENSIVE SAMPLE DATA'],
  [''],
  ['📋 DATA SUMMARY:'],
  [`- Teachers: ${data.teachers.length} unique teachers (all fields populated)`],
  [`- Students: ${data.students.length} unique students (distributed evenly)`],
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
  ['- Max Periods/Day: Optional for teachers (defaults to 6 if not provided)'],
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
  ['FIELD REQUIREMENTS:'],
  ['Teachers: Name*, Mobile Number*, School ID* are mandatory'],
  ['Students: First Name*, Last Name*, Admission Number*, Grade* are mandatory (Section is optional)'],
  ['Assignments: Teacher School ID*, Grade*, Subject Code*, Subject Name*, Weekly Frequency* are mandatory'],
  [''],
  ['EXAMPLES:'],
  ['- Kindergarten: Grade="Nursery", Section="A"'],
  ['- Primary: Grade="3", Section="B"'],
  ['- Secondary: Grade="10", Section="A"'],
  ['- Assignment: Teacher="T001", Grade="5", Section="A", Subject="PRIM-ENG", Frequency=7'],
];
const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
instructionsSheet['!cols'] = [{ wch: 85 }];
XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

// Add Teachers sheet
const teachersSheet = XLSX.utils.json_to_sheet(data.teachers);
teachersSheet['!cols'] = [
  { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 12 },
  { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, 
  { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 12 }
];
XLSX.utils.book_append_sheet(workbook, teachersSheet, 'Teachers');

// Add Students sheet with reference column styling
const studentsSheet = XLSX.utils.json_to_sheet(data.students);
studentsSheet['!cols'] = [
  { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 10 },
  { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
  { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 3 }, { wch: 28 }
];

// Apply light background color to reference column
const studentRange = XLSX.utils.decode_range(studentsSheet['!ref'] || 'A1');
for (let row = studentRange.s.r; row <= studentRange.e.r; row++) {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: 14 });
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

// Add Assignments sheet with reference column styling
const assignmentsSheet = XLSX.utils.json_to_sheet(data.assignments);
assignmentsSheet['!cols'] = [
  { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 18 }, { wch: 3 }, { wch: 28 }
];

// Apply light background color to reference column
const assignmentRange = XLSX.utils.decode_range(assignmentsSheet['!ref'] || 'A1');
for (let row = assignmentRange.s.r; row <= assignmentRange.e.r; row++) {
  const cellAddress = XLSX.utils.encode_cell({ r: row, c: 7 });
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

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'attached_assets');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write file
const outputPath = path.join(outputDir, 'Smart_Upload_Testing_Sample.xlsx');
XLSX.writeFile(workbook, outputPath, { cellStyles: true });

console.log(`✅ Excel file generated successfully!`);
console.log(`📁 Location: ${outputPath}`);
console.log(`\n📊 Summary:`);
console.log(`   - Teachers: ${data.teachers.length} (all unique with complete details)`);
console.log(`   - Students: ${data.students.length} (all unique)`);
console.log(`   - Assignments: ${data.assignments.length}`);
console.log(`   - Total Classes: ${data.totalClasses}`);
console.log(`\n📝 Structure:`);
console.log(`   - Grades: Nursery, LKG, UKG, 1-12`);
console.log(`   - Sections per grade: 2 (A, B)`);
console.log(`   - Students per class: 50`);
console.log(`   - Subjects per class: 5`);
console.log(`\n✨ Matches Smart Upload template format exactly!`);
console.log(`   - Reference columns with light blue background (E8F4F8)`);
console.log(`   - Proper column widths and formatting`);
console.log(`   - All mandatory fields marked with *`);
console.log(`\n🚀 Ready to test Smart Upload feature!`);
