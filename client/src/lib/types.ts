export interface Teacher {
  id: string;
  name: string;
  email: string;
  subjects?: string[];
  classes: string[];
  availability?: {
    monday: boolean | string[];
    tuesday: boolean | string[];
    wednesday: boolean | string[];
    thursday: boolean | string[];
    friday: boolean | string[];
    saturday: boolean | string[];
    sunday?: boolean | string[];
  };
  maxDailyPeriods?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  schoolId?: string;
  employeeId?: string;
  contactNumber?: string;
  schoolIdNumber?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  periodsPerWeek: number;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  grade: string;
  section: string;
  studentCount: number;
  requiredSubjects: string[];
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
  period: number;
  startTime: string;
  endTime: string;
  room?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
}
