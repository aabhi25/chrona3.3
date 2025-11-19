import { storage } from "./storage";
import { hashPassword, hashTemporaryPassword, generateTemporaryPasswordExpiry } from "./auth";
import { getCurrentDateTimeIST } from "@shared/utils/dateUtils";

// Sample data generator for testing Student & Parent functionality
export async function generateSampleStudentsAndParents() {
  console.log("🌱 Starting sample data generation for Students & Parents...");

  try {
    // Get the first school (Wonder School)
    const schools = await storage.getSchools();
    const school = schools.find(s => s.name.includes("Wonder")) || schools[0];
    
    if (!school) {
      console.error("❌ No school found");
      return;
    }

    console.log(`📚 Using school: ${school.name} (ID: ${school.id})`);

    // Get all classes for assignment
    const classes = await storage.getClasses(school.id);
    
    // Find required classes for testing
    const class5A = classes.find(c => c.grade === "5" && c.section === "A");
    const class6B = classes.find(c => c.grade === "6" && c.section === "B");
    
    console.log(`📚 Available classes: ${classes.map(c => `Grade ${c.grade} Section ${c.section || 'N/A'}`).join(', ')}`);
    
    // Check if we have the required classes
    if (!class5A) {
      console.log("⚠️ Grade 5 Section A not found, will need to create it");
    }
    if (!class6B) {
      console.log("⚠️ Grade 6 Section B not found, will need to create it");
    }
    
    // Create missing classes if needed
    let actualClass5A = class5A;
    let actualClass6B = class6B;
    
    if (!actualClass5A) {
      console.log("🏗️ Creating Grade 5 Section A...");
      actualClass5A = await storage.createClass({
        grade: "5",
        section: "A",
        studentCount: 30,
        schoolId: school.id
      });
      console.log(`✅ Created Grade 5 Section A (ID: ${actualClass5A.id})`);
    }
    
    if (!actualClass6B) {
      console.log("🏗️ Creating Grade 6 Section B...");
      actualClass6B = await storage.createClass({
        grade: "6", 
        section: "B",
        studentCount: 25,
        schoolId: school.id
      });
      console.log(`✅ Created Grade 6 Section B (ID: ${actualClass6B.id})`);
    }

    // Sample students data - exactly as specified for testing
    const studentsData = [
      {
        firstName: "Riya",
        lastName: "Sharma",
        admissionNumber: "S001",
        email: "riya.sharma@example.com",
        contactNumber: "9876543210",
        dateOfBirth: "2013-03-12", // 12-03-2013
        gender: "female" as const,
        address: "123 MG Road, Bangalore",
        guardianName: "Anil Sharma",
        guardianRelation: "Father",
        guardianContact: "9876543200",
        emergencyContact: "9876543201",
        targetClass: { grade: "5", section: "A" }
      },
      {
        firstName: "Arjun",
        lastName: "Verma", 
        admissionNumber: "S002",
        email: "arjun.verma@example.com",
        contactNumber: "9876543211",
        dateOfBirth: "2013-08-20", // 20-08-2013
        gender: "male" as const,
        address: "456 Brigade Road, Bangalore",
        guardianName: "Sunita Verma",
        guardianRelation: "Mother",
        guardianContact: "9876543202",
        emergencyContact: "9876543203",
        targetClass: { grade: "5", section: "A" }
      },
      {
        firstName: "Meera",
        lastName: "Khan",
        admissionNumber: "S003", 
        email: "meera.khan@example.com",
        contactNumber: "9876543212",
        dateOfBirth: "2012-11-10", // 10-11-2012
        gender: "female" as const,
        address: "789 Koramangala, Bangalore",
        guardianName: "Imran Khan",
        guardianRelation: "Father",
        guardianContact: "9876543204",
        emergencyContact: "9876543205",
        targetClass: { grade: "6", section: "B" }
      }
    ];

    // Sample parents data - exactly as specified for testing
    const parentsData = [
      {
        firstName: "Anil",
        lastName: "Sharma",
        email: "anil.sharma@gmail.com",
        contactNumber: "9876543200",
        relationToStudent: "father" as const,
        occupation: "Software Engineer",
        address: "123 MG Road, Bangalore",
        studentAdmissionNumber: "S001"
      },
      {
        firstName: "Sunita",
        lastName: "Verma",
        email: "sunita.verma@gmail.com",
        contactNumber: "9876543202",
        relationToStudent: "mother" as const,
        occupation: "Teacher",
        address: "456 Brigade Road, Bangalore",
        studentAdmissionNumber: "S002"
      },
      {
        firstName: "Imran",
        lastName: "Khan",
        email: "imran.khan@gmail.com", 
        contactNumber: "9876543204",
        relationToStudent: "father" as const,
        occupation: "Business Owner",
        address: "789 Koramangala, Bangalore",
        studentAdmissionNumber: "S003"
      }
    ];

    const createdStudents = [];
    const createdParents = [];

    // Create students
    console.log("👨‍🎓 Creating students...");
    for (const studentData of studentsData) {
      try {
        // Get the correct class for this student
        let targetClassId;
        if (studentData.targetClass.grade === "5" && studentData.targetClass.section === "A") {
          targetClassId = actualClass5A.id;
        } else if (studentData.targetClass.grade === "6" && studentData.targetClass.section === "B") {
          targetClassId = actualClass6B.id;
        } else {
          throw new Error(`No class found for Grade ${studentData.targetClass.grade} Section ${studentData.targetClass.section}`);
        }

        // Remove targetClass from student data before creating
        const { targetClass, ...studentCreateData } = studentData;
        
        const student = await storage.createStudent({
          ...studentCreateData,
          classId: targetClassId,
          schoolId: school.id,
          status: "active",
          isActive: true
        });
        
        console.log(`✅ Created student: ${student.firstName} ${student.lastName} (${student.admissionNumber})`);
        createdStudents.push(student);

        // Generate temporary password and create user account for student
        const tempPassword = generateTempPassword();
        const hashedTempPassword = await hashTemporaryPassword(tempPassword);
        const tempPasswordExpiry = generateTemporaryPasswordExpiry(72); // 72 hours

        const studentUser = await storage.createUser({
          email: student.email,
          loginId: student.admissionNumber, // Students login with admission number
          passwordHash: "", // No regular password initially
          temporaryPassword: hashedTempPassword,
          temporaryPasswordExpiresAt: tempPasswordExpiry,
          role: "student",
          isFirstLogin: true,
          schoolId: school.id,
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          isActive: true,
          createdAt: getCurrentDateTimeIST()
        });

        console.log(`🔑 Created student login: ${student.admissionNumber} / ${tempPassword}`);
        
      } catch (error) {
        console.error(`❌ Error creating student ${studentData.firstName}:`, error);
      }
    }

    // Create parents and link them to students
    console.log("👪 Creating parents...");
    for (const parentData of parentsData) {
      try {
        const parent = await storage.createParent({
          firstName: parentData.firstName,
          lastName: parentData.lastName,
          email: parentData.email,
          contactNumber: parentData.contactNumber,
          relationToStudent: parentData.relationToStudent,
          occupation: parentData.occupation,
          address: parentData.address,
          schoolId: school.id,
          isActive: true
        });

        console.log(`✅ Created parent: ${parent.firstName} ${parent.lastName} (${parent.email})`);
        createdParents.push(parent);

        // Find and link to student
        const student = createdStudents.find(s => s.admissionNumber === parentData.studentAdmissionNumber);
        if (student) {
          await storage.linkParentToStudent(parent.id, student.id);
          console.log(`🔗 Linked parent ${parent.firstName} to student ${student.firstName}`);
        }

        // Generate temporary password and create user account for parent
        const tempPassword = generateTempPassword();
        const hashedTempPassword = await hashTemporaryPassword(tempPassword);
        const tempPasswordExpiry = generateTemporaryPasswordExpiry(72); // 72 hours

        const parentUser = await storage.createUser({
          email: parent.email,
          loginId: parent.email, // Parents login with email
          passwordHash: "", // No regular password initially
          temporaryPassword: hashedTempPassword,
          temporaryPasswordExpiresAt: tempPasswordExpiry,
          role: "parent",
          isFirstLogin: true,
          schoolId: school.id,
          parentId: parent.id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          isActive: true,
          createdAt: getCurrentDateTimeIST()
        });

        console.log(`🔑 Created parent login: ${parent.email} / ${tempPassword}`);

      } catch (error) {
        console.error(`❌ Error creating parent ${parentData.firstName}:`, error);
      }
    }

    console.log("🎉 Sample data generation completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`✅ Created ${createdStudents.length} students`);
    console.log(`✅ Created ${createdParents.length} parents`);
    console.log(`✅ Generated login credentials with temporary passwords`);
    
    console.log("\n🔐 Test Login Credentials:");
    console.log("STUDENTS (Login with Admission Number):");
    studentsData.forEach((student, index) => {
      console.log(`  ${student.admissionNumber} - Use temporary password shown above`);
    });
    
    console.log("\nPARENTS (Login with Email):");
    parentsData.forEach((parent, index) => {
      console.log(`  ${parent.email} - Use temporary password shown above`);
    });

    return {
      students: createdStudents,
      parents: createdParents,
      school: school,
      classes: {
        class5A: actualClass5A,
        class6B: actualClass6B
      }
    };

  } catch (error) {
    console.error("❌ Error generating sample data:", error);
    throw error;
  }
}

// Generate a simple temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Exclude confusing chars
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Export for use in other scripts
export { generateTempPassword };