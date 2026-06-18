CREATE TYPE "public"."media_capture_verification" AS ENUM('verified', 'unverified', 'flagged');--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "location_accuracy_m" double precision;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "location_fix_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "is_location_simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "capture_verification" "media_capture_verification" DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "server_received_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "clock_skew_seconds" double precision;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "capture_signature" varchar(128);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "signed_at" timestamp with time zone;