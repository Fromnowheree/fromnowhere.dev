import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_services_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__services_v_published_locale" AS ENUM('en', 'hr');
  CREATE TYPE "public"."enum_capabilities_area" AS ENUM('design', 'build', 'security', 'operations');
  CREATE TYPE "public"."enum_capabilities_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__capabilities_v_version_area" AS ENUM('design', 'build', 'security', 'operations');
  CREATE TYPE "public"."enum__capabilities_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__capabilities_v_published_locale" AS ENUM('en', 'hr');
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" numeric DEFAULT 1,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_services_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "services_locales" (
  	"name" varchar,
  	"summary" varchar,
  	"text" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "services_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer
  );
  
  CREATE TABLE "_services_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_order" numeric DEFAULT 1,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__services_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__services_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_services_v_locales" (
  	"version_name" varchar,
  	"version_summary" varchar,
  	"version_text" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_services_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer
  );
  
  CREATE TABLE "capabilities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"area" "enum_capabilities_area" DEFAULT 'build',
  	"order" numeric DEFAULT 1,
  	"on_this_site" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_capabilities_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "capabilities_locales" (
  	"title" varchar,
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "capabilities_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer
  );
  
  CREATE TABLE "_capabilities_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_area" "enum__capabilities_v_version_area" DEFAULT 'build',
  	"version_order" numeric DEFAULT 1,
  	"version_on_this_site" boolean DEFAULT false,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__capabilities_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__capabilities_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_capabilities_v_locales" (
  	"version_title" varchar,
  	"version_text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_capabilities_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer
  );
  
  ALTER TABLE "projects_locales" ADD COLUMN "client" varchar;
  ALTER TABLE "projects_locales" ADD COLUMN "brief" jsonb;
  ALTER TABLE "projects_locales" ADD COLUMN "engineering" jsonb;
  ALTER TABLE "projects_locales" ADD COLUMN "outcome" jsonb;
  ALTER TABLE "projects_texts" ADD COLUMN "locale" "_locales";
  ALTER TABLE "_projects_v_locales" ADD COLUMN "version_client" varchar;
  ALTER TABLE "_projects_v_locales" ADD COLUMN "version_brief" jsonb;
  ALTER TABLE "_projects_v_locales" ADD COLUMN "version_engineering" jsonb;
  ALTER TABLE "_projects_v_locales" ADD COLUMN "version_outcome" jsonb;
  ALTER TABLE "_projects_v_texts" ADD COLUMN "locale" "_locales";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "services_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "capabilities_id" integer;
  ALTER TABLE "services_locales" ADD CONSTRAINT "services_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services_rels" ADD CONSTRAINT "services_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v" ADD CONSTRAINT "_services_v_parent_id_services_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_services_v_locales" ADD CONSTRAINT "_services_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_rels" ADD CONSTRAINT "_services_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_services_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_services_v_rels" ADD CONSTRAINT "_services_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_locales" ADD CONSTRAINT "capabilities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_rels" ADD CONSTRAINT "capabilities_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "capabilities_rels" ADD CONSTRAINT "capabilities_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v" ADD CONSTRAINT "_capabilities_v_parent_id_capabilities_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."capabilities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_capabilities_v_locales" ADD CONSTRAINT "_capabilities_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_rels" ADD CONSTRAINT "_capabilities_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_capabilities_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_capabilities_v_rels" ADD CONSTRAINT "_capabilities_v_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "services_slug_idx" ON "services" USING btree ("slug");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX "services__status_idx" ON "services" USING btree ("_status");
  CREATE UNIQUE INDEX "services_locales_locale_parent_id_unique" ON "services_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "services_locales_parent_id_idx" ON "services_locales" USING btree ("_parent_id");
  CREATE INDEX "services_rels_order_idx" ON "services_rels" USING btree ("order");
  CREATE INDEX "services_rels_parent_idx" ON "services_rels" USING btree ("parent_id");
  CREATE INDEX "services_rels_path_idx" ON "services_rels" USING btree ("path");
  CREATE INDEX "services_rels_projects_id_idx" ON "services_rels" USING btree ("projects_id");
  CREATE INDEX "_services_v_parent_idx" ON "_services_v" USING btree ("parent_id");
  CREATE INDEX "_services_v_version_version_slug_idx" ON "_services_v" USING btree ("version_slug");
  CREATE INDEX "_services_v_version_version_updated_at_idx" ON "_services_v" USING btree ("version_updated_at");
  CREATE INDEX "_services_v_version_version_created_at_idx" ON "_services_v" USING btree ("version_created_at");
  CREATE INDEX "_services_v_version_version__status_idx" ON "_services_v" USING btree ("version__status");
  CREATE INDEX "_services_v_created_at_idx" ON "_services_v" USING btree ("created_at");
  CREATE INDEX "_services_v_updated_at_idx" ON "_services_v" USING btree ("updated_at");
  CREATE INDEX "_services_v_snapshot_idx" ON "_services_v" USING btree ("snapshot");
  CREATE INDEX "_services_v_published_locale_idx" ON "_services_v" USING btree ("published_locale");
  CREATE INDEX "_services_v_latest_idx" ON "_services_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_services_v_locales_locale_parent_id_unique" ON "_services_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_services_v_locales_parent_id_idx" ON "_services_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_services_v_rels_order_idx" ON "_services_v_rels" USING btree ("order");
  CREATE INDEX "_services_v_rels_parent_idx" ON "_services_v_rels" USING btree ("parent_id");
  CREATE INDEX "_services_v_rels_path_idx" ON "_services_v_rels" USING btree ("path");
  CREATE INDEX "_services_v_rels_projects_id_idx" ON "_services_v_rels" USING btree ("projects_id");
  CREATE INDEX "capabilities_updated_at_idx" ON "capabilities" USING btree ("updated_at");
  CREATE INDEX "capabilities_created_at_idx" ON "capabilities" USING btree ("created_at");
  CREATE INDEX "capabilities__status_idx" ON "capabilities" USING btree ("_status");
  CREATE UNIQUE INDEX "capabilities_locales_locale_parent_id_unique" ON "capabilities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "capabilities_locales_parent_id_idx" ON "capabilities_locales" USING btree ("_parent_id");
  CREATE INDEX "capabilities_rels_order_idx" ON "capabilities_rels" USING btree ("order");
  CREATE INDEX "capabilities_rels_parent_idx" ON "capabilities_rels" USING btree ("parent_id");
  CREATE INDEX "capabilities_rels_path_idx" ON "capabilities_rels" USING btree ("path");
  CREATE INDEX "capabilities_rels_projects_id_idx" ON "capabilities_rels" USING btree ("projects_id");
  CREATE INDEX "_capabilities_v_parent_idx" ON "_capabilities_v" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_version_version_updated_at_idx" ON "_capabilities_v" USING btree ("version_updated_at");
  CREATE INDEX "_capabilities_v_version_version_created_at_idx" ON "_capabilities_v" USING btree ("version_created_at");
  CREATE INDEX "_capabilities_v_version_version__status_idx" ON "_capabilities_v" USING btree ("version__status");
  CREATE INDEX "_capabilities_v_created_at_idx" ON "_capabilities_v" USING btree ("created_at");
  CREATE INDEX "_capabilities_v_updated_at_idx" ON "_capabilities_v" USING btree ("updated_at");
  CREATE INDEX "_capabilities_v_snapshot_idx" ON "_capabilities_v" USING btree ("snapshot");
  CREATE INDEX "_capabilities_v_published_locale_idx" ON "_capabilities_v" USING btree ("published_locale");
  CREATE INDEX "_capabilities_v_latest_idx" ON "_capabilities_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_capabilities_v_locales_locale_parent_id_unique" ON "_capabilities_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_capabilities_v_locales_parent_id_idx" ON "_capabilities_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_capabilities_v_rels_order_idx" ON "_capabilities_v_rels" USING btree ("order");
  CREATE INDEX "_capabilities_v_rels_parent_idx" ON "_capabilities_v_rels" USING btree ("parent_id");
  CREATE INDEX "_capabilities_v_rels_path_idx" ON "_capabilities_v_rels" USING btree ("path");
  CREATE INDEX "_capabilities_v_rels_projects_id_idx" ON "_capabilities_v_rels" USING btree ("projects_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_capabilities_fk" FOREIGN KEY ("capabilities_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_texts_locale_parent" ON "projects_texts" USING btree ("locale","parent_id");
  CREATE INDEX "_projects_v_texts_locale_parent" ON "_projects_v_texts" USING btree ("locale","parent_id");
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_capabilities_id_idx" ON "payload_locked_documents_rels" USING btree ("capabilities_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "services_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "services_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_services_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_services_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_services_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "capabilities_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "capabilities_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_capabilities_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_capabilities_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_capabilities_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "services" CASCADE;
  DROP TABLE "services_locales" CASCADE;
  DROP TABLE "services_rels" CASCADE;
  DROP TABLE "_services_v" CASCADE;
  DROP TABLE "_services_v_locales" CASCADE;
  DROP TABLE "_services_v_rels" CASCADE;
  DROP TABLE "capabilities" CASCADE;
  DROP TABLE "capabilities_locales" CASCADE;
  DROP TABLE "capabilities_rels" CASCADE;
  DROP TABLE "_capabilities_v" CASCADE;
  DROP TABLE "_capabilities_v_locales" CASCADE;
  DROP TABLE "_capabilities_v_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_services_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_capabilities_fk";
  
  DROP INDEX "projects_texts_locale_parent";
  DROP INDEX "_projects_v_texts_locale_parent";
  DROP INDEX "payload_locked_documents_rels_services_id_idx";
  DROP INDEX "payload_locked_documents_rels_capabilities_id_idx";
  ALTER TABLE "projects_locales" DROP COLUMN "client";
  ALTER TABLE "projects_locales" DROP COLUMN "brief";
  ALTER TABLE "projects_locales" DROP COLUMN "engineering";
  ALTER TABLE "projects_locales" DROP COLUMN "outcome";
  ALTER TABLE "projects_texts" DROP COLUMN "locale";
  ALTER TABLE "_projects_v_locales" DROP COLUMN "version_client";
  ALTER TABLE "_projects_v_locales" DROP COLUMN "version_brief";
  ALTER TABLE "_projects_v_locales" DROP COLUMN "version_engineering";
  ALTER TABLE "_projects_v_locales" DROP COLUMN "version_outcome";
  ALTER TABLE "_projects_v_texts" DROP COLUMN "locale";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "services_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "capabilities_id";
  DROP TYPE "public"."enum_services_status";
  DROP TYPE "public"."enum__services_v_version_status";
  DROP TYPE "public"."enum__services_v_published_locale";
  DROP TYPE "public"."enum_capabilities_area";
  DROP TYPE "public"."enum_capabilities_status";
  DROP TYPE "public"."enum__capabilities_v_version_area";
  DROP TYPE "public"."enum__capabilities_v_version_status";
  DROP TYPE "public"."enum__capabilities_v_published_locale";`)
}
