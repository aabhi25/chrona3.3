# Chrona - Smart Timetable Management

## Overview
Chrona is a comprehensive SaaS web application for educational institutions, offering AI-powered timetable generation, management, and optimization. It provides a multi-role platform for administrators, teachers, students, and parents, integrating features such as automated timetable generation, robust data import/export, and complete school management modules including Fee Management and Transport Management. Its core purpose is to deliver an efficient, integrated, and unified solution to enhance operational efficiency and streamline various school management tasks with AI-driven timetable generation and real-time validation. It includes a comprehensive E-Learning module with course management, lesson delivery, quizzes, assignments, announcements, and discussion forums - now enhanced with Phase 1 & 2 features including announcements and collaborative discussions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Frontend Framework**: React with TypeScript, Wouter for routing, and TanStack Query for state management.
- **Styling**: Radix UI with Tailwind CSS (shadcn/ui), supporting dark mode, professional tab navigation, responsive layouts, color-coded UI feedback, and interactive data visualizations.
- **Contextual Help**: Info icons provide step-by-step usage instructions and practical examples for key modules.

### Technical Implementations
- **Backend Runtime**: Node.js with Express.js, written in TypeScript.
- **Database ORM**: Drizzle ORM for PostgreSQL.
- **Session Management**: PostgreSQL session storage.
- **Timezone**: Full IST (Asia/Kolkata, UTC+5:30) standardization.
- **System Design**: Multi-tenancy with data isolation, centralized error handling, role-based access control, and RESTful conventions.
- **API Architecture**: RESTful endpoints with JWT tokens, role-based access control, and Zod for request validation.

### Feature Specifications
- **AI Smart Timetable System**: AI-powered generation, conflict detection, real-time validation, manual editing, and weekly overrides.
- **Teacher Profile Customization**: Drag-and-drop interface for profile sections.
- **Real-time Notification System**: Full-page notification center with intelligent grouping.
- **Leave Tracking**: Multi-day leave tracking for teachers with automatic timetable adjustments.
- **Bulk Upload System**: Excel-based data import for teachers, students, and class-subject-teacher assignments with extensive validation.
- **Standardized Subject Code Generation**: Unified grade-specific logic across all subject creation features.
- **Flexible Class Names System**: Dropdown-based class selection with predefined, sortable options.
- **Messaging System**: Multi-role direct messaging with role-based permissions.
- **Smart Newsfeed Link Previews**: Automatic link detection with clickable URLs and rich previews.
- **Fee Management Service**: Comprehensive financial management, invoicing, and payment tracking.
- **Transport Management Service**: Route, vehicle, and stop management with integrated fee calculation.
- **AI Teacher Requirement Planner**: Intelligent staffing optimization with AI chat assistance, providing recommendations for free periods, teacher sharing, staffing alerts, and coverage gap analysis.
- **Teacher Load Simulation**: Grid-based what-if scenario planning with isolated data, drag-and-drop subject copying, visual capacity indicators, weekly teaching period limit validation, and Excel-based bulk upload/export.
- **User Management Module**: Credential management for administrators, including bulk generation.
- **Smart Reports Module**: Compact reporting dashboard.
- **School Settings Module**: Configurable school-wide defaults.
- **Clear School Data (Admin)**: Option for school admins to clear all school data with password verification.
- **Chroney AI Chat Assistant**: Advanced AI assistant powered by OpenAI GPT-4.1-nano with function calling, multi-step tool chaining, conversation context tracking, in-chat table display, smart navigation redirects, and interactive profile dialogs. Features include confirmation-based attendance marking, conversation memory, intelligent topic-switch detection, and automatic memory reset. Optimized for performance and cost.
- **Calendar Module**: School calendar management with event creation, filtering, and visualization, with full IST timezone support.
- **Schools Management (Super Admin)**: Comprehensive school management with create, edit, view, clear data, and delete operations.
- **Database Backup (Super Admin)**: Complete database backup system with one-click download in SQL format; includes schema and all data with pg_dump streaming.
- **Academic Session Management (Super Admin)**: Automated creation via cron job.
- **Exam Management System**: Class-based hierarchical structure for exam creation, marks entry, and management.
- **ID Cards Generator**: Complete ID card management system with template upload, bulk generation for students and teachers, and generated card storage.
- **Certification System**: Professional certificate generation with customizable templates, pre-designed categories, and management features.
- **E-Learning Module**: Comprehensive online learning management system with multi-role course creation support. Teachers create courses under their own name, while school admins create courses under the admin account with full management privileges. All courses track their creator (admin or teacher) via createdBy and createdByRole fields. Features include:
  - **Course Management**: Create, edit, and delete courses with title, description, and status (draft/published/archived)
  - **Lesson Management**: Add lessons to courses with title, description, and duration; rich content blocks support text, video (YouTube/Vimeo/upload), images, documents, and quizzes
  - **Course Detail Pages**: Comprehensive tabbed interface with Lessons, Announcements, and Discussions tabs; statistics cards showing counts; role-based create dialogs
  - **Student Enrollment**: Full enrollment system with access control verification
  - **Quiz System**: Auto-grading for objective questions, manual review for subjective answers
  - **Assignment Management**: Submission and grading system with progress tracking
  - **Announcements**: Create, view, and manage course announcements with pinning support (Phase 2)
  - **Discussion Forums**: Thread-based discussions with replies, resolution, and view tracking (Phase 2)
  - **Security Architecture**: Three-layer RBAC enforcement - (1) school isolation, (2) student enrollment/teacher ownership validation, (3) mutation verification; prevents cross-school access and unauthorized teacher-to-teacher privilege escalation
  - **Role-based Access Control**: Admins see all school courses (admin-created and teacher-created), teachers see only their own courses plus enrolled courses, students see only published enrolled courses; granular permissions for announcements (teachers can only manage in owned courses) and discussions (teachers can participate in owned or enrolled courses)
- **Module-Based Permission System**: Custom role-based access control (RBAC) with granular module permissions. School admins can assign multiple custom roles to individual users simultaneously with permissions aggregated from all assigned roles. Teachers can hold multiple roles (e.g., both "Timetable Manager" and "Academic Head") with a unified permission set. Features include 30 pre-seeded system modules across all Chrona features, permission matrix UI for easy configuration, role templates (Timetable Manager, Accountant, Transport Coordinator, Academic Head), many-to-many role assignment via junction table, multi-select UI with colored role badges, middleware-based permission enforcement, and automatic module seeding on server startup.
- **Teacher Salary Viewing**: Comprehensive salary information access for teachers with detailed salary breakdown showing all salary components, monthly payslip history with payment details, and user-friendly interface accessible via the More page. Features include role-based security (teachers can only view their own salary data), graceful handling of unconfigured payroll systems, and defensive error handling for robust operation.
- **Class Teacher User Management**: Dedicated credential management system for primary class teachers to generate and manage login credentials for students and parents in their assigned class. Features include secure access control (only primary class teachers can access their specific class), bulk credential generation with progress tracking, student and parent credential viewing, and integration with the existing credential service. Accessible via the More page for teachers.

## External Dependencies

### Database Services
- **PostgreSQL**: Database hosting (Neon serverless for production, Replit PostgreSQL for development).
- **pg**: Node.js PostgreSQL client.
- **connect-pg-simple**: PostgreSQL session store.

### UI and Styling
- **Radix UI**: Headless UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.
- **Font Awesome**: Additional icon support.

### Development and Build
- **Vite**: Frontend build tool.
- **PostCSS**: CSS processing.

### Data Processing
- **Multer**: Multipart form data handling.
- **Drizzle Kit**: Database migration and schema management.

### State Management and HTTP
- **TanStack Query**: Server state synchronization and caching.
- **React Hook Form**: Form state management with validation.
- **Zod**: Runtime type validation.

### Drag-and-Drop
- **@dnd-kit/core**: Core drag-and-drop functionality.
- **@dnd-kit/sortable**: Sortable list implementation.

### Data Visualization
- **Recharts**: Composable charting library.

### Scheduling and Automation
- **node-cron**: Task scheduling library.

### AI/LLM
- **OpenAI GPT-4.1-nano**: For Chroney AI assistant and analytics service.

## Replit Environment Setup (November 3, 2025)

### Configuration Status
- ✅ **Database**: PostgreSQL configured and schema migrated successfully
- ✅ **Development Server**: Running on port 5000 (combined frontend + backend)
- ✅ **Deployment**: Configured for autoscale deployment
- ✅ **Workflow**: Dev server workflow configured and running
- ✅ **System Modules**: 30 modules seeded successfully
- ✅ **Dependencies**: All npm packages installed

### Environment Variables
The following environment variables are configured or available:
- ✅ `DATABASE_URL` - PostgreSQL database connection (configured)
- ⚠️ `OPENAI_API_KEY` - Required for Chroney AI chat assistant (optional)
- ⚠️ `SUPER_ADMIN_EMAIL` - Super admin email for initial setup (optional)
- ⚠️ `SUPER_ADMIN_PASSWORD` - Super admin password for initial setup (optional)

### Development Setup
1. **Install Dependencies**: `npm install`
2. **Database Migration**: `npm run db:push`
3. **Start Development Server**: `npm run dev`
4. **Build for Production**: `npm run build`
5. **Start Production Server**: `npm start`

### Port Configuration
- **Frontend + Backend**: Port 5000 (unified server in development)
- **Host**: 0.0.0.0 (configured for Replit proxy)
- **Allowed Hosts**: True (configured for iframe preview)

### File Upload Configuration
- **Newsfeed Attachments**: 50MB maximum file size for PDFs, images, and text files
- **Express Body Parser**: Configured for 50MB request body limit
- **Multer**: Configured with in-memory storage and 50MB file size limit
- **Supported File Types**: JPEG, PNG, GIF, WebP images; PDF and TXT documents
- **Profile Pictures**: 5MB limit (teacher profile pictures)
- **Bulk Uploads**: 5MB limit (CSV/Excel files for student/class data)

### Notes
- The application uses a unified server architecture where Express serves both the API routes and the Vite development server
- Database schema is managed via Drizzle ORM with migrations in the `/migrations` directory
- Timezone is set to IST (Asia/Kolkata) throughout the application
- Auto-attendance service runs hourly
- Cron jobs are configured for weekly timetable generation, substitution processing, and annual academic session creation