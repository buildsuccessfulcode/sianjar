CREATE TYPE "public"."time_slot_kind" AS ENUM('LESSON', 'BREAK', 'PRAYER');--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semester_id" uuid NOT NULL,
	"label" varchar(64) NOT NULL,
	"kind" time_slot_kind DEFAULT 'LESSON' NOT NULL,
	"period_number" smallint,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_time_slot_range" CHECK ("time_slots"."end_time" > "time_slots"."start_time"),
	CONSTRAINT "chk_time_slot_period" CHECK (("time_slots"."kind" = 'LESSON' AND "time_slots"."period_number" IS NOT NULL AND "time_slots"."period_number" BETWEEN 1 AND 20) OR ("time_slots"."kind" <> 'LESSON' AND "time_slots"."period_number" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_time_slots_semester" ON "time_slots" USING btree ("semester_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_time_slot_semester_period" ON "time_slots" USING btree ("semester_id","period_number") WHERE "time_slots"."period_number" IS NOT NULL;