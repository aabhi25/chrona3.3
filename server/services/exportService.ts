import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentDateIST, getCurrentDateTimeIST } from '@shared/utils/dateUtils';

export interface ExportOptions {
  schoolId?: string;
  format: 'json' | 'csv' | 'both';
  privacyLevel: 'safe' | 'full';
  tables?: string[];
  requestedBy: string;
  userRole: string;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filePath?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata: {
    schoolId?: string;
    format: string;
    privacyLevel: string;
    requestedBy: string;
    userRole: string;
    totalTables: number;
    processedTables: number;
  };
}

class ExportService {
  private jobs = new Map<string, ExportJob>();
  private readonly EXPORT_DIR = '/tmp/exports';
  private readonly MAX_CHUNK_SIZE = 5000;
  
  // Sensitive fields to redact in 'safe' privacy level
  private readonly SENSITIVE_FIELDS = {
    users: ['passwordHash', 'temporaryPassword', 'temporaryPasswordPlainText', 'email', 'loginId'],
    students: ['medicalInfo', 'guardianContact', 'email'],
    teachers: ['personalContact', 'emergencyContact', 'email'],
    parents: ['email', 'contactNumber', 'address']
  };

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }
    
    // Cleanup old exports every hour
    setInterval(() => this.cleanupOldExports(), 60 * 60 * 1000);
  }

  /**
   * Start a new export job
   */
  async startExport(options: ExportOptions): Promise<string> {
    const jobId = uuidv4();
    const availableTables = this.getAvailableTables(options.userRole, options.schoolId);
    const tablesToExport = options.tables || availableTables;
    
    // Validate table access permissions
    const unauthorizedTables = tablesToExport.filter(table => !availableTables.includes(table));
    if (unauthorizedTables.length > 0) {
      throw new Error(`Access denied to tables: ${unauthorizedTables.join(', ')}`);
    }

    const job: ExportJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: getCurrentDateTimeIST(),
      metadata: {
        schoolId: options.schoolId,
        format: options.format,
        privacyLevel: options.privacyLevel,
        requestedBy: options.requestedBy,
        userRole: options.userRole,
        totalTables: tablesToExport.length,
        processedTables: 0
      }
    };

    this.jobs.set(jobId, job);

    // Start the export process asynchronously
    this.processExport(jobId, options, tablesToExport).catch(error => {
      console.error('Export failed:', error);
      const failedJob = this.jobs.get(jobId);
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = error.message;
      }
    });

    return jobId;
  }

  /**
   * Get export job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get available tables based on user role (strict allowlist to prevent unauthorized access)
   */
  private getAvailableTables(userRole: string, schoolId?: string): string[] {
    if (userRole === 'super_admin') {
      return [
        'schools', 'users', 'students', 'teachers', 'parents', 'studentParents',
        'classes', 'subjects', 'timetableEntries', 'timetableStructure',
        'teacherAttendance', 'studentAttendance',
        'classSubjectAssignments', 'classTeacherAssignments', 
        'teacherReplacements', 'timetableChanges', 'auditLogs'
      ];
    } else if (userRole === 'admin' && schoolId) {
      return [
        'students', 'teachers', 'parents', 'studentParents',
        'classes', 'subjects', 'timetableEntries', 'timetableStructure',
        'teacherAttendance', 'studentAttendance',
        'classSubjectAssignments', 'classTeacherAssignments', 
        'teacherReplacements', 'timetableChanges'
      ];
    } else if (userRole === 'teacher' && schoolId) {
      return [
        'students', 'classes', 'subjects', 'timetableEntries', 'timetableStructure',
        'teacherAttendance', 'studentAttendance'
      ];
    }
    
    return []; // Default deny
  }

  /**
   * Process the export job
   */
  private async processExport(jobId: string, options: ExportOptions, tables: string[]): Promise<void> {
    const job = this.jobs.get(jobId)!;
    job.status = 'processing';

    const exportPath = path.join(this.EXPORT_DIR, `export_${jobId}`);
    fs.mkdirSync(exportPath, { recursive: true });

    const manifest = {
      exportId: jobId,
      exportedAt: getCurrentDateTimeIST().toISOString(),
      schoolId: options.schoolId || 'all',
      format: options.format,
      privacyLevel: options.privacyLevel,
      requestedBy: options.requestedBy,
      userRole: options.userRole,
      tables: {} as Record<string, { count: number; format: string[] }>
    };

    try {
      // Export schema
      await this.exportSchema(exportPath);
      
      // Export each table
      for (let i = 0; i < tables.length; i++) {
        const tableName = tables[i];
        console.log(`Exporting table: ${tableName}`);
        
        const tableInfo = await this.exportTable(tableName, exportPath, options);
        manifest.tables[tableName] = tableInfo;
        
        // Update progress
        job.metadata.processedTables = i + 1;
        job.progress = Math.round((i + 1) / tables.length * 100);
      }

      // Write manifest
      fs.writeFileSync(
        path.join(exportPath, 'manifest.json'), 
        JSON.stringify(manifest, null, 2)
      );

      // Create ZIP archive
      const zipPath = await this.createZipArchive(exportPath, jobId);
      
      job.status = 'completed';
      job.filePath = zipPath;
      job.completedAt = getCurrentDateTimeIST();
      job.progress = 100;

      // Cleanup temporary directory
      fs.rmSync(exportPath, { recursive: true, force: true });

      console.log(`Export ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`Export ${jobId} failed:`, error);
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Cleanup on failure
      if (fs.existsSync(exportPath)) {
        fs.rmSync(exportPath, { recursive: true, force: true });
      }
    }
  }

  /**
   * Export database schema
   */
  private async exportSchema(exportPath: string): Promise<void> {
    const schemaContent = fs.readFileSync(path.join(process.cwd(), 'shared/schema.ts'), 'utf8');
    fs.writeFileSync(path.join(exportPath, 'schema.ts'), schemaContent);
  }

  /**
   * Export a single table using storage interface (CRITICAL: prevents data leakage)
   */
  private async exportTable(tableName: string, exportPath: string, options: ExportOptions): Promise<{ count: number; format: string[] }> {
    // Use storage interface instead of direct database access
    let data: any[] = [];
    
    try {
      // Map table names to storage methods with proper school filtering
      switch (tableName) {
        case 'schools':
          data = options.userRole === 'super_admin' ? await storage.getSchools() : [];
          break;
        case 'students':
          data = options.schoolId ? await storage.getStudents(options.schoolId) : [];
          break;
        case 'teachers':
          data = options.schoolId ? await storage.getTeachers(options.schoolId) : [];
          break;
        case 'classes':
          data = options.schoolId ? await storage.getClasses(options.schoolId) : [];
          break;
        case 'subjects':
          data = options.schoolId ? await storage.getSubjects(options.schoolId) : [];
          break;
        default:
          console.warn(`Table ${tableName} not supported for export - skipping for security`);
          data = [];
      }
    } catch (error) {
      console.error(`Error exporting table ${tableName}:`, error);
      data = [];
    }

    const cleanedData = this.cleanSensitiveData(data, tableName, options.privacyLevel);
    
    const formats: string[] = [];
    
    // Export as JSON
    if (options.format === 'json' || options.format === 'both') {
      const jsonPath = path.join(exportPath, `${tableName}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(cleanedData, null, 2));
      formats.push('json');
    }
    
    // Export as CSV
    if (options.format === 'csv' || options.format === 'both') {
      const csvPath = path.join(exportPath, `${tableName}.csv`);
      this.writeCSV(cleanedData, csvPath);
      formats.push('csv');
    }

    return {
      count: cleanedData.length,
      format: formats
    };
  }

  /**
   * Check if table is school-scoped (must be comprehensive to prevent data leakage)
   */
  private isSchoolScoped(tableName: string): boolean {
    const schoolScopedTables = [
      'users', 'students', 'teachers', 'parents', 'studentParents',
      'classes', 'subjects', 'timetableEntries', 'timetableStructure',
      'teacherAttendance', 'studentAttendance',
      'classSubjectAssignments', 'classTeacherAssignments', 
      'teacherReplacements', 'timetableChanges', 'auditLogs'
    ];
    return schoolScopedTables.includes(tableName);
  }

  /**
   * Clean sensitive data based on privacy level
   */
  private cleanSensitiveData(data: any[], tableName: string, privacyLevel: string): any[] {
    if (privacyLevel === 'full') {
      return data; // Return all data for super admin
    }

    const sensitiveFields = this.SENSITIVE_FIELDS[tableName as keyof typeof this.SENSITIVE_FIELDS] || [];
    
    return data.map(row => {
      const cleanedRow = { ...row };
      sensitiveFields.forEach(field => {
        if (field in cleanedRow) {
          cleanedRow[field] = '[REDACTED]';
        }
      });
      return cleanedRow;
    });
  }

  /**
   * Write data to CSV format
   */
  private writeCSV(data: any[], filePath: string): void {
    if (data.length === 0) {
      fs.writeFileSync(filePath, '');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle complex objects and arrays
          const stringValue = typeof value === 'object' && value !== null 
            ? JSON.stringify(value).replace(/"/g, '""')
            : String(value || '').replace(/"/g, '""');
          return `"${stringValue}"`;
        }).join(',')
      )
    ].join('\n');

    fs.writeFileSync(filePath, csvContent);
  }

  /**
   * Create ZIP archive
   */
  private async createZipArchive(sourcePath: string, jobId: string): Promise<string> {
    const zipPath = path.join(this.EXPORT_DIR, `school_export_${jobId}.zip`);
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  /**
   * Cleanup old export files
   */
  private cleanupOldExports(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of Array.from(this.jobs.entries())) {
      if (job.createdAt.getTime() < cutoffTime) {
        // Remove file if it exists
        if (job.filePath && fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
        }
        
        // Remove job from memory
        this.jobs.delete(jobId);
      }
    }
  }

  /**
   * Log audit event for compliance
   */
  private async logAuditEvent(options: ExportOptions, action: string, details: any): Promise<void> {
    try {
      await storage.createAuditLog({
        userId: options.requestedBy,
        schoolId: options.schoolId || 'all',
        action: `database_${action}`,
        details: JSON.stringify({
          format: options.format,
          privacyLevel: options.privacyLevel,
          userRole: options.userRole,
          ...details
        }),
        ipAddress: '127.0.0.1', // Server-side export
        userAgent: 'Export Service'
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Get export file for download
   */
  getExportFile(jobId: string): string | null {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'completed' && job.filePath && fs.existsSync(job.filePath)) {
      return job.filePath;
    }
    return null;
  }
}

export const exportService = new ExportService();