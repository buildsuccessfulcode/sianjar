CREATE TYPE "public"."attendance_status" AS ENUM('SAKIT', 'IZIN', 'ALPA', 'DISPENSASI');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('ACTIVE', 'COMPLETED', 'GRADUATED', 'TRANSFERRED', 'DROPPED_OUT');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('L', 'P');--> statement-breakpoint
CREATE TYPE "public"."promotion_action" AS ENUM('PROMOTE', 'RETAIN', 'GRADUATE', 'TRANSFERRED', 'DROPPED_OUT');--> statement-breakpoint
CREATE TYPE "public"."promotion_batch_status" AS ENUM('DRAFT', 'COMMITTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'GURU', 'WAKA_KURIKULUM');--> statement-breakpoint
CREATE TYPE "public"."semester_name" AS ENUM('GANJIL', 'GENAP');--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"nip" varchar(30),
	"expertise_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "academic_years_date_check" CHECK ("academic_years"."end_date" >= "academic_years"."start_date")
);
--> statement-breakpoint
CREATE TABLE "class_promotion_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_class_id" uuid NOT NULL,
	"to_class_id" uuid,
	"academic_year_from_id" uuid NOT NULL,
	"academic_year_to_id" uuid NOT NULL,
	"action" "promotion_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"grade_level" integer NOT NULL,
	"section" varchar(10) NOT NULL,
	"homeroom_teacher_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "classes_grade_level_check" CHECK ("classes"."grade_level" BETWEEN 7 AND 12)
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "promotion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_academic_year_id" uuid NOT NULL,
	"to_academic_year_id" uuid NOT NULL,
	"status" "promotion_batch_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"committed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" "semester_name" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "semesters_date_check" CHECK ("semesters"."end_date" >= "semesters"."start_date")
);
--> statement-breakpoint
CREATE TABLE "student_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'ACTIVE' NOT NULL,
	"promotion_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nisn" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"gender" "gender" NOT NULL,
	"birth_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "teacher_subjects" (
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	CONSTRAINT "teacher_subjects_teacher_id_subject_id_pk" PRIMARY KEY("teacher_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status" NOT NULL,
	"note" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_id" uuid NOT NULL,
	"date" date NOT NULL,
	"teacher_id" uuid NOT NULL,
	"material" text NOT NULL,
	"activity" text NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semester_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"period_start" smallint NOT NULL,
	"period_end" smallint NOT NULL,
	"room" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_period" CHECK ("schedules"."period_end" >= "schedules"."period_start"),
	CONSTRAINT "chk_day_of_week" CHECK ("schedules"."day_of_week" BETWEEN 1 AND 7)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_promotion_rules" ADD CONSTRAINT "class_promotion_rules_from_class_id_classes_id_fk" FOREIGN KEY ("from_class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_promotion_rules" ADD CONSTRAINT "class_promotion_rules_to_class_id_classes_id_fk" FOREIGN KEY ("to_class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_promotion_rules" ADD CONSTRAINT "class_promotion_rules_academic_year_from_id_academic_years_id_fk" FOREIGN KEY ("academic_year_from_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_promotion_rules" ADD CONSTRAINT "class_promotion_rules_academic_year_to_id_academic_years_id_fk" FOREIGN KEY ("academic_year_to_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_homeroom_teacher_id_users_id_fk" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_from_academic_year_id_academic_years_id_fk" FOREIGN KEY ("from_academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_to_academic_year_id_academic_years_id_fk" FOREIGN KEY ("to_academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_promotion_batch_id_promotion_batches_id_fk" FOREIGN KEY ("promotion_batch_id") REFERENCES "public"."promotion_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_user_role_uniq" ON "user_roles" USING btree ("user_id","role");--> statement-breakpoint
CREATE INDEX "user_roles_user_idx" ON "user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_name_unique" ON "academic_years" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "academic_years_single_active" ON "academic_years" USING btree ("is_active") WHERE "academic_years"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "class_promotion_rules_unique" ON "class_promotion_rules" USING btree ("from_class_id","academic_year_to_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_unique_slot" ON "classes" USING btree ("academic_year_id","department_id","grade_level","section");--> statement-breakpoint
CREATE INDEX "classes_year_idx" ON "classes" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "classes_department_idx" ON "classes" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_code_unique" ON "departments" USING btree ("code");--> statement-breakpoint
CREATE INDEX "promotion_batches_year_idx" ON "promotion_batches" USING btree ("from_academic_year_id","to_academic_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX "semesters_year_name_unique" ON "semesters" USING btree ("academic_year_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "semesters_single_active" ON "semesters" USING btree ("is_active") WHERE "semesters"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_student_year_unique" ON "student_enrollments" USING btree ("student_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "enrollments_class_idx" ON "student_enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "enrollments_year_idx" ON "student_enrollments" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_idx" ON "student_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "enrollments_batch_idx" ON "student_enrollments" USING btree ("promotion_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "students_nisn_unique" ON "students" USING btree ("nisn");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_unique" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE INDEX "teacher_subjects_subject_idx" ON "teacher_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_attendance_journal_student" ON "attendance_records" USING btree ("journal_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_journal" ON "attendance_records" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_student" ON "attendance_records" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_journal_schedule_date" ON "journals" USING btree ("schedule_id","date");--> statement-breakpoint
CREATE INDEX "idx_journals_date" ON "journals" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_journals_schedule_date" ON "journals" USING btree ("schedule_id","date");--> statement-breakpoint
CREATE INDEX "idx_journals_teacher" ON "journals" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_schedule_teacher_slot" ON "schedules" USING btree ("semester_id","teacher_id","day_of_week","period_start");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_schedule_class_slot" ON "schedules" USING btree ("semester_id","class_id","day_of_week","period_start");--> statement-breakpoint
CREATE INDEX "idx_schedules_teacher_sem_day" ON "schedules" USING btree ("teacher_id","semester_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_schedules_class_sem_day" ON "schedules" USING btree ("class_id","semester_id","day_of_week");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");