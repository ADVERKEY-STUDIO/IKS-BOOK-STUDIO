import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("book_projects", {
  id: text("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  title: text("title").notNull(),
  sourceName: text("source_name").notNull(),
  dataJson: text("data_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("book_projects_owner_updated_idx").on(table.ownerKey, table.updatedAt)]);

export const projectVersions = sqliteTable("book_project_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  ownerKey: text("owner_key").notNull(),
  label: text("label").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("book_versions_project_created_idx").on(table.projectId, table.createdAt)]);

export const designerPreferences = sqliteTable("designer_preferences", {
  ownerKey: text("owner_key").primaryKey(),
  preferencesJson: text("preferences_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
