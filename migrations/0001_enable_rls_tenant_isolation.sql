-- Migration: Enable Row-Level Security for Analytics Tenant Isolation
-- Date: 2025-01-23
-- Purpose: Bulletproof multi-tenant isolation for analytics queries

-- Enable Row-Level Security on all analytics tables
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitutions ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies for tables with direct school_id
CREATE POLICY tenant_isolation_teachers ON teachers 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY tenant_isolation_students ON students 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY tenant_isolation_classes ON classes 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY tenant_isolation_subjects ON subjects 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY tenant_isolation_teacher_attendance ON teacher_attendance 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

CREATE POLICY tenant_isolation_student_attendance ON student_attendance 
  USING (school_id = current_setting('app.current_school_id', true)::uuid);

-- Create tenant isolation policies for tables using JOINs

-- For timetable_entries: filter by class.school_id  
CREATE POLICY tenant_isolation_timetable_entries ON timetable_entries 
  USING (EXISTS (
    SELECT 1 FROM classes 
    WHERE classes.id = timetable_entries.class_id 
    AND classes.school_id = current_setting('app.current_school_id', true)::uuid
  ));

-- For substitutions: filter by original teacher's school_id
CREATE POLICY tenant_isolation_substitutions ON substitutions 
  USING (EXISTS (
    SELECT 1 FROM teachers 
    WHERE teachers.id = substitutions.original_teacher_id 
    AND teachers.school_id = current_setting('app.current_school_id', true)::uuid
  ));