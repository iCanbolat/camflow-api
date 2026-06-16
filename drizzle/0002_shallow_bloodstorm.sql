CREATE TYPE "public"."media_processing_status" AS ENUM('pending', 'queued', 'processing', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "processing_status" "media_processing_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "raw_object_key" varchar(512);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "processed_object_key" varchar(512);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "thumbnail_object_key" varchar(512);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "watermarked_object_key" varchar(512);--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "byte_size" bigint;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "processing_error" text;