import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import InsightsPage from "@/pages/InsightsPage";
import TimetableView from "@/pages/TimetableView";
import TimetableSettingsPage from "@/pages/TimetableSettingsPage";
import { TimetableGuard } from "@/components/TimetableGuard";
import StudentsPage from "@/pages/StudentsPage";
import { StudentDetailPage } from "@/pages/StudentDetailPage";
import TeacherView from "@/pages/TeacherView";
import TeacherBulkUpload from "@/pages/TeacherBulkUpload";
import TeacherBulkReview from "@/pages/TeacherBulkReview";
import StudentBulkUpload from "@/pages/StudentBulkUpload";
import StudentBulkReview from "@/pages/StudentBulkReview";
import ClassesPage from "@/pages/ClassesPage";
import ClassDetailPage from "@/pages/ClassDetailPage";
import ClassBulkUpload from "@/pages/ClassBulkUpload";
import ClassBulkReview from "@/pages/ClassBulkReview";
import ClassBulkImportPage from "@/pages/ClassBulkImportPage";
import SubjectsPage from "@/pages/SubjectsPage";
import SettingsPage from "@/pages/SettingsPage";
import BulkUploadPage from "@/pages/settings/BulkUploadPage";
import BulkReviewPage from "@/pages/settings/BulkReviewPage";
import TeacherProfile from "@/pages/TeacherProfile";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import MyProfilePage from "@/pages/MyProfilePage";
import MyClassPage from "@/pages/MyClassPage";
import StudentAttendancePage from "@/pages/StudentAttendancePage";
import AttendancePage from "@/pages/AttendancePage";
import TeacherAttendancePage from "@/pages/TeacherAttendancePage";
import TeacherMyAttendancePage from "@/pages/TeacherMyAttendancePage";
import TimetableTestPage from "@/pages/TimetableTestPage";
import FeeManagementPage from "@/pages/FeeManagementPage";
import TransportManagementPage from "@/pages/TransportManagementPage";
import TeacherPlannerPage from "@/pages/TeacherPlannerPage";
import CalendarPage from "@/pages/CalendarPage";
import MessagingPage from "@/pages/MessagingPage";
import NotificationsPage from "@/pages/NotificationsPage";
import MorePage from "@/pages/MorePage";
import UserManagementPage from "@/pages/UserManagementPage";
import ClassUserManagementPage from "@/pages/ClassUserManagementPage";
import SmartReports from "@/pages/SmartReports";
import ReportsPage from "@/pages/ReportsPage";
import TeacherMyClassesPage from "@/pages/TeacherMyClassesPage";
import TeacherClassDetailPage from "@/pages/TeacherClassDetailPage";
import AdmissionPage from "@/pages/AdmissionPage";
import ExamPage from "@/pages/ExamPage";
import HostelPage from "@/pages/HostelPage";
import InventoryPage from "@/pages/InventoryPage";
import PayrollPage from "@/pages/PayrollPage";
import ExpensePage from "@/pages/ExpensePage";
import IDCardsPage from "@/pages/IDCardsPage";
import CertificationPage from "@/pages/CertificationPage";
import ELearningPage from "@/pages/ELearningPage";
import CourseDetailPage from "@/pages/CourseDetailPage";
import LessonDetailPage from "@/pages/LessonDetailPage";
import LessonEditorPage from "@/pages/LessonEditorPage";
import AdminChatPage from "@/pages/AdminChatPage";
import RolePermissionsPage from "@/pages/RolePermissionsPage";
import TeacherLeaveApplicationPage from "@/pages/TeacherLeaveApplicationPage";
import TeacherSchedulePage from "@/pages/TeacherSchedulePage";
import TeacherSalaryPage from "@/pages/TeacherSalaryPage";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import SimulationDetailsPage from "@/pages/SimulationDetailsPage";
import LoadSimulationBulkReview from "@/pages/LoadSimulationBulkReview";

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
        {isSchoolAdmin && <Route path="/timetable/test" component={TimetableTestPage} />}
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
