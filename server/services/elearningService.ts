import { db } from "../db";
import {
  courses,
  courseCategories,
  courseMemberships,
  lessons,
  lessonBlocks,
  lessonResources,
  quizzes,
  quizQuestions,
  quizQuestionOptions,
  quizAttempts,
  quizAnswers,
  assignments,
  assignmentSubmissions,
  studentProgress,
  progressEvents,
  courseAnnouncements,
  discussionThreads,
  discussionReplies,
  coursePrerequisites,
  students,
  teachers,
  users,
} from "../../shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export class ELearningService {
  // ========================================
  // COURSE MANAGEMENT
  // ========================================

  async getCourses(schoolId: string, filters?: { status?: string; teacherId?: string }) {
    let conditions: any[] = [eq(courses.schoolId, schoolId)];
    
    if (filters?.status) {
      conditions.push(eq(courses.status, filters.status as any));
    }
    if (filters?.teacherId) {
      conditions.push(eq(courses.teacherId, filters.teacherId));
    }

    return await db.query.courses.findMany({
      where: and(...conditions),
      with: {
        teacher: {
          columns: { id: true, name: true, email: true },
        },
        category: true,
      },
      orderBy: [desc(courses.createdAt)],
    });
  }

  async getCourseById(courseId: string, schoolId: string) {
    return await db.query.courses.findFirst({
      where: and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)),
      with: {
        teacher: {
          columns: { id: true, name: true, email: true },
        },
        category: true,
      },
    });
  }

  async createCourse(data: {
    schoolId: string;
    teacherId: string | null;
    title: string;
    description?: string;
    categoryId?: string;
    level?: string;
    thumbnailUrl?: string;
    createdBy: string;
    createdByRole: "admin" | "teacher";
  }) {
    const [course] = await db.insert(courses).values({
      ...data,
      status: "draft",
    }).returning();
    
    return course;
  }

  async updateCourse(courseId: string, schoolId: string, updates: any) {
    const [updated] = await db
      .update(courses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .returning();
    
    return updated;
  }

  async publishCourse(courseId: string, schoolId: string) {
    const [updated] = await db
      .update(courses)
      .set({
        status: "published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)))
      .returning();
    
    return updated;
  }

  async deleteCourse(courseId: string, schoolId: string) {
    await db
      .delete(courses)
      .where(and(eq(courses.id, courseId), eq(courses.schoolId, schoolId)));
  }

  // ========================================
  // LESSON MANAGEMENT
  // ========================================

  async getLessons(courseId: string) {
    return await db.query.lessons.findMany({
      where: eq(lessons.courseId, courseId),
      orderBy: [lessons.orderIndex],
    });
  }

  async getLessonById(lessonId: string, courseId: string) {
    return await db.query.lessons.findFirst({
      where: and(eq(lessons.id, lessonId), eq(lessons.courseId, courseId)),
      with: {
        blocks: {
          orderBy: [lessonBlocks.orderIndex],
        },
      },
    });
  }

  async createLesson(data: {
    courseId: string;
    title: string;
    description?: string;
    duration?: number;
    orderIndex?: number;
  }) {
    // Get max order index for the course
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${lessons.orderIndex}), -1)` })
      .from(lessons)
      .where(eq(lessons.courseId, data.courseId));
    
    const nextOrder = (maxOrder[0]?.max ?? -1) + 1;

    const [lesson] = await db.insert(lessons).values({
      ...data,
      orderIndex: data.orderIndex ?? nextOrder,
      status: "draft",
    }).returning();
    
    return lesson;
  }

  async updateLesson(lessonId: string, updates: any) {
    const [updated] = await db
      .update(lessons)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, lessonId))
      .returning();
    
    return updated;
  }

  async deleteLesson(lessonId: string) {
    await db.delete(lessons).where(eq(lessons.id, lessonId));
  }

  // ========================================
  // LESSON BLOCKS MANAGEMENT
  // ========================================

  async createLessonBlock(data: {
    lessonId: string;
    blockType: "text" | "video" | "image" | "document" | "quiz";
    content: any;
    orderIndex?: number;
  }) {
    // Get max order index for the lesson
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${lessonBlocks.orderIndex}), -1)` })
      .from(lessonBlocks)
      .where(eq(lessonBlocks.lessonId, data.lessonId));
    
    const nextOrder = (maxOrder[0]?.max ?? -1) + 1;

    const [block] = await db.insert(lessonBlocks).values({
      ...data,
      orderIndex: data.orderIndex ?? nextOrder,
    }).returning();
    
    return block;
  }

  async updateLessonBlock(blockId: string, updates: any) {
    const [updated] = await db
      .update(lessonBlocks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(lessonBlocks.id, blockId))
      .returning();
    
    return updated;
  }

  async deleteLessonBlock(blockId: string) {
    await db.delete(lessonBlocks).where(eq(lessonBlocks.id, blockId));
  }

  // ========================================
  // QUIZ MANAGEMENT
  // ========================================

  async getQuizzes(courseId: string) {
    return await db.query.quizzes.findMany({
      where: eq(quizzes.courseId, courseId),
      with: {
        lesson: {
          columns: { id: true, title: true },
        },
      },
    });
  }

  async getQuizById(quizId: string) {
    return await db.query.quizzes.findFirst({
      where: eq(quizzes.id, quizId),
      with: {
        questions: {
          with: {
            options: true,
          },
          orderBy: [quizQuestions.orderIndex],
        },
      },
    });
  }

  async createQuiz(data: {
    courseId: string;
    lessonId?: string;
    title: string;
    description?: string;
    passingScore?: number;
    timeLimit?: number;
    maxAttempts?: number;
    showCorrectAnswers?: boolean;
  }) {
    const [quiz] = await db.insert(quizzes).values({
      ...data,
      status: "draft",
    }).returning();
    
    return quiz;
  }

  async updateQuiz(quizId: string, updates: any) {
    const [updated] = await db
      .update(quizzes)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(quizzes.id, quizId))
      .returning();
    
    return updated;
  }

  async deleteQuiz(quizId: string) {
    await db.delete(quizzes).where(eq(quizzes.id, quizId));
  }

  async createQuizQuestion(data: {
    quizId: string;
    questionText: string;
    questionType: "single_choice" | "multiple_choice" | "true_false" | "short_answer";
    points?: number;
    explanation?: string;
    options?: Array<{ optionText: string; isCorrect: boolean }>;
  }) {
    // Get max order index for the quiz
    const maxOrder = await db
      .select({ max: sql<number>`COALESCE(MAX(${quizQuestions.orderIndex}), -1)` })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, data.quizId));
    
    const nextOrder = (maxOrder[0]?.max ?? -1) + 1;

    const [question] = await db.insert(quizQuestions).values({
      quizId: data.quizId,
      questionText: data.questionText,
      questionType: data.questionType,
      points: data.points || 1,
      explanation: data.explanation,
      orderIndex: nextOrder,
    }).returning();

    // Create options if provided
    if (data.options && data.options.length > 0) {
      await db.insert(quizQuestionOptions).values(
        data.options.map((opt, idx) => ({
          questionId: question.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          orderIndex: idx,
        }))
      );
    }
    
    return question;
  }

  // ========================================
  // QUIZ ATTEMPTS & GRADING
  // ========================================

  async startQuizAttempt(quizId: string, studentId: string) {
    // Check attempt limit
    const quiz = await this.getQuizById(quizId);
    if (!quiz) throw new Error("Quiz not found");

    if (quiz.maxAttempts) {
      const attempts = await db.query.quizAttempts.findMany({
        where: and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.studentId, studentId)
        ),
      });

      if (attempts.length >= quiz.maxAttempts) {
        throw new Error("Maximum attempts reached");
      }
    }

    // Calculate max score
    const questions = await db.query.quizQuestions.findMany({
      where: eq(quizQuestions.quizId, quizId),
    });
    const maxScore = questions.reduce((sum, q) => sum + (q.points || 1), 0);

    const [attempt] = await db.insert(quizAttempts).values({
      quizId,
      studentId,
      maxScore,
    }).returning();
    
    return attempt;
  }

  async submitQuizAttempt(
    attemptId: string,
    answers: Array<{
      questionId: string;
      selectedOptions?: string[];
      textAnswer?: string;
    }>
  ) {
    // Get attempt and quiz details
    const attempt = await db.query.quizAttempts.findFirst({
      where: eq(quizAttempts.id, attemptId),
      with: {
        quiz: {
          with: {
            questions: {
              with: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) throw new Error("Attempt not found");
    if (attempt.submittedAt) throw new Error("Already submitted");

    let totalScore = 0;
    const quizAnswersData: any[] = [];

    // Grade each answer
    for (const answer of answers) {
      const question = attempt.quiz.questions.find((q: any) => q.id === answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let pointsEarned = 0;

      if (question.questionType === "single_choice") {
        const correctOption = question.options.find((opt: any) => opt.isCorrect);
        isCorrect = answer.selectedOptions?.[0] === correctOption?.id;
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.questionType === "multiple_choice") {
        const correctOptionIds = question.options
          .filter((opt: any) => opt.isCorrect)
          .map((opt: any) => opt.id)
          .sort();
        const selectedSorted = (answer.selectedOptions || []).sort();
        isCorrect = JSON.stringify(correctOptionIds) === JSON.stringify(selectedSorted);
        pointsEarned = isCorrect ? question.points : 0;
      } else if (question.questionType === "true_false") {
        const correctOption = question.options.find((opt: any) => opt.isCorrect);
        isCorrect = answer.selectedOptions?.[0] === correctOption?.id;
        pointsEarned = isCorrect ? question.points : 0;
      }
      // Short answer questions need manual grading

      totalScore += pointsEarned;

      quizAnswersData.push({
        attemptId,
        questionId: answer.questionId,
        selectedOptions: answer.selectedOptions,
        textAnswer: answer.textAnswer,
        isCorrect: question.questionType === "short_answer" ? null : isCorrect,
        pointsEarned: question.questionType === "short_answer" ? null : pointsEarned.toString(),
      });
    }

    // Save all answers
    await db.insert(quizAnswers).values(quizAnswersData);

    // Calculate time spent
    const startTime = new Date(attempt.startedAt).getTime();
    const endTime = Date.now();
    const timeSpent = Math.floor((endTime - startTime) / 1000); // seconds

    // Update attempt with score
    const passed = totalScore >= (attempt.quiz.passingScore || 60);
    
    const [updatedAttempt] = await db
      .update(quizAttempts)
      .set({
        score: totalScore.toString(),
        passed,
        submittedAt: new Date(),
        timeSpent,
      })
      .where(eq(quizAttempts.id, attemptId))
      .returning();

    return updatedAttempt;
  }

  async getStudentQuizAttempts(studentId: string, quizId: string) {
    return await db.query.quizAttempts.findMany({
      where: and(
        eq(quizAttempts.studentId, studentId),
        eq(quizAttempts.quizId, quizId)
      ),
      orderBy: [desc(quizAttempts.startedAt)],
    });
  }

  // ========================================
  // ASSIGNMENT MANAGEMENT
  // ========================================

  async getAssignments(courseId: string) {
    return await db.query.assignments.findMany({
      where: eq(assignments.courseId, courseId),
      with: {
        lesson: {
          columns: { id: true, title: true },
        },
      },
      orderBy: [desc(assignments.createdAt)],
    });
  }

  async getAssignmentById(assignmentId: string) {
    return await db.query.assignments.findFirst({
      where: eq(assignments.id, assignmentId),
    });
  }

  async createAssignment(data: {
    courseId: string;
    lessonId?: string;
    title: string;
    description?: string;
    instructions?: string;
    dueDate?: Date;
    maxScore?: number;
    allowLateSubmissions?: boolean;
  }) {
    const [assignment] = await db.insert(assignments).values({
      ...data,
      status: "draft",
    }).returning();
    
    return assignment;
  }

  async updateAssignment(assignmentId: string, updates: any) {
    const [updated] = await db
      .update(assignments)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, assignmentId))
      .returning();
    
    return updated;
  }

  async deleteAssignment(assignmentId: string) {
    await db.delete(assignments).where(eq(assignments.id, assignmentId));
  }

  // ========================================
  // ASSIGNMENT SUBMISSIONS
  // ========================================

  async submitAssignment(data: {
    assignmentId: string;
    studentId: string;
    submissionText?: string;
    submissionFileUrl?: string;
  }) {
    // Check if submission already exists
    const existing = await db.query.assignmentSubmissions.findFirst({
      where: and(
        eq(assignmentSubmissions.assignmentId, data.assignmentId),
        eq(assignmentSubmissions.studentId, data.studentId)
      ),
    });

    if (existing) {
      // Update existing submission
      const [updated] = await db
        .update(assignmentSubmissions)
        .set({
          submissionText: data.submissionText,
          submissionFileUrl: data.submissionFileUrl,
          status: "submitted",
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(assignmentSubmissions.id, existing.id))
        .returning();
      
      return updated;
    } else {
      // Create new submission
      const [submission] = await db.insert(assignmentSubmissions).values({
        ...data,
        status: "submitted",
        submittedAt: new Date(),
      }).returning();
      
      return submission;
    }
  }

  async gradeAssignment(
    submissionId: string,
    gradedBy: string,
    score: number,
    feedback?: string
  ) {
    const [graded] = await db
      .update(assignmentSubmissions)
      .set({
        score: score.toString(),
        feedback,
        gradedBy,
        status: "graded",
        gradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();
    
    return graded;
  }

  async getAssignmentSubmissions(assignmentId: string) {
    return await db.query.assignmentSubmissions.findMany({
      where: eq(assignmentSubmissions.assignmentId, assignmentId),
      with: {
        student: {
          columns: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
      orderBy: [desc(assignmentSubmissions.submittedAt)],
    });
  }

  async getStudentSubmission(assignmentId: string, studentId: string) {
    return await db.query.assignmentSubmissions.findFirst({
      where: and(
        eq(assignmentSubmissions.assignmentId, assignmentId),
        eq(assignmentSubmissions.studentId, studentId)
      ),
    });
  }

  // ========================================
  // STUDENT ENROLLMENT
  // ========================================

  async enrollStudent(courseId: string, studentId: string) {
    // Check if already enrolled
    const existing = await db.query.courseMemberships.findFirst({
      where: and(
        eq(courseMemberships.courseId, courseId),
        eq(courseMemberships.studentId, studentId)
      ),
    });

    if (existing) {
      throw new Error("Student already enrolled");
    }

    const [enrollment] = await db.insert(courseMemberships).values({
      courseId,
      studentId,
      progressPercentage: 0,
    }).returning();
    
    return enrollment;
  }

  async unenrollStudent(courseId: string, studentId: string) {
    await db
      .delete(courseMemberships)
      .where(
        and(
          eq(courseMemberships.courseId, courseId),
          eq(courseMemberships.studentId, studentId)
        )
      );
  }

  async getStudentEnrollments(studentId: string) {
    return await db.query.courseMemberships.findMany({
      where: eq(courseMemberships.studentId, studentId),
      with: {
        course: {
          with: {
            teacher: {
              columns: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [desc(courseMemberships.enrolledAt)],
    });
  }

  async getCourseEnrollments(courseId: string) {
    return await db.query.courseMemberships.findMany({
      where: eq(courseMemberships.courseId, courseId),
      with: {
        student: {
          columns: { id: true, firstName: true, lastName: true, admissionNumber: true },
        },
      },
      orderBy: [desc(courseMemberships.enrolledAt)],
    });
  }

  // ========================================
  // PROGRESS TRACKING
  // ========================================

  async recordProgressEvent(data: {
    courseId: string;
    studentId: string;
    lessonId?: string;
    eventType: "lesson_start" | "lesson_complete" | "quiz_attempt" | "assignment_submit" | "resource_download";
    metadata?: any;
  }) {
    await db.insert(progressEvents).values(data);
  }

  async markLessonComplete(courseId: string, studentId: string, lessonId: string) {
    // Record progress event
    await this.recordProgressEvent({
      courseId,
      studentId,
      lessonId,
      eventType: "lesson_complete",
    });

    // Update student progress
    await this.updateStudentProgress(courseId, studentId);
  }

  async updateStudentProgress(courseId: string, studentId: string) {
    // Get total lessons in course
    const totalLessons = await db
      .select({ count: sql<number>`count(*)` })
      .from(lessons)
      .where(eq(lessons.courseId, courseId));

    // Get completed lessons
    const completedLessons = await db
      .select({ count: sql<number>`count(distinct ${progressEvents.lessonId})` })
      .from(progressEvents)
      .where(
        and(
          eq(progressEvents.courseId, courseId),
          eq(progressEvents.studentId, studentId),
          eq(progressEvents.eventType, "lesson_complete")
        )
      );

    // Get quiz stats
    const quizStats = await db
      .select({
        count: sql<number>`count(*)`,
        avgScore: sql<number>`avg(cast(${quizAttempts.score} as numeric))`,
      })
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.studentId, studentId),
          sql`${quizAttempts.quizId} IN (SELECT id FROM ${quizzes} WHERE ${quizzes.courseId} = ${courseId})`
        )
      );

    // Get assignment stats
    const assignmentStats = await db
      .select({ count: sql<number>`count(*)` })
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.studentId, studentId),
          eq(assignmentSubmissions.status, "graded"),
          sql`${assignmentSubmissions.assignmentId} IN (SELECT id FROM ${assignments} WHERE ${assignments.courseId} = ${courseId})`
        )
      );

    const progressPercentage = Math.floor(
      ((completedLessons[0]?.count || 0) / (totalLessons[0]?.count || 1)) * 100
    );

    // Upsert student progress
    const existing = await db.query.studentProgress.findFirst({
      where: and(
        eq(studentProgress.courseId, courseId),
        eq(studentProgress.studentId, studentId)
      ),
    });

    if (existing) {
      await db
        .update(studentProgress)
        .set({
          lessonsCompleted: Number(completedLessons[0]?.count || 0),
          totalLessons: Number(totalLessons[0]?.count || 0),
          quizzesCompleted: Number(quizStats[0]?.count || 0),
          averageQuizScore: quizStats[0]?.avgScore?.toString(),
          assignmentsCompleted: Number(assignmentStats[0]?.count || 0),
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentProgress.id, existing.id));
    } else {
      await db.insert(studentProgress).values({
        courseId,
        studentId,
        lessonsCompleted: Number(completedLessons[0]?.count || 0),
        totalLessons: Number(totalLessons[0]?.count || 0),
        quizzesCompleted: Number(quizStats[0]?.count || 0),
        averageQuizScore: quizStats[0]?.avgScore?.toString(),
        assignmentsCompleted: Number(assignmentStats[0]?.count || 0),
        lastAccessedAt: new Date(),
      });
    }

    // Update course membership progress
    await db
      .update(courseMemberships)
      .set({
        progressPercentage,
        lastAccessedAt: new Date(),
      })
      .where(
        and(
          eq(courseMemberships.courseId, courseId),
          eq(courseMemberships.studentId, studentId)
        )
      );
  }

  async getStudentProgress(courseId: string, studentId: string) {
    return await db.query.studentProgress.findFirst({
      where: and(
        eq(studentProgress.courseId, courseId),
        eq(studentProgress.studentId, studentId)
      ),
    });
  }

  // ========================================
  // ANNOUNCEMENTS
  // ========================================

  async getCourseAnnouncements(courseId: string) {
    return await db.query.courseAnnouncements.findMany({
      where: eq(courseAnnouncements.courseId, courseId),
      with: {
        author: {
          columns: { id: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: [desc(courseAnnouncements.isPinned), desc(courseAnnouncements.createdAt)],
    });
  }

  async getAnnouncementById(announcementId: string) {
    return await db.query.courseAnnouncements.findFirst({
      where: eq(courseAnnouncements.id, announcementId),
      with: {
        author: {
          columns: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  async createAnnouncement(data: {
    courseId: string;
    authorId: string;
    title: string;
    content: string;
    isPinned?: boolean;
  }) {
    const [announcement] = await db.insert(courseAnnouncements).values(data).returning();
    return announcement;
  }

  async updateAnnouncement(announcementId: string, updates: any) {
    const [updated] = await db
      .update(courseAnnouncements)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(courseAnnouncements.id, announcementId))
      .returning();
    return updated;
  }

  async deleteAnnouncement(announcementId: string) {
    await db.delete(courseAnnouncements).where(eq(courseAnnouncements.id, announcementId));
  }

  // ========================================
  // DISCUSSIONS
  // ========================================

  async getDiscussionThreads(courseId: string, lessonId?: string) {
    let conditions: any[] = [eq(discussionThreads.courseId, courseId)];
    if (lessonId) {
      conditions.push(eq(discussionThreads.lessonId, lessonId));
    }

    return await db.query.discussionThreads.findMany({
      where: and(...conditions),
      with: {
        author: {
          columns: { id: true, firstName: true, lastName: true, role: true },
        },
        replies: {
          with: {
            author: {
              columns: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: [desc(discussionReplies.createdAt)],
          limit: 3,
        },
      },
      orderBy: [desc(discussionThreads.isPinned), desc(discussionThreads.createdAt)],
    });
  }

  async getThreadById(threadId: string) {
    return await db.query.discussionThreads.findFirst({
      where: eq(discussionThreads.id, threadId),
      with: {
        author: {
          columns: { id: true, firstName: true, lastName: true, role: true },
        },
        replies: {
          with: {
            author: {
              columns: { id: true, firstName: true, lastName: true, role: true },
            },
          },
          orderBy: [desc(discussionReplies.createdAt)],
        },
      },
    });
  }

  async createThread(data: {
    courseId: string;
    lessonId?: string;
    authorId: string;
    title: string;
    content: string;
  }) {
    const [thread] = await db.insert(discussionThreads).values(data).returning();
    return thread;
  }

  async addReply(data: {
    threadId: string;
    authorId: string;
    content: string;
    isAnswer?: boolean;
  }) {
    const [reply] = await db.insert(discussionReplies).values(data).returning();
    
    await db
      .update(discussionThreads)
      .set({
        replyCount: sql`${discussionThreads.replyCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(discussionThreads.id, data.threadId));

    return reply;
  }

  async markThreadResolved(threadId: string, isResolved: boolean) {
    const [updated] = await db
      .update(discussionThreads)
      .set({ isResolved, updatedAt: new Date() })
      .where(eq(discussionThreads.id, threadId))
      .returning();
    return updated;
  }

  async incrementThreadViews(threadId: string) {
    await db
      .update(discussionThreads)
      .set({ viewCount: sql`${discussionThreads.viewCount} + 1` })
      .where(eq(discussionThreads.id, threadId));
  }

  // ========================================
  // ANALYTICS
  // ========================================

  async getCourseAnalytics(courseId: string) {
    const enrollmentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(courseMemberships)
      .where(eq(courseMemberships.courseId, courseId));

    const avgProgress = await db
      .select({ avg: sql<number>`avg(${courseMemberships.progressPercentage})` })
      .from(courseMemberships)
      .where(eq(courseMemberships.courseId, courseId));

    const completionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(courseMemberships)
      .where(
        and(
          eq(courseMemberships.courseId, courseId),
          sql`${courseMemberships.completedAt} IS NOT NULL`
        )
      );

    return {
      totalEnrollments: Number(enrollmentCount[0]?.count || 0),
      averageProgress: Number(avgProgress[0]?.avg || 0),
      completions: Number(completionCount[0]?.count || 0),
    };
  }
}

export const elearningService = new ELearningService();
