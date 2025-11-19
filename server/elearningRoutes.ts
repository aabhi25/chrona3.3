import { Router } from "express";
import { z } from "zod";
import { elearningService } from "./services/elearningService";
import { db } from "./db";
import { courseMemberships, teachers } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Helper function to check if student is enrolled in a course
async function checkEnrollment(courseId: string, studentId: string): Promise<boolean> {
  const enrollment = await db.query.courseMemberships.findFirst({
    where: and(
      eq(courseMemberships.courseId, courseId),
      eq(courseMemberships.studentId, studentId)
    ),
  });
  return !!enrollment;
}

// Helper middleware to verify enrollment
async function requireEnrollment(req: any, res: any, next: any) {
  if (req.user?.role !== "student") {
    return next(); // Non-students bypass enrollment checks
  }

  const courseId = req.params.courseId || req.params.id || req.body.courseId;
  if (!courseId) {
    return res.status(400).json({ error: "Course ID required" });
  }

  const isEnrolled = await checkEnrollment(courseId, req.user.studentId!);
  if (!isEnrolled) {
    return res.status(403).json({ error: "Not enrolled in this course" });
  }

  next();
}

// ========================================
// COURSES
// ========================================

// Get all courses (filtered by role with security)
router.get("/courses", async (req, res) => {
  try {
    const { status, teacherId } = req.query;
    const filters: any = {};
    
    // SECURITY: Students can only see published courses
    if (req.user?.role === "student") {
      filters.status = "published";
    } else if (status) {
      filters.status = status;
    }
    
    // Teachers see only their own courses; admins see all courses in their school
    if (req.user?.role === "teacher") {
      filters.teacherId = req.user.teacherId;
    } else if (teacherId && req.user?.role === "admin") {
      // Admins can optionally filter by specific teacher
      filters.teacherId = teacherId as string;
    }
    // For admins without teacherId filter, show all courses (no filter applied)

    const courses = await elearningService.getCourses(req.user!.schoolId, filters);
    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single course (with access control)
router.get("/courses/:id", async (req, res) => {
  try {
    const course = await elearningService.getCourseById(req.params.id, req.user!.schoolId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // SECURITY: Students can only access published courses they're enrolled in
    if (req.user?.role === "student") {
      if (course.status !== "published") {
        return res.status(403).json({ error: "Course not available" });
      }
      const isEnrolled = await checkEnrollment(course.id, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    res.json(course);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create course (teachers and admins)
router.post("/courses", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      thumbnailUrl: z.string().optional(),
    });

    const data = schema.parse(req.body);
    
    // Determine creator info and teacherId based on role
    let teacherId: string | null;
    let createdBy: string;
    let createdByRole: "admin" | "teacher";
    
    if (req.user?.role === "teacher") {
      // Teachers create courses under their own name
      teacherId = req.user.teacherId!;
      createdBy = req.user.teacherId!;
      createdByRole = "teacher";
    } else {
      // Admins create courses under their own name (admin ID)
      teacherId = null; // Admin-created courses don't have a teacherId
      createdBy = req.user!.id; // Use admin's user ID
      createdByRole = "admin";
    }

    const course = await elearningService.createCourse({
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      level: data.level,
      thumbnailUrl: data.thumbnailUrl,
      schoolId: req.user!.schoolId,
      teacherId,
      createdBy,
      createdByRole,
    });

    res.status(201).json(course);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update course
router.put("/courses/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const updated = await elearningService.updateCourse(
      req.params.id,
      req.user!.schoolId,
      req.body
    );
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Publish course
router.post("/courses/:id/publish", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const course = await elearningService.publishCourse(req.params.id, req.user!.schoolId);
    res.json(course);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete course
router.delete("/courses/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    await elearningService.deleteCourse(req.params.id, req.user!.schoolId);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// LESSONS
// ========================================

// Get lessons for a course (with enrollment check)
router.get("/courses/:courseId/lessons", async (req, res) => {
  try {
    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(req.params.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    const lessons = await elearningService.getLessons(req.params.courseId);
    res.json(lessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single lesson (with enrollment check)
router.get("/lessons/:id", async (req, res) => {
  try {
    console.log(`[LESSON] GET /lessons/${req.params.id} - courseId from query:`, req.query.courseId);
    
    if (!req.query.courseId) {
      return res.status(400).json({ error: "courseId query parameter is required" });
    }
    
    const lesson = await elearningService.getLessonById(req.params.id, req.query.courseId as string);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(lesson.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    res.json(lesson);
  } catch (error: any) {
    console.error(`[LESSON] Error fetching lesson ${req.params.id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create lesson
router.post("/courses/:courseId/lessons", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const schema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      duration: z.number().optional(),
      orderIndex: z.number().optional(),
    });

    const data = schema.parse(req.body);
    const lesson = await elearningService.createLesson({
      ...data,
      courseId: req.params.courseId,
    });

    res.status(201).json(lesson);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update lesson
router.put("/lessons/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const updated = await elearningService.updateLesson(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete lesson
router.delete("/lessons/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    await elearningService.deleteLesson(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create lesson block
router.post("/lessons/:lessonId/blocks", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const block = await elearningService.createLessonBlock({
      ...req.body,
      lessonId: req.params.lessonId,
    });
    res.status(201).json(block);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update lesson block
router.patch("/blocks/:blockId", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const updated = await elearningService.updateLessonBlock(req.params.blockId, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete lesson block
router.delete("/blocks/:blockId", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    await elearningService.deleteLessonBlock(req.params.blockId);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Mark lesson as complete (students with enrollment check)
router.post("/lessons/:id/complete", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    // SECURITY: Verify enrollment before marking complete
    const isEnrolled = await checkEnrollment(req.body.courseId, req.user.studentId!);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    await elearningService.markLessonComplete(
      req.body.courseId,
      req.user!.studentId!,
      req.params.id
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================
// QUIZZES
// ========================================

// Get quizzes for a course (with enrollment check)
router.get("/courses/:courseId/quizzes", async (req, res) => {
  try {
    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(req.params.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    const quizzes = await elearningService.getQuizzes(req.params.courseId);
    res.json(quizzes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single quiz (with enrollment check)
router.get("/quizzes/:id", async (req, res) => {
  try {
    const quiz = await elearningService.getQuizById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(quiz.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    res.json(quiz);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create quiz
router.post("/courses/:courseId/quizzes", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const quiz = await elearningService.createQuiz({
      ...req.body,
      courseId: req.params.courseId,
    });
    res.status(201).json(quiz);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add question to quiz
router.post("/quizzes/:quizId/questions", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const question = await elearningService.createQuizQuestion({
      ...req.body,
      quizId: req.params.quizId,
    });
    res.status(201).json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start quiz attempt (students with enrollment check)
router.post("/quizzes/:id/start", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const quiz = await elearningService.getQuizById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // SECURITY: Verify enrollment
    const isEnrolled = await checkEnrollment(quiz.courseId, req.user.studentId!);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    const attempt = await elearningService.startQuizAttempt(
      req.params.id,
      req.user!.studentId!
    );
    res.json(attempt);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit quiz attempt (students)
router.post("/quiz-attempts/:id/submit", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const result = await elearningService.submitQuizAttempt(req.params.id, req.body.answers);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get student attempts
router.get("/quizzes/:quizId/attempts", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const attempts = await elearningService.getStudentQuizAttempts(
      req.user!.studentId!,
      req.params.quizId
    );
    res.json(attempts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ASSIGNMENTS
// ========================================

// Get assignments for a course (with enrollment check)
router.get("/courses/:courseId/assignments", async (req, res) => {
  try {
    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(req.params.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    const assignments = await elearningService.getAssignments(req.params.courseId);
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single assignment (with enrollment check)
router.get("/assignments/:id", async (req, res) => {
  try {
    const assignment = await elearningService.getAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // SECURITY: Verify student enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(assignment.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create assignment
router.post("/courses/:courseId/assignments", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const assignment = await elearningService.createAssignment({
      ...req.body,
      courseId: req.params.courseId,
    });
    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Submit assignment (students with enrollment check)
router.post("/assignments/:id/submit", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const assignment = await elearningService.getAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // SECURITY: Verify enrollment
    const isEnrolled = await checkEnrollment(assignment.courseId, req.user.studentId!);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    const submission = await elearningService.submitAssignment({
      assignmentId: req.params.id,
      studentId: req.user!.studentId!,
      submissionText: req.body.submissionText,
      submissionFileUrl: req.body.submissionFileUrl,
    });
    res.json(submission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Grade assignment (teachers)
router.post("/assignment-submissions/:id/grade", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const graded = await elearningService.gradeAssignment(
      req.params.id,
      req.user!.teacherId || req.user!.id,
      req.body.score,
      req.body.feedback
    );
    res.json(graded);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get submissions for an assignment (teachers)
router.get("/assignments/:id/submissions", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const submissions = await elearningService.getAssignmentSubmissions(req.params.id);
    res.json(submissions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student's own submission (with enrollment check)
router.get("/assignments/:id/my-submission", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const assignment = await elearningService.getAssignmentById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    // SECURITY: Verify enrollment
    const isEnrolled = await checkEnrollment(assignment.courseId, req.user.studentId!);
    if (!isEnrolled) {
      return res.status(403).json({ error: "Not enrolled in this course" });
    }

    const submission = await elearningService.getStudentSubmission(
      req.params.id,
      req.user!.studentId!
    );
    res.json(submission || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ENROLLMENT
// ========================================

// Enroll student in course
router.post("/courses/:id/enroll", async (req, res) => {
  try {
    // SECURITY: Verify course is published before enrollment
    const course = await elearningService.getCourseById(req.params.id, req.user!.schoolId);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    if (course.status !== "published") {
      return res.status(403).json({ error: "Cannot enroll in unpublished course" });
    }

    const studentId = req.user?.role === "student" 
      ? req.user.studentId!
      : req.body.studentId;

    const enrollment = await elearningService.enrollStudent(req.params.id, studentId);
    res.status(201).json(enrollment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get student enrollments
router.get("/my-courses", async (req, res) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const enrollments = await elearningService.getStudentEnrollments(req.user!.studentId!);
    res.json(enrollments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get course enrollments (teachers)
router.get("/courses/:id/enrollments", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const enrollments = await elearningService.getCourseEnrollments(req.params.id);
    res.json(enrollments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// PROGRESS
// ========================================

// Get student progress (with enrollment check)
router.get("/courses/:id/progress", async (req, res) => {
  try {
    const studentId = req.user?.role === "student"
      ? req.user.studentId!
      : req.query.studentId as string;

    // SECURITY: Verify enrollment
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(req.params.id, studentId);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }

    const progress = await elearningService.getStudentProgress(req.params.id, studentId);
    res.json(progress || { lessonsCompleted: 0, totalLessons: 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ANNOUNCEMENTS
// ========================================

// Get course announcements (enrolled students, teachers, admins)
router.get("/courses/:courseId/announcements", requireEnrollment, async (req, res) => {
  try {
    const announcements = await elearningService.getCourseAnnouncements(req.params.courseId);
    res.json(announcements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create announcement (teachers and admins with school/course ownership check)
router.post("/courses/:courseId/announcements", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    // SECURITY: Verify course belongs to user's school and teacher owns it
    const course = await elearningService.getCourseById(req.params.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Course not found or access denied" });
    }
    
    // SECURITY: Teachers can only create announcements in their own courses
    if (req.user?.role === "teacher" && course.teacherId !== req.user.teacherId) {
      return res.status(403).json({ error: "You can only create announcements in your own courses" });
    }
    
    const schema = z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      isPinned: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    
    const announcement = await elearningService.createAnnouncement({
      courseId: req.params.courseId,
      authorId: req.user!.id,
      ...data,
    });
    res.status(201).json(announcement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update announcement (teachers and admins with school/course ownership check)
router.put("/announcements/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    // SECURITY: First get announcement to verify access
    const announcement = await elearningService.getAnnouncementById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    
    // SECURITY: Verify announcement's course belongs to user's school
    const course = await elearningService.getCourseById(announcement.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // SECURITY: Teachers can only update announcements in their own courses
    if (req.user?.role === "teacher" && course.teacherId !== req.user.teacherId) {
      return res.status(403).json({ error: "You can only update announcements in your own courses" });
    }
    
    const updated = await elearningService.updateAnnouncement(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete announcement (teachers and admins with school/course ownership check)
router.delete("/announcements/:id", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    // SECURITY: First get announcement to verify access
    const announcement = await elearningService.getAnnouncementById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    
    // SECURITY: Verify announcement's course belongs to user's school
    const course = await elearningService.getCourseById(announcement.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // SECURITY: Teachers can only delete announcements in their own courses
    if (req.user?.role === "teacher" && course.teacherId !== req.user.teacherId) {
      return res.status(403).json({ error: "You can only delete announcements in your own courses" });
    }
    
    await elearningService.deleteAnnouncement(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DISCUSSIONS
// ========================================

// Get discussion threads (enrolled students, teachers, admins)
router.get("/courses/:courseId/discussions", requireEnrollment, async (req, res) => {
  try {
    const lessonId = req.query.lessonId as string | undefined;
    const threads = await elearningService.getDiscussionThreads(req.params.courseId, lessonId);
    res.json(threads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single thread (enrolled students, teachers, admins with school/enrollment check)
router.get("/discussions/:id", async (req, res) => {
  try {
    const thread = await elearningService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    // SECURITY: Verify thread belongs to user's school
    const course = await elearningService.getCourseById(thread.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // SECURITY: Students must be enrolled
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(thread.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }
    
    await elearningService.incrementThreadViews(req.params.id);
    res.json(thread);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create discussion thread (enrolled students, course teachers, admins with proper access control)
router.post("/courses/:courseId/discussions", async (req, res) => {
  try {
    // SECURITY: Verify course belongs to user's school
    const course = await elearningService.getCourseById(req.params.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Course not found or access denied" });
    }
    
    // SECURITY: Students must be enrolled, teachers must own course or be enrolled, admins have full access
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(req.params.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    } else if (req.user?.role === "teacher") {
      const ownsThisCourse = course.teacherId === req.user.teacherId;
      const isEnrolledAsStudent = await checkEnrollment(req.params.courseId, req.user.studentId || "");
      
      if (!ownsThisCourse && !isEnrolledAsStudent) {
        return res.status(403).json({ error: "You can only create discussions in courses you own or are enrolled in" });
      }
    }
    
    const schema = z.object({
      title: z.string().min(1),
      content: z.string().min(1),
      lessonId: z.string().uuid().optional(),
    });
    const data = schema.parse(req.body);
    
    const thread = await elearningService.createThread({
      courseId: req.params.courseId,
      authorId: req.user!.id,
      ...data,
    });
    res.status(201).json(thread);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add reply to thread (enrolled students, teachers, admins with school/enrollment check)
router.post("/discussions/:threadId/replies", async (req, res) => {
  try {
    // SECURITY: First get thread to verify access
    const thread = await elearningService.getThreadById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    // SECURITY: Verify thread belongs to user's school
    const course = await elearningService.getCourseById(thread.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // SECURITY: Students must be enrolled
    if (req.user?.role === "student") {
      const isEnrolled = await checkEnrollment(thread.courseId, req.user.studentId!);
      if (!isEnrolled) {
        return res.status(403).json({ error: "Not enrolled in this course" });
      }
    }
    
    const schema = z.object({
      content: z.string().min(1),
      isAnswer: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    
    const reply = await elearningService.addReply({
      threadId: req.params.threadId,
      authorId: req.user!.id,
      ...data,
    });
    res.status(201).json(reply);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark thread as resolved (teachers and admins with school/course ownership check)
router.put("/discussions/:id/resolve", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    // SECURITY: First get thread to verify access
    const thread = await elearningService.getThreadById(req.params.id);
    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }
    
    // SECURITY: Verify thread belongs to user's school and teacher owns the course
    const course = await elearningService.getCourseById(thread.courseId, req.user!.schoolId);
    if (!course) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // SECURITY: Teachers can only resolve threads in their own courses
    if (req.user?.role === "teacher" && course.teacherId !== req.user.teacherId) {
      return res.status(403).json({ error: "You can only resolve threads in your own courses" });
    }
    
    const schema = z.object({
      isResolved: z.boolean(),
    });
    const { isResolved } = schema.parse(req.body);
    
    const updated = await elearningService.markThreadResolved(req.params.id, isResolved);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// ANALYTICS
// ========================================

// Get course analytics (teachers and admins)
router.get("/courses/:id/analytics", async (req, res) => {
  if (req.user?.role !== "admin" && req.user?.role !== "teacher") {
    return res.status(403).json({ error: "Access denied" });
  }
  try {
    const analytics = await elearningService.getCourseAnalytics(req.params.id);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
