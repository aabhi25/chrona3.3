import express from 'express';
import { z } from 'zod';
import { excelService } from '../services/excelService';
import { getCurrentDateIST } from '@shared/utils/dateUtils';

const router = express.Router();

// Request validation schema
const downloadExcelSchema = z.object({
  type: z.enum(['students', 'teachers']),
  fields: z.array(z.string()).min(1, 'At least one field must be selected')
});

// Define role-based field allowlists for security
const FIELD_PERMISSIONS = {
  students: {
    teacher: ['admissionNumber', 'firstName', 'lastName', 'rollNumber', 'className', 'status'], // Basic info only
    admin: ['admissionNumber', 'firstName', 'lastName', 'rollNumber', 'className', 'email', 'contactNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'address', 'guardianName', 'guardianRelation', 'guardianContact', 'emergencyContact', 'medicalInfo', 'status'], // All fields
    super_admin: ['admissionNumber', 'firstName', 'lastName', 'rollNumber', 'className', 'email', 'contactNumber', 'dateOfBirth', 'gender', 'bloodGroup', 'address', 'guardianName', 'guardianRelation', 'guardianContact', 'emergencyContact', 'medicalInfo', 'status'] // All fields
  },
  teachers: {
    admin: ['employeeId', 'name', 'email', 'contactNumber', 'schoolIdNumber', 'subjects', 'classes', 'maxDailyPeriods', 'availability', 'status'], // All fields
    super_admin: ['employeeId', 'name', 'email', 'contactNumber', 'schoolIdNumber', 'subjects', 'classes', 'maxDailyPeriods', 'availability', 'status'] // All fields
  }
};

/**
 * POST /api/download-excel
 * Generate and download Excel file with selected fields
 */
router.post('/download-excel', async (req, res) => {
  try {
    // Validate request body
    const validatedData = downloadExcelSchema.parse(req.body);
    
    // Get user info from authenticated request
    const user = (req as any).user;
    if (!user || !user.schoolId) {
      return res.status(401).json({ 
        error: 'You must be logged in to a school to download data.' 
      });
    }
    
    const { type, fields } = validatedData;
    const { schoolId, role } = user;
    
    // Check type-level permissions
    if (type === 'teachers' && role !== 'admin' && role !== 'super_admin') {
      return res.status(403).json({
        error: 'Only administrators can download teacher data.'
      });
    }
    
    if (type === 'students' && role !== 'admin' && role !== 'super_admin' && role !== 'teacher') {
      return res.status(403).json({
        error: 'You do not have permission to download student data.'
      });
    }

    // Check field-level permissions
    const allowedFields = FIELD_PERMISSIONS[type]?.[role as keyof typeof FIELD_PERMISSIONS[typeof type]] || [];
    const unauthorizedFields = fields.filter(field => !allowedFields.includes(field));
    
    if (unauthorizedFields.length > 0) {
      return res.status(403).json({
        error: `Access denied to fields: ${unauthorizedFields.join(', ')}. Your role (${role}) does not have permission to export these fields.`
      });
    }
    
    console.log(`[EXCEL DOWNLOAD] User ${user.id} (${role}) downloading ${type} data with fields:`, fields);
    
    // Generate Excel file
    const excelBuffer = await excelService.generateExcel({ type, fields }, schoolId);
    
    // Set response headers for Excel download
    const filename = `${type}_${getCurrentDateIST()}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length.toString());
    
    // Send the Excel file
    res.send(excelBuffer);
    
    console.log(`[EXCEL DOWNLOAD] Successfully generated ${filename} (${excelBuffer.length} bytes)`);
    
  } catch (error) {
    console.error('[EXCEL DOWNLOAD] Error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate Excel file. Please try again.'
    });
  }
});

export default router;