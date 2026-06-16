CREATE TYPE "public"."media_type" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TYPE "public"."photo_source" AS ENUM('camera', 'imported');--> statement-breakpoint
CREATE TYPE "public"."before_after_layout" AS ENUM('sideBySide', 'stacked');--> statement-breakpoint
CREATE TYPE "public"."report_layout" AS ENUM('onePerPage', 'twoPerPage', 'fourPerPage');--> statement-breakpoint
CREATE TYPE "public"."measure_unit" AS ENUM('meters', 'feet');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('taskAssigned', 'checklistAssigned', 'mention', 'comment');--> statement-breakpoint
CREATE TABLE "project_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"color_hex" varchar(9) DEFAULT '#1B98E0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" varchar(512) DEFAULT '' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"notes" text DEFAULT '' NOT NULL,
	"cover_photo_id" uuid,
	"label_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"color_hex" varchar(9) DEFAULT '#13B5B1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"author_member_id" uuid,
	"text" text DEFAULT '' NOT NULL,
	"mention_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"author_member_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"file_name" varchar(255) DEFAULT '' NOT NULL,
	"thumbnail_file_name" varchar(255) DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"annotation_data" jsonb,
	"source" "photo_source" DEFAULT 'camera' NOT NULL,
	"media_type" "media_type" DEFAULT 'photo' NOT NULL,
	"duration_seconds" double precision,
	"tag_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"assignee_member_id" uuid,
	"title" varchar(300) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"due_date" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"attached_photo_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_member_id" uuid,
	"text" text DEFAULT '' NOT NULL,
	"mention_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"photo_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"item_titles" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"assignee_member_id" uuid,
	"name" varchar(200) NOT NULL,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "before_after_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"before_photo_id" uuid NOT NULL,
	"after_photo_id" uuid NOT NULL,
	"layout" "before_after_layout" DEFAULT 'sideBySide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"photo_ids" uuid[] DEFAULT '{}' NOT NULL,
	"photo_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"layout" "report_layout" DEFAULT 'onePerPage' NOT NULL,
	"includes_checklist_summary" boolean DEFAULT false NOT NULL,
	"pdf_file_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"author_member_id" uuid,
	"title" varchar(200) DEFAULT '' NOT NULL,
	"content_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"pdf_file_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unit" "measure_unit" DEFAULT 'meters' NOT NULL,
	"segments_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_meters" double precision DEFAULT 0 NOT NULL,
	"snapshot_photo_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_member_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"task_id" uuid,
	"checklist_id" uuid,
	"photo_id" uuid,
	"project_id" uuid,
	"body_snippet" text DEFAULT '' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_labels" ADD CONSTRAINT "project_labels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_label_id_project_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."project_labels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_author_member_id_org_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_author_member_id_org_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_member_id_org_members_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_member_id_org_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_assignee_member_id_org_members_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "before_after_pairs" ADD CONSTRAINT "before_after_pairs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "before_after_pairs" ADD CONSTRAINT "before_after_pairs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_author_member_id_org_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_recipient_member_id_org_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."org_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_actor_member_id_org_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."org_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_labels_org_rowver_idx" ON "project_labels" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "projects_org_rowver_idx" ON "projects" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "tags_org_rowver_idx" ON "tags" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "photo_comments_org_rowver_idx" ON "photo_comments" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "photo_comments_photo_idx" ON "photo_comments" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "photos_org_rowver_idx" ON "photos" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "photos_project_idx" ON "photos" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_org_rowver_idx" ON "project_tasks" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "project_tasks_project_idx" ON "project_tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_comments_org_rowver_idx" ON "task_comments" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "checklist_items_org_rowver_idx" ON "checklist_items" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_idx" ON "checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "checklist_templates_org_rowver_idx" ON "checklist_templates" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "checklists_org_rowver_idx" ON "checklists" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "checklists_project_idx" ON "checklists" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "before_after_pairs_org_rowver_idx" ON "before_after_pairs" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "before_after_pairs_project_idx" ON "before_after_pairs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reports_org_rowver_idx" ON "reports" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "reports_project_idx" ON "reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "pages_org_rowver_idx" ON "pages" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "pages_project_idx" ON "pages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "measurements_org_rowver_idx" ON "measurements" USING btree ("organization_id","row_version");--> statement-breakpoint
CREATE INDEX "measurements_project_idx" ON "measurements" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "app_notifications_recipient_rowver_idx" ON "app_notifications" USING btree ("recipient_member_id","row_version");--> statement-breakpoint
CREATE INDEX "app_notifications_org_rowver_idx" ON "app_notifications" USING btree ("organization_id","row_version");--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_members_member_idx" ON "project_members" USING btree ("member_id");