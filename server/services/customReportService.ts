import { db } from "../db";
import { 
  students, 
  teachers, 
  classes, 
  subjects,
  studentAttendance,
  teacherAttendance,
  classSubjectAssignments,
  timetableEntries,
  fees
} from "@shared/schema";
import { eq, and, or, gte, lte, like, sql, SQL, desc, asc, count } from "drizzle-orm";

interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

interface ReportConfig {
  dataSource: string;
  selectedFields: string[];
  filters: FilterCondition[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  groupBy?: string;
}

// Define field metadata for each data source
const dataSourceMetadata: Record<string, {
  table: any;
  availableFields: Record<string, { label: string; type: string; filterable: boolean; sortable: boolean }>;
  joins?: any[];
}> = {
  'students': {
    table: students,
    availableFields: {
      'id': { label: 'Student ID', type: 'string', filterable: false, sortable: false },
      'firstName': { label: 'First Name', type: 'string', filterable: true, sortable: true },
      'lastName': { label: 'Last Name', type: 'string', filterable: true, sortable: true },
      'admissionNumber': { label: 'Admission Number', type: 'string', filterable: true, sortable: true },
      'rollNumber': { label: 'Roll Number', type: 'string', filterable: true, sortable: true },
      'email': { label: 'Email', type: 'string', filterable: true, sortable: true },
      'contactNumber': { label: 'Contact Number', type: 'string', filterable: true, sortable: false },
      'dateOfBirth': { label: 'Date of Birth', type: 'date', filterable: true, sortable: true },
      'gender': { label: 'Gender', type: 'string', filterable: true, sortable: false },
      'bloodGroup': { label: 'Blood Group', type: 'string', filterable: true, sortable: false },
      'guardianName': { label: 'Guardian Name', type: 'string', filterable: true, sortable: true },
      'guardianContact': { label: 'Guardian Contact', type: 'string', filterable: true, sortable: false },
      'address': { label: 'Address', type: 'string', filterable: false, sortable: false },
      'status': { label: 'Status', type: 'string', filterable: true, sortable: false },
    }
  },
  'teachers': {
    table: teachers,
    availableFields: {
      'id': { label: 'Teacher ID', type: 'string', filterable: false, sortable: false },
      'firstName': { label: 'First Name', type: 'string', filterable: true, sortable: true },
      'lastName': { label: 'Last Name', type: 'string', filterable: true, sortable: true },
      'employeeId': { label: 'Employee ID', type: 'string', filterable: true, sortable: true },
      'email': { label: 'Email', type: 'string', filterable: true, sortable: true },
      'contactNumber': { label: 'Contact Number', type: 'string', filterable: true, sortable: false },
      'qualification': { label: 'Qualification', type: 'string', filterable: true, sortable: false },
      'subjects': { label: 'Subjects', type: 'array', filterable: false, sortable: false },
      'maxDailyPeriods': { label: 'Max Daily Periods', type: 'number', filterable: true, sortable: true },
      'status': { label: 'Status', type: 'string', filterable: true, sortable: false },
    }
  },
  'student-attendance': {
    table: studentAttendance,
    availableFields: {
      'studentId': { label: 'Student ID', type: 'string', filterable: true, sortable: false },
      'attendanceDate': { label: 'Date', type: 'date', filterable: true, sortable: true },
      'status': { label: 'Status', type: 'string', filterable: true, sortable: false },
      'markedAt': { label: 'Marked At', type: 'timestamp', filterable: true, sortable: true },
      'notes': { label: 'Notes', type: 'string', filterable: false, sortable: false },
    }
  },
  'teacher-attendance': {
    table: teacherAttendance,
    availableFields: {
      'teacherId': { label: 'Teacher ID', type: 'string', filterable: true, sortable: false },
      'attendanceDate': { label: 'Date', type: 'date', filterable: true, sortable: true },
      'status': { label: 'Status', type: 'string', filterable: true, sortable: false },
      'markedAt': { label: 'Marked At', type: 'timestamp', filterable: true, sortable: true },
      'reason': { label: 'Reason', type: 'string', filterable: false, sortable: false },
      'leaveStartDate': { label: 'Leave Start Date', type: 'date', filterable: true, sortable: true },
      'leaveEndDate': { label: 'Leave End Date', type: 'date', filterable: true, sortable: true },
    }
  },
  'classes': {
    table: classes,
    availableFields: {
      'id': { label: 'Class ID', type: 'string', filterable: false, sortable: false },
      'name': { label: 'Class Name', type: 'string', filterable: true, sortable: true },
      'grade': { label: 'Grade', type: 'string', filterable: true, sortable: true },
      'section': { label: 'Section', type: 'string', filterable: true, sortable: true },
      'classTeacherId': { label: 'Class Teacher ID', type: 'string', filterable: true, sortable: false },
      'room': { label: 'Room', type: 'string', filterable: true, sortable: true },
      'capacity': { label: 'Capacity', type: 'number', filterable: true, sortable: true },
    }
  },
  'subjects': {
    table: subjects,
    availableFields: {
      'id': { label: 'Subject ID', type: 'string', filterable: false, sortable: false },
      'name': { label: 'Subject Name', type: 'string', filterable: true, sortable: true },
      'code': { label: 'Subject Code', type: 'string', filterable: true, sortable: true },
      'description': { label: 'Description', type: 'string', filterable: false, sortable: false },
    }
  },
};

// Build WHERE clause from filters
function buildWhereClause(filters: FilterCondition[], tableAlias: any): SQL | undefined {
  if (!filters || filters.length === 0) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    const { field, operator, value } = filter;
    const column = tableAlias[field];
    
    if (!column) continue;

    switch (operator) {
      case 'equals':
      case '=':
        conditions.push(eq(column, value));
        break;
      case 'not_equals':
      case '!=':
        conditions.push(sql`${column} != ${value}`);
        break;
      case 'contains':
      case 'like':
        conditions.push(like(column, `%${value}%`));
        break;
      case 'starts_with':
        conditions.push(like(column, `${value}%`));
        break;
      case 'ends_with':
        conditions.push(like(column, `%${value}`));
        break;
      case 'greater_than':
      case '>':
        conditions.push(sql`${column} > ${value}`);
        break;
      case 'less_than':
      case '<':
        conditions.push(sql`${column} < ${value}`);
        break;
      case 'greater_than_or_equal':
      case '>=':
        conditions.push(gte(column, value));
        break;
      case 'less_than_or_equal':
      case '<=':
        conditions.push(lte(column, value));
        break;
      case 'in':
        if (Array.isArray(value)) {
          conditions.push(sql`${column} IN (${sql.join(value.map(v => sql`${v}`), sql`, `)})`);
        }
        break;
      case 'not_in':
        if (Array.isArray(value)) {
          conditions.push(sql`${column} NOT IN (${sql.join(value.map(v => sql`${v}`), sql`, `)})`);
        }
        break;
      case 'between':
        if (Array.isArray(value) && value.length === 2) {
          conditions.push(and(gte(column, value[0]), lte(column, value[1]))!);
        }
        break;
      case 'is_null':
        conditions.push(sql`${column} IS NULL`);
        break;
      case 'is_not_null':
        conditions.push(sql`${column} IS NOT NULL`);
        break;
    }
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

// Generate custom report
export async function generateCustomReport(
  config: ReportConfig,
  schoolId: string
): Promise<any[]> {
  const { dataSource, selectedFields, filters, sortBy, sortOrder } = config;

  const metadata = dataSourceMetadata[dataSource];
  if (!metadata) {
    throw new Error(`Unknown data source: ${dataSource}`);
  }

  const { table } = metadata;

  // Build query
  let query = db.select().from(table);

  // Add school filter (all tables should have schoolId)
  query = query.where(eq(table.schoolId, schoolId)) as any;

  // Add custom filters
  const whereClause = buildWhereClause(filters, table);
  if (whereClause) {
    query = query.where(whereClause) as any;
  }

  // Add sorting
  if (sortBy && table[sortBy]) {
    const sortColumn = table[sortBy];
    query = query.orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn)) as any;
  }

  // Execute query
  const results = await query;

  // Project only selected fields
  return results.map((row: any) => {
    const projected: any = {};
    for (const field of selectedFields) {
      if (row[field] !== undefined) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
}

// Get available fields for a data source
export function getAvailableFields(dataSource: string) {
  const metadata = dataSourceMetadata[dataSource];
  if (!metadata) {
    throw new Error(`Unknown data source: ${dataSource}`);
  }

  return Object.entries(metadata.availableFields).map(([name, meta]) => ({
    name,
    ...meta
  }));
}

// Get all available data sources
export function getAvailableDataSources() {
  return Object.keys(dataSourceMetadata).map(key => ({
    id: key,
    label: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }));
}
