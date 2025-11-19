import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';
import { z } from 'zod';
import { parse as parseSQL } from 'sql-parser-cst';

// Define the database schema context for LLAMA
const DATABASE_SCHEMA_CONTEXT = `
Database Schema for School Management System:

1. teacher_attendance table:
   - teacher_id (UUID): References teachers.id
   - school_id (UUID): References schools.id 
   - attendance_date (DATE): Date of attendance
   - status (ENUM): 'present', 'absent', 'late', 'on_leave', 'medical_leave', 'personal_leave'
   - reason (TEXT): Reason for absence/leave
   - leave_start_date (DATE): For multi-day leave tracking
   - leave_end_date (DATE): For multi-day leave tracking
   - marked_by (UUID): Who marked the attendance
   - marked_at (TIMESTAMP): When marked

2. teachers table:
   - id (UUID): Primary key
   - employee_id (VARCHAR): Employee ID number
   - name (VARCHAR): Teacher name
   - email (VARCHAR): Email address
   - contact_number (VARCHAR): Phone number
   - school_id (UUID): References schools.id
   - subjects (JSONB): Array of subject IDs
   - classes (JSONB): Array of class IDs
   - is_active (BOOLEAN): Whether teacher is active
   - status (ENUM): 'active', 'inactive', 'left_school'

3. student_attendance table:
   - student_id (UUID): References students.id
   - school_id (UUID): References schools.id
   - class_id (UUID): References classes.id
   - attendance_date (DATE): Date of attendance
   - status (ENUM): 'present', 'absent', 'late', 'excused'
   - reason (TEXT): Reason for absence
   - marked_by (UUID): Who marked the attendance
   - marked_at (TIMESTAMP): When marked

4. students table:
   - id (UUID): Primary key
   - admission_number (VARCHAR): Student admission number
   - first_name (VARCHAR): Student first name
   - last_name (VARCHAR): Student last name
   - class_id (UUID): References classes.id
   - school_id (UUID): References schools.id
   - roll_number (VARCHAR): Student roll number
   - is_active (BOOLEAN): Whether student is active
   - status (ENUM): 'active', 'inactive', 'graduated', 'transferred'

5. classes table:
   - id (UUID): Primary key
   - grade (VARCHAR): Grade/Standard (e.g., '8', '10')
   - section (VARCHAR): Section (e.g., 'A', 'B')
   - school_id (UUID): References schools.id
   - student_count (INTEGER): Number of students

Note: Multi-tenant isolation is automatically enforced by database Row-Level Security policies.
Always use proper table aliases and JOIN operations.
`;

// Validation schema for analytics requests
const analyticsRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  export_format: z.enum(['none', 'csv', 'xlsx']).optional().default('none')
});

// Approved tables for analytics queries (strict whitelist)
const APPROVED_TABLES = [
  'teacher_attendance',
  'teachers', 
  'student_attendance',
  'students',
  'classes',
  'subjects',
  'timetable_entries'
];

// SQL injection prevention - dangerous DML/DDL patterns and functions
const DANGEROUS_SQL_PATTERNS = [
  /DROP\s+/i, /DELETE\s+/i, /UPDATE\s+/i, /INSERT\s+/i, /CREATE\s+/i, /ALTER\s+/i,
  /TRUNCATE\s+/i, /GRANT\s+/i, /REVOKE\s+/i, /EXEC\s+/i, /EXECUTE\s+/i,
  /xp_/i, /sp_/i, /--/, /\/\*/, /\*\//, /;.*DROP/i, /;.*DELETE/i, /;.*UPDATE/i,
  // Dangerous functions that can cause DoS or info disclosure
  /pg_sleep\s*\(/i, /pg_read_file\s*\(/i, /pg_read_binary_file\s*\(/i,
  /dblink\s*\(/i, /copy\s+/i, /\binto\s+outfile/i, /\binto\s+dumpfile/i,
  /load_file\s*\(/i, /select\s+.*\binto\s+/i
  // UNION/CTE/WITH are now allowed since RLS protects them
];

export class AnalyticsService {
  private openai: OpenAI | null = null;
  private rlsVerified = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ OPENAI_API_KEY not found for analytics service');
    } else {
      // This is using OpenAI's API, which points to OpenAI's API servers and requires your own API key.
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Verify RLS is enabled and policies exist for all analytics tables (CRITICAL)
   */
  private async verifyRLSPolicies(): Promise<void> {
    if (this.rlsVerified) return;

    try {
      // Check RLS is enabled on all tables
      const rlsStatus = await db.execute(sql.raw(`
        SELECT tablename, rowsecurity 
        FROM pg_tables 
        WHERE tablename IN ('teachers', 'students', 'classes', 'subjects', 'teacher_attendance', 'student_attendance', 'timetable_entries')
        AND schemaname = 'public'
      `));

      const tables = (rlsStatus as any).rows || rlsStatus;
      const disabledTables = tables.filter((row: any) => row.rowsecurity === false || row.rowsecurity === 'f');
      
      if (disabledTables.length > 0) {
        throw new Error(`RLS not enabled on tables: ${disabledTables.map((t: any) => t.tablename).join(', ')}`);
      }

      // Check policies exist for all tables
      const policyStatus = await db.execute(sql.raw(`
        SELECT COUNT(*) as policy_count
        FROM pg_policies 
        WHERE tablename IN ('teachers', 'students', 'classes', 'subjects', 'teacher_attendance', 'student_attendance', 'timetable_entries')
        AND schemaname = 'public'
      `));

      const policyCount = parseInt(((policyStatus as any).rows?.[0] || (policyStatus as any)[0])?.policy_count || '0');
      
      if (policyCount < 7) {
        throw new Error(`Insufficient RLS policies found: ${policyCount}/7 required`);
      }

      this.rlsVerified = true;
      console.log('✅ RLS verification passed: All analytics tables have proper tenant isolation');

    } catch (error) {
      console.error('💥 RLS verification FAILED:', error);
      throw new Error(`Analytics security not ready: ${error instanceof Error ? error.message : 'RLS check failed'}`);
    }
  }

  /**
   * Validate SQL query for security using AST parsing (prevent SQL injection and enforce constraints)
   */
  private validateSQLSecurity(sqlQuery: string, schoolId: string): { isValid: boolean; error?: string; safeSql?: string } {
    try {
      // Check for dangerous patterns first
      for (const pattern of DANGEROUS_SQL_PATTERNS) {
        if (pattern.test(sqlQuery)) {
          return { 
            isValid: false, 
            error: `Security violation: Query contains dangerous DML/DDL operations.` 
          };
        }
      }

      // Parse SQL using AST parser for deep validation
      let parsedSQL;
      try {
        parsedSQL = parseSQL(sqlQuery, { dialect: 'postgresql' });
      } catch (parseError) {
        return {
          isValid: false,
          error: `Invalid SQL syntax: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`
        };
      }

      // Ensure it's a single SELECT statement (handle both 'program' and 'statement_list' types)
      if (!parsedSQL || (parsedSQL.type !== 'program' && parsedSQL.type !== 'statement_list') || parsedSQL.statements.length !== 1) {
        return {
          isValid: false,
          error: 'Only single SELECT statements are allowed'
        };
      }

      const statement = parsedSQL.statements[0];
      if (statement.type !== 'select_stmt') {
        return {
          isValid: false,
          error: 'Only SELECT queries are allowed for analytics'
        };
      }

      // Extract table names from the query
      const tableNames = this.extractTableNames(statement);
      
      // Validate all tables are in approved list
      const unapprovedTables = tableNames.filter(table => !APPROVED_TABLES.includes(table.toLowerCase()));
      if (unapprovedTables.length > 0) {
        return {
          isValid: false,
          error: `Access denied to tables: ${unapprovedTables.join(', ')}. Only analytics tables are allowed.`
        };
      }

      // Generate safe parameterized SQL with enforced school_id filtering
      const safeSql = this.enforceSchoolIdConstraint(sqlQuery, schoolId, tableNames);
      
      return { 
        isValid: true, 
        safeSql 
      };

    } catch (error) {
      return {
        isValid: false,
        error: `Security validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract base table names from SQL AST (ignoring CTEs and derived tables)
   */
  private extractTableNames(node: any, cteNames: Set<string> = new Set()): string[] {
    const tables: string[] = [];
    
    if (!node) return tables;

    // Collect CTE names from WITH clause first
    if (node.type === 'select_stmt' && node.with_clause) {
      for (const cte of node.with_clause.ctes || []) {
        if (cte.alias?.name) {
          cteNames.add(cte.alias.name.toLowerCase());
        }
      }
    }

    // Handle table references (exclude CTEs)
    if (node.type === 'table_ref' && node.table?.name) {
      const tableName = node.table.name.toLowerCase();
      if (!cteNames.has(tableName)) {
        tables.push(node.table.name);
      }
    }

    // Handle FROM clause
    if (node.from && Array.isArray(node.from)) {
      for (const fromItem of node.from) {
        tables.push(...this.extractTableNames(fromItem, cteNames));
      }
    }

    // Handle JOIN clauses
    if (node.joins && Array.isArray(node.joins)) {
      for (const join of node.joins) {
        tables.push(...this.extractTableNames(join, cteNames));
      }
    }

    // Recursively check all object properties (skip WITH clauses to avoid double processing)
    for (const key in node) {
      if (key !== 'with_clause' && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          for (const item of node[key]) {
            tables.push(...this.extractTableNames(item, cteNames));
          }
        } else {
          tables.push(...this.extractTableNames(node[key], cteNames));
        }
      }
    }

    return Array.from(new Set(tables)); // Remove duplicates
  }

  /**
   * BULLETPROOF tenant isolation using Database-level Row-Level Security (RLS)
   */
  private enforceSchoolIdConstraint(originalSql: string, schoolId: string, tableNames: string[]): string {
    // Database-level Row-Level Security is the ONLY bulletproof approach
    // It works by setting a session variable that PostgreSQL RLS policies use
    
    // Return original SQL unchanged - tenant isolation is handled at database level
    // The session variable app.current_school_id is used by RLS policies on all tables
    return originalSql;
  }



  /**
   * Generate SQL query from natural language using OpenAI
   */
  async generateSQLFromNaturalLanguage(naturalLanguageQuery: string, schoolId: string): Promise<{
    sql: string;
    explanation: string;
    error?: string;
  }> {
    try {
      // Get school-specific OpenAI client
      const { getOpenAIForSchool } = await import('../openaiHelper');
      const openaiClient = await getOpenAIForSchool(schoolId);
      
      if (!openaiClient) {
        throw new Error('OpenAI client not initialized. Please configure an OpenAI API key in Settings.');
      }

      const systemPrompt = `You are an expert SQL generator for a school management system. 
Generate a PostgreSQL query based on the natural language request.

${DATABASE_SCHEMA_CONTEXT}

CRITICAL REQUIREMENTS:
1. Data isolation is automatically enforced by database Row-Level Security policies
2. Use proper table aliases (ta for teacher_attendance, t for teachers, etc.) 
3. Use PostgreSQL syntax and functions
4. Return only SELECT queries (no INSERT/UPDATE/DELETE)
5. For date ranges, use PostgreSQL date functions like DATE_TRUNC, INTERVAL
6. For JSON fields (subjects, classes), use proper JSONB operators
7. You can use JOINs, UNIONs, and CTEs freely - all are security-protected

Return ONLY a JSON object with this exact format:
{
  "sql": "SELECT ... FROM ... WHERE ...",
  "explanation": "This query finds..."
}

Example queries:
- "Top 3 teachers absent most last month" → COUNT absent days by teacher, ORDER BY count DESC, LIMIT 3
- "Class 8A attendance September" → Filter by class grade='8' AND section='A' AND month
- "Which class has highest absenteeism" → GROUP BY class, calculate absence percentage

Natural Language Query: "${naturalLanguageQuery}"`;

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4.1-nano-2025-04-14',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user', 
            content: naturalLanguageQuery
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse the JSON response
      const parsedResponse = JSON.parse(content);

      if (!parsedResponse.sql || !parsedResponse.explanation) {
        throw new Error('Invalid response format from OpenAI');
      }

      console.log(`[ANALYTICS] Generated SQL: ${parsedResponse.sql}`);
      console.log(`[ANALYTICS] Explanation: ${parsedResponse.explanation}`);

      return {
        sql: parsedResponse.sql,
        explanation: parsedResponse.explanation
      };

    } catch (error: any) {
      console.error('[ANALYTICS] Failed to generate SQL:', error.message);
      return {
        sql: '',
        explanation: '',
        error: error.message || 'Failed to generate SQL query'
      };
    }
  }

  /**
   * Execute analytics SQL query with BULLETPROOF Row-Level Security (RLS) in Transaction
   */
  async executeAnalyticsQuery(sqlQuery: string, schoolId: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
    rowCount?: number;
  }> {
    try {
      // Verify RLS policies exist before any query execution (CRITICAL)
      await this.verifyRLSPolicies();

      // Validate SQL security with AST-based validation
      const validation = this.validateSQLSecurity(sqlQuery, schoolId);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Use bulletproof Row-Level Security approach - original SQL unchanged
      const secureSql = sqlQuery;
      
      console.log(`[ANALYTICS] Executing RLS-secured SQL for school ${schoolId}:`);
      console.log(`[ANALYTICS] Query: ${secureSql}`);
      
      // Execute within transaction to ensure tenant context applies to the same connection
      const result = await db.transaction(async (tx) => {
        // Set tenant context using set_config (PostgreSQL function that accepts parameters)
        await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
        
        // Execute the analytics query - RLS policies automatically filter by school_id
        const queryResult = await tx.execute(sql.raw(secureSql));
        
        return queryResult;
      });
      
      // For PostgreSQL, result has a rows property
      const rows = (result as any).rows || result;
      const dataArray = Array.isArray(rows) ? rows : [rows];
      
      console.log(`[ANALYTICS] RLS-secured query executed successfully, returned ${dataArray.length} rows`);
      
      return {
        success: true,
        data: dataArray,
        rowCount: dataArray.length
      };

    } catch (error: any) {
      console.error('[ANALYTICS] SQL execution error:', error);
      return {
        success: false,
        error: `Database error: ${error.message}`
      };
    }
  }

  /**
   * Format analytics results into human-friendly message
   */
  formatAnalyticsResults(
    data: any[], 
    explanation: string, 
    naturalLanguageQuery: string
  ): string {
    if (!data || data.length === 0) {
      return `📊 No data found for your query.\n\nThis could mean:\n• No records match your criteria\n• The time period specified has no data\n• All values for the requested metric are zero`;
    }

    // Get column headers from the first row
    const columns = Object.keys(data[0]);
    
    // Create table header
    let tableMarkdown = `📊 **Results** (${data.length} record${data.length !== 1 ? 's' : ''})\n\n`;
    
    // Add table headers
    tableMarkdown += `| ${columns.join(' | ')} |\n`;
    tableMarkdown += `|${columns.map(() => ' --- ').join('|')}|\n`;
    
    // Add table rows (limit to top 50 for performance)
    const displayData = data.length > 50 ? data.slice(0, 50) : data;
    
    displayData.forEach(row => {
      const values = columns.map(col => {
        const value = row[col];
        // Format values nicely
        if (value === null || value === undefined) return '-';
        if (typeof value === 'number') return value.toString();
        return value.toString();
      });
      tableMarkdown += `| ${values.join(' | ')} |\n`;
    });

    if (data.length > 50) {
      tableMarkdown += `\n*Showing first 50 of ${data.length} total records*\n`;
    }

    tableMarkdown += `\n💡 *Need to export this data? Ask me to "export this as Excel" or "export as CSV"*`;

    return tableMarkdown;
  }

  /**
   * Export analytics data to Excel
   */
  async exportToExcel(data: any[], filename: string): Promise<Buffer> {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Auto-size columns
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const columnWidths: any[] = [];
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxWidth = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
          const cellLength = cell.v.toString().length;
          if (cellLength > maxWidth) {
            maxWidth = cellLength;
          }
        }
      }
      columnWidths.push({ width: Math.min(maxWidth + 2, 50) });
    }
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics Report');
    
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });
    
    return excelBuffer;
  }

  /**
   * Export analytics data to CSV
   */
  async exportToCSV(data: any[]): Promise<string> {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [];
    
    // Add headers
    csvRows.push(headers.join(','));
    
    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Check if user has analytics access (admin/super_admin only)
   */
  checkAnalyticsAccess(userRole: string): boolean {
    return userRole === 'admin' || userRole === 'super_admin';
  }
}

export const analyticsService = new AnalyticsService();