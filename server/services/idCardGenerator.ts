import path from 'path';
import fs from 'fs';
import { createCanvas, loadImage } from '@napi-rs/canvas';

interface StudentCardData {
  name: string;
  admissionNumber: string;
  class: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  contactNumber?: string;
  address?: string;
  photoUrl?: string;
}

interface TeacherCardData {
  name: string;
  employeeId: string;
  designation?: string;
  bloodGroup?: string;
  contactNumber?: string;
  address?: string;
  photoUrl?: string;
}

// Ensure the generated ID cards directory exists
const generatedDir = path.join(process.cwd(), 'public', 'generated-id-cards');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

export async function generateStudentIDCard(
  templateUrl: string,
  studentData: StudentCardData,
  personId: string
): Promise<string> {
  try {
    console.log('Generating student ID card for:', studentData.name);
    
    // Load the template image
    const templatePath = path.join(process.cwd(), 'public', templateUrl);
    const templateImage = await loadImage(templatePath);
    
    // Create canvas with same dimensions as template
    const canvas = createCanvas(templateImage.width, templateImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the template
    ctx.drawImage(templateImage, 0, 0);
    
    // Set text properties
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    // Calculate positions based on template size (adjust these based on your template)
    const leftMargin = templateImage.width * 0.4; // Start after the photo area
    const nameY = templateImage.height * 0.58; // Below NAME label
    const idY = templateImage.height * 0.68; // Below ID label  
    const addressY = templateImage.height * 0.78; // Below ADDRESS label
    const expireDateY = templateImage.height * 0.93; // Below EXPIRE DATE label
    
    // Draw student name (BELOW "NAME" label)
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(studentData.name, leftMargin, nameY);
    
    // Draw admission number (BELOW "ID" label)
    ctx.font = '28px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(studentData.admissionNumber, leftMargin, idY);
    
    // Draw address (BELOW "ADDRESS" label)
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333333';
    if (studentData.address) {
      // Wrap address if too long
      const maxWidth = templateImage.width * 0.55;
      const words = studentData.address.split(' ');
      let line = '';
      let lineY = addressY;
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line.length > 0) {
          ctx.fillText(line.trim(), leftMargin, lineY);
          line = word + ' ';
          lineY += 24;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), leftMargin, lineY);
    }
    
    // Draw expiry date (typically 1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiryDateStr = expiryDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(expiryDateStr, leftMargin, expireDateY);
    
    // Add student photo if available (circular photo on the left side)
    if (studentData.photoUrl) {
      try {
        const photoPath = studentData.photoUrl.startsWith('http') 
          ? studentData.photoUrl 
          : path.join(process.cwd(), 'public', studentData.photoUrl);
        
        const photo = await loadImage(photoPath);
        
        // Calculate circular photo position (adjust based on your template)
        const photoX = templateImage.width * 0.18; // Center of photo circle
        const photoY = templateImage.height * 0.55;
        const photoRadius = templateImage.width * 0.11; // Radius of the circle
        
        // Create circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Draw photo to fill the circle
        const photoSize = photoRadius * 2;
        ctx.drawImage(photo, photoX - photoRadius, photoY - photoRadius, photoSize, photoSize);
        
        ctx.restore();
      } catch (photoError) {
        console.error('Error loading student photo:', photoError);
        // Continue without photo
      }
    }
    
    // Save the generated ID card
    const outputFilename = `student_${personId}_${Date.now()}.png`;
    const outputPath = path.join(generatedDir, outputFilename);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ Student ID card generated:', outputFilename);
    
    // Return the public URL
    return `/generated-id-cards/${outputFilename}`;
  } catch (error) {
    console.error('Error generating student ID card:', error);
    throw error;
  }
}

export async function generateTeacherIDCard(
  templateUrl: string,
  teacherData: TeacherCardData,
  personId: string
): Promise<string> {
  try {
    console.log('Generating teacher ID card for:', teacherData.name);
    
    // Load the template image
    const templatePath = path.join(process.cwd(), 'public', templateUrl);
    const templateImage = await loadImage(templatePath);
    
    // Create canvas with same dimensions as template
    const canvas = createCanvas(templateImage.width, templateImage.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the template
    ctx.drawImage(templateImage, 0, 0);
    
    // Set text properties
    ctx.font = 'bold 32px Arial';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    // Calculate positions (same as student card for consistency)
    const leftMargin = templateImage.width * 0.4;
    const nameY = templateImage.height * 0.58;
    const idY = templateImage.height * 0.68;
    const addressY = templateImage.height * 0.78;
    const expireDateY = templateImage.height * 0.93;
    
    // Draw teacher name
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(teacherData.name, leftMargin, nameY);
    
    // Draw employee ID
    ctx.font = '28px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(teacherData.employeeId, leftMargin, idY);
    
    // Draw address
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333333';
    if (teacherData.address) {
      const maxWidth = templateImage.width * 0.55;
      const words = teacherData.address.split(' ');
      let line = '';
      let lineY = addressY;
      
      for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line.length > 0) {
          ctx.fillText(line.trim(), leftMargin, lineY);
          line = word + ' ';
          lineY += 24;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line.trim(), leftMargin, lineY);
    }
    
    // Draw expiry date
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    const expiryDateStr = expiryDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333333';
    ctx.fillText(expiryDateStr, leftMargin, expireDateY);
    
    // Add teacher photo if available
    if (teacherData.photoUrl) {
      try {
        const photoPath = teacherData.photoUrl.startsWith('http') 
          ? teacherData.photoUrl 
          : path.join(process.cwd(), 'public', teacherData.photoUrl);
        
        const photo = await loadImage(photoPath);
        
        const photoX = templateImage.width * 0.18;
        const photoY = templateImage.height * 0.55;
        const photoRadius = templateImage.width * 0.11;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX, photoY, photoRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        const photoSize = photoRadius * 2;
        ctx.drawImage(photo, photoX - photoRadius, photoY - photoRadius, photoSize, photoSize);
        
        ctx.restore();
      } catch (photoError) {
        console.error('Error loading teacher photo:', photoError);
      }
    }
    
    // Save the generated ID card
    const outputFilename = `teacher_${personId}_${Date.now()}.png`;
    const outputPath = path.join(generatedDir, outputFilename);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ Teacher ID card generated:', outputFilename);
    
    // Return the public URL
    return `/generated-id-cards/${outputFilename}`;
  } catch (error) {
    console.error('Error generating teacher ID card:', error);
    throw error;
  }
}
