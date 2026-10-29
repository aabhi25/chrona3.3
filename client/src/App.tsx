import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import { TimetableGuard } from "@/components/TimetableGuard";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
const InsightsPage = lazy(() => import("@/pages/InsightsPage"));
const TimetableView = lazy(() => import("@/pages/TimetableView"));
const TimetableSettingsPage = lazy(() => import("@/pages/TimetableSettingsPage"));
const StudentsPage = lazy(() => import("@/pages/StudentsPage"));
const StudentDetailPage = lazy(() => import("@/pages/StudentDetailPage").then((m) => ({ default: m.StudentDetailPage })));
const TeacherView = lazy(() => import("@/pages/TeacherView"));
const TeacherBulkUpload = lazy(() => import("@/pages/TeacherBulkUpload"));
const TeacherBulkReview = lazy(() => import("@/pages/TeacherBulkReview"));
const StudentBulkUpload = lazy(() => import("@/pages/StudentBulkUpload"));
const StudentBulkReview = lazy(() => import("@/pages/StudentBulkReview"));
const ClassesPage = lazy(() => import("@/pages/ClassesPage"));
const ClassDetailPage = lazy(() => import("@/pages/ClassDetailPage"));
const ClassBulkUpload = lazy(() => import("@/pages/ClassBulkUpload"));
const ClassBulkReview = lazy(() => import("@/pages/ClassBulkReview"));
const ClassBulkImportPage = lazy(() => import("@/pages/ClassBulkImportPage"));
const SubjectsPage = lazy(() => import("@/pages/SubjectsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const BulkUploadPage = lazy(() => import("@/pages/settings/BulkUploadPage"));
const BulkReviewPage = lazy(() => import("@/pages/settings/BulkReviewPage"));
const TeacherProfile = lazy(() => import("@/pages/TeacherProfile"));
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const MyProfilePage = lazy(() => import("@/pages/MyProfilePage"));
const MyClassPage = lazy(() => import("@/pages/MyClassPage"));
const StudentAttendancePage = lazy(() => import("@/pages/StudentAttendancePage"));
const AttendancePage = lazy(() => import("@/pages/AttendancePage"));
const TeacherAttendancePage = lazy(() => import("@/pages/TeacherAttendancePage"));
const TeacherMyAttendancePage = lazy(() => import("@/pages/TeacherMyAttendancePage"));
const FeeManagementPage = lazy(() => import("@/pages/FeeManagementPage"));
const TransportManagementPage = lazy(() => import("@/pages/TransportManagementPage"));
const TeacherPlannerPage = lazy(() => import("@/pages/TeacherPlannerPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const MessagingPage = lazy(() => import("@/pages/MessagingPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const MorePage = lazy(() => import("@/pages/MorePage"));
const UserManagementPage = lazy(() => import("@/pages/UserManagementPage"));
const ClassUserManagementPage = lazy(() => import("@/pages/ClassUserManagementPage"));
const SmartReports = lazy(() => import("@/pages/SmartReports"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const TeacherMyClassesPage = lazy(() => import("@/pages/TeacherMyClassesPage"));
const TeacherClassDetailPage = lazy(() => import("@/pages/TeacherClassDetailPage"));
const AdmissionPage = lazy(() => import("@/pages/AdmissionPage"));
const ExamPage = lazy(() => import("@/pages/ExamPage"));
const HostelPage = lazy(() => import("@/pages/HostelPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const PayrollPage = lazy(() => import("@/pages/PayrollPage"));
const ExpensePage = lazy(() => import("@/pages/ExpensePage"));
const IDCardsPage = lazy(() => import("@/pages/IDCardsPage"));
const CertificationPage = lazy(() => import("@/pages/CertificationPage"));
const ELearningPage = lazy(() => import("@/pages/ELearningPage"));
const CourseDetailPage = lazy(() => import("@/pages/CourseDetailPage"));
const LessonDetailPage = lazy(() => import("@/pages/LessonDetailPage"));
const LessonEditorPage = lazy(() => import("@/pages/LessonEditorPage"));
const AdminChatPage = lazy(() => import("@/pages/AdminChatPage"));
const RolePermissionsPage = lazy(() => import("@/pages/RolePermissionsPage"));
const TeacherLeaveApplicationPage = lazy(() => import("@/pages/TeacherLeaveApplicationPage"));
const TeacherSchedulePage = lazy(() => import("@/pages/TeacherSchedulePage"));
const TeacherSalaryPage = lazy(() => import("@/pages/TeacherSalaryPage"));
const SimulationDetailsPage = lazy(() => import("@/pages/SimulationDetailsPage"));
const LoadSimulationBulkReview = lazy(() => import("@/pages/LoadSimulationBulkReview"));

// Pages are loaded on first visit, so the first page load stays small
function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Handle first-time login password change (standalone page without layout)
  if (user?.isFirstLogin) {
    return <ChangePasswordPage />;
  }

  const isSuperAdmin = user?.role === "super_admin";
  const isSchoolAdmin = user?.role === "admin";
  const isStudent = user?.role === "student";
  const isTeacher = user?.role === "teacher";
  const isParent = user?.role === "parent";

  return (
    <Layout>
      <Suspense fallback={<PageLoading />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        {/* Insights page for Admin and Super Admin */}
        {(isSchoolAdmin || isSuperAdmin) && <Route path="/insights" component={InsightsPage} />}
        
        {/* Super Admin only pages */}
        {isSuperAdmin && <Route path="/admin-dashboard" component={AdminDashboardPage} />}
        
        {/* School Admin only pages */}
        {isSchoolAdmin && <Route path="/classes" component={ClassesPage} />}
        {isSchoolAdmin && <Route path="/classes/bulk-import" component={ClassBulkImportPage} />}
        {isSchoolAdmin && <Route path="/classes/bulk-upload" component={ClassBulkUpload} />}
        {isSchoolAdmin && <Route path="/classes/bulk-review" component={ClassBulkReview} />}
        {isSchoolAdmin && <Route path="/classes/:id" component={ClassDetailPage} />}
        {isSchoolAdmin && <Route path="/students" component={StudentsPage} />}
        {isSchoolAdmin && <Route path="/students/bulk-upload" component={StudentBulkUpload} />}
        {isSchoolAdmin && <Route path="/students/bulk-review" component={StudentBulkReview} />}
        {isSchoolAdmin && <Route path="/students/:id" component={StudentDetailPage} />}
        {isSchoolAdmin && <Route path="/subjects" component={SubjectsPage} />}
        {isSchoolAdmin && (
          <Route path="/timetable">
            <TimetableGuard>
              <TimetableView />
            </TimetableGuard>
          </Route>
        )}
        {isSchoolAdmin && <Route path="/timetable/settings" component={TimetableSettingsPage} />}
        {isSchoolAdmin && <Route path="/teachers" component={TeacherView} />}
        {isSchoolAdmin && <Route path="/teachers/bulk-upload" component={TeacherBulkUpload} />}
        {isSchoolAdmin && <Route path="/teachers/bulk-review" component={TeacherBulkReview} />}
        {isSchoolAdmin && <Route path="/teacher/:id" component={TeacherProfile} />}
        {isSchoolAdmin && <Route path="/teacher-planner" component={TeacherPlannerPage} />}
        {isSchoolAdmin && <Route path="/simulation/:id/bulk-review" component={LoadSimulationBulkReview} />}
        {isSchoolAdmin && <Route path="/simulation/:id" component={SimulationDetailsPage} />}
        {isSchoolAdmin && <Route path="/user-management" component={UserManagementPage} />}
        {isSchoolAdmin && <Route path="/fees" component={FeeManagementPage} />}
        {isSchoolAdmin && <Route path="/transport" component={TransportManagementPage} />}
        {isSchoolAdmin && <Route path="/calendar" component={CalendarPage} />}
        {isSchoolAdmin && <Route path="/admission/:id" component={AdmissionPage} />}
        {isSchoolAdmin && <Route path="/admission" component={AdmissionPage} />}
        {isSchoolAdmin && <Route path="/exam" component={ExamPage} />}
        {isSchoolAdmin && <Route path="/hostel" component={HostelPage} />}
        {isSchoolAdmin && <Route path="/inventory" component={InventoryPage} />}
        {isSchoolAdmin && <Route path="/payroll" component={PayrollPage} />}
        {isSchoolAdmin && <Route path="/expense" component={ExpensePage} />}
        {isSchoolAdmin && <Route path="/id-cards" component={IDCardsPage} />}
        {isSchoolAdmin && <Route path="/certification" component={CertificationPage} />}
        {isSchoolAdmin && <Route path="/smart-reports" component={SmartReports} />}
        {isSchoolAdmin && <Route path="/reports" component={ReportsPage} />}
        {isSchoolAdmin && <Route path="/admin-chat" component={AdminChatPage} />}
        {isSchoolAdmin && <Route path="/permissions" component={RolePermissionsPage} />}
        
        {/* Attendance - available to both school admin and super admin */}
        {(isSchoolAdmin || isSuperAdmin) && <Route path="/attendance" component={AttendancePage} />}
        
        {/* Student only pages */}
        {isStudent && <Route path="/my-attendance" component={StudentAttendancePage} />}
        {isStudent && <Route path="/my-class" component={MyClassPage} />}
        {isStudent && <Route path="/my-profile" component={MyProfilePage} />}

        {/* Parent pages - the same student pages, showing their child */}
        {isParent && <Route path="/my-attendance" component={StudentAttendancePage} />}
        {isParent && <Route path="/my-class" component={MyClassPage} />}
        {isParent && <Route path="/my-profile" component={MyProfilePage} />}

        {/* Teacher only pages */}
        {isTeacher && <Route path="/my-class" component={TeacherMyClassesPage} />}
        {isTeacher && <Route path="/my-classes/:id" component={TeacherClassDetailPage} />}
        {isTeacher && <Route path="/my-schedule" component={TeacherSchedulePage} />}
        {isTeacher && <Route path="/my-profile" component={MyProfilePage} />}
        {isTeacher && <Route path="/attendance" component={TeacherAttendancePage} />}
        {isTeacher && <Route path="/my-attendance" component={TeacherMyAttendancePage} />}
        {isTeacher && <Route path="/leave-application" component={TeacherLeaveApplicationPage} />}
        {isTeacher && <Route path="/my-salary" component={TeacherSalaryPage} />}
        {isTeacher && <Route path="/class-user-management" component={ClassUserManagementPage} />}
        
        {/* Available to all authenticated users */}
        <Route path="/more" component={MorePage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/messages" component={MessagingPage} />
        <Route path="/e-learning" component={ELearningPage} />
        <Route path="/e-learning/courses/:courseId/lessons/:lessonId/edit" component={LessonEditorPage} />
        <Route path="/e-learning/courses/:courseId/lessons/:lessonId" component={LessonDetailPage} />
        <Route path="/e-learning/courses/:id/edit" component={CourseDetailPage} />
        <Route path="/e-learning/courses/:id" component={CourseDetailPage} />
        <Route path="/settings" component={SettingsPage} />
        
        {/* Bulk Upload - available to admin and super_admin */}
        {(isSchoolAdmin || isSuperAdmin) && <Route path="/settings/bulk-upload" component={BulkUploadPage} />}
        {(isSchoolAdmin || isSuperAdmin) && <Route path="/settings/bulk-upload/review" component={BulkReviewPage} />}
        
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
