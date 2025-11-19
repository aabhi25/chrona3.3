import { db } from "./db";
import { systemModules } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * System Modules for Chrona School Management System
 * These modules define all available features that can be assigned role-based permissions
 */
const CHRONA_MODULES = [
  // Academic Management
  {
    name: 'timetable_management',
    displayName: 'Timetable Management',
    description: 'Create, edit, and manage school timetables with AI-powered generation',
    category: 'Academic',
    routePath: '/timetable',
    icon: 'Calendar',
    sortOrder: 1
  },
  {
    name: 'class_management',
    displayName: 'Class Management',
    description: 'Manage classes, sections, and class assignments',
    category: 'Academic',
    routePath: '/classes',
    icon: 'School',
    sortOrder: 2
  },
  {
    name: 'subject_management',
    displayName: 'Subject Management',
    description: 'Manage subjects and subject assignments',
    category: 'Academic',
    routePath: '/subjects',
    icon: 'BookOpen',
    sortOrder: 3
  },
  {
    name: 'exam_management',
    displayName: 'Exam Management',
    description: 'Create and manage exams, marks entry, and report cards',
    category: 'Academic',
    routePath: '/exams',
    icon: 'FileText',
    sortOrder: 4
  },
  {
    name: 'elearning_management',
    displayName: 'E-Learning',
    description: 'Manage online courses, lessons, quizzes, and assignments',
    category: 'Academic',
    routePath: '/elearning',
    icon: 'GraduationCap',
    sortOrder: 5
  },
  {
    name: 'calendar_events',
    displayName: 'Calendar & Events',
    description: 'Manage school calendar and events',
    category: 'Academic',
    routePath: '/calendar',
    icon: 'CalendarDays',
    sortOrder: 6
  },

  // People Management
  {
    name: 'student_management',
    displayName: 'Student Management',
    description: 'Manage student records, enrollment, and profiles',
    category: 'People',
    routePath: '/students',
    icon: 'Users',
    sortOrder: 10
  },
  {
    name: 'teacher_management',
    displayName: 'Teacher Management',
    description: 'Manage teacher profiles, assignments, and workload',
    category: 'People',
    routePath: '/teachers',
    icon: 'UserCheck',
    sortOrder: 11
  },
  {
    name: 'admission_management',
    displayName: 'Admission Management',
    description: 'Handle student admissions and enrollment',
    category: 'People',
    routePath: '/admissions',
    icon: 'UserPlus',
    sortOrder: 12
  },
  {
    name: 'user_management',
    displayName: 'User Management',
    description: 'Manage user accounts, credentials, and access',
    category: 'People',
    routePath: '/user-management',
    icon: 'Shield',
    sortOrder: 13
  },

  // Attendance & Leave
  {
    name: 'student_attendance',
    displayName: 'Student Attendance',
    description: 'Track and manage student attendance',
    category: 'Attendance',
    routePath: '/attendance/students',
    icon: 'ClipboardCheck',
    sortOrder: 20
  },
  {
    name: 'teacher_attendance',
    displayName: 'Teacher Attendance',
    description: 'Track and manage teacher attendance and leave',
    category: 'Attendance',
    routePath: '/attendance/teachers',
    icon: 'UserCheck',
    sortOrder: 21
  },

  // Financial Management
  {
    name: 'fee_management',
    displayName: 'Fee Management',
    description: 'Manage fee structures, invoices, and payment tracking',
    category: 'Financial',
    routePath: '/fees',
    icon: 'DollarSign',
    sortOrder: 30
  },
  {
    name: 'expense_management',
    displayName: 'Expense Management',
    description: 'Track school expenses and budgets',
    category: 'Financial',
    routePath: '/expenses',
    icon: 'Receipt',
    sortOrder: 31
  },
  {
    name: 'payroll_management',
    displayName: 'Payroll Management',
    description: 'Manage employee salaries and payroll',
    category: 'Financial',
    routePath: '/payroll',
    icon: 'Wallet',
    sortOrder: 32
  },

  // Operations
  {
    name: 'transport_management',
    displayName: 'Transport Management',
    description: 'Manage routes, vehicles, stops, and student assignments',
    category: 'Operations',
    routePath: '/transport',
    icon: 'Bus',
    sortOrder: 40
  },
  {
    name: 'hostel_management',
    displayName: 'Hostel Management',
    description: 'Manage hostels, rooms, and student allocations',
    category: 'Operations',
    routePath: '/hostel',
    icon: 'Home',
    sortOrder: 41
  },
  {
    name: 'inventory_management',
    displayName: 'Inventory Management',
    description: 'Track inventory items and transactions',
    category: 'Operations',
    routePath: '/inventory',
    icon: 'Package',
    sortOrder: 42
  },

  // Communication
  {
    name: 'messaging',
    displayName: 'Messaging',
    description: 'Internal messaging system for school communication',
    category: 'Communication',
    routePath: '/messages',
    icon: 'MessageSquare',
    sortOrder: 50
  },
  {
    name: 'newsfeed',
    displayName: 'Newsfeed',
    description: 'School announcements and updates',
    category: 'Communication',
    routePath: '/newsfeed',
    icon: 'Newspaper',
    sortOrder: 51
  },
  {
    name: 'notifications',
    displayName: 'Notifications',
    description: 'System notifications and alerts',
    category: 'Communication',
    routePath: '/notifications',
    icon: 'Bell',
    sortOrder: 52
  },

  // Reports & Analytics
  {
    name: 'reports_analytics',
    displayName: 'Reports & Analytics',
    description: 'Generate reports and view school analytics',
    category: 'Reports',
    routePath: '/reports',
    icon: 'BarChart',
    sortOrder: 60
  },
  {
    name: 'smart_reports',
    displayName: 'Smart Reports',
    description: 'AI-powered reports and insights',
    category: 'Reports',
    routePath: '/smart-reports',
    icon: 'TrendingUp',
    sortOrder: 61
  },
  {
    name: 'insights_dashboard',
    displayName: 'Insights Dashboard',
    description: 'School performance insights and analytics',
    category: 'Reports',
    routePath: '/insights',
    icon: 'PieChart',
    sortOrder: 62
  },

  // Documents & Certificates
  {
    name: 'id_cards',
    displayName: 'ID Cards Generator',
    description: 'Generate and manage student and teacher ID cards',
    category: 'Documents',
    routePath: '/id-cards',
    icon: 'CreditCard',
    sortOrder: 70
  },
  {
    name: 'certificates',
    displayName: 'Certificates',
    description: 'Generate and manage certificates',
    category: 'Documents',
    routePath: '/certificates',
    icon: 'Award',
    sortOrder: 71
  },

  // Planning & AI Tools
  {
    name: 'teacher_planner',
    displayName: 'Teacher Requirement Planner',
    description: 'AI-powered teacher staffing and workload planning',
    category: 'Planning',
    routePath: '/teacher-planner',
    icon: 'Brain',
    sortOrder: 80
  },
  {
    name: 'ai_chat_assistant',
    displayName: 'Chroney AI Assistant',
    description: 'AI-powered chat assistant for school management',
    category: 'Planning',
    routePath: '/chat',
    icon: 'Bot',
    sortOrder: 81
  },

  // Settings & Configuration
  {
    name: 'school_settings',
    displayName: 'School Settings',
    description: 'Configure school-wide settings and preferences',
    category: 'Settings',
    routePath: '/settings',
    icon: 'Settings',
    sortOrder: 90
  },
  {
    name: 'timetable_settings',
    displayName: 'Timetable Settings',
    description: 'Configure timetable structure and preferences',
    category: 'Settings',
    routePath: '/timetable/settings',
    icon: 'Sliders',
    sortOrder: 91
  }
];

/**
 * Seed system modules into the database
 * This should be run once during initial setup or when new modules are added
 */
export async function seedSystemModules() {
  console.log('[SEED] Starting system modules seeding...');
  
  try {
    let insertedCount = 0;
    let skippedCount = 0;

    for (const module of CHRONA_MODULES) {
      // Check if module already exists
      const existing = await db.query.systemModules.findFirst({
        where: eq(systemModules.name, module.name)
      });

      if (existing) {
        console.log(`[SEED] Module "${module.displayName}" already exists, skipping...`);
        skippedCount++;
        continue;
      }

      // Insert new module
      await db.insert(systemModules).values({
        ...module,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`[SEED] ✓ Inserted module: ${module.displayName}`);
      insertedCount++;
    }

    console.log(`[SEED] Seeding complete! Inserted: ${insertedCount}, Skipped: ${skippedCount}, Total: ${CHRONA_MODULES.length}`);
    return {
      success: true,
      inserted: insertedCount,
      skipped: skippedCount,
      total: CHRONA_MODULES.length
    };
  } catch (error) {
    console.error('[SEED] Error seeding system modules:', error);
    throw error;
  }
}

// Export the modules list for reference
export { CHRONA_MODULES };
