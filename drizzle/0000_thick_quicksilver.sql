CREATE TYPE "public"."account_provider" AS ENUM('email', 'google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('basic', 'pro', 'premium');--> statement-breakpoint
CREATE TYPE "public"."storage_add_on" AS ENUM('none', 'plus50', 'plus250', 'plus1tb');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'manager', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'active');--> statement-breakpoint
CREATE SEQUENCE "public"."row_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"provider" "account_provider" DEFAULT 'email' NOT NULL,
	"password_hash" text,
	"color_hex" varchar(9) DEFAULT '#13B5B1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" varchar(400),
	"ip" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"logo_file_name" varchar(255),
	"phone" varchar(64) DEFAULT '' NOT NULL,
	"email" varchar(320) DEFAULT '' NOT NULL,
	"website" varchar(512) DEFAULT '' NOT NULL,
	"owner_account_id" uuid NOT NULL,
	"plan_tier" "plan_tier" DEFAULT 'basic' NOT NULL,
	"trial_started_at" timestamp with time zone,
	"subscription_started_at" timestamp with time zone,
	"storage_add_on" "storage_add_on" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid,
	"name" varchar(200) NOT NULL,
	"phone_number" varchar(64) DEFAULT '' NOT NULL,
	"title" varchar(200) DEFAULT '' NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"color_hex" varchar(9) DEFAULT '#13B5B1' NOT NULL,
	"invite_code" varchar(16),
	"invite_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" bigint DEFAULT nextval('row_version_seq') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "project_members_project_id_member_id_pk" PRIMARY KEY("project_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_member_id_org_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."org_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_tokens_account_idx" ON "refresh_tokens" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_invite_code_idx" ON "org_members" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "org_members_org_idx" ON "org_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_members_account_idx" ON "org_members" USING btree ("account_id");