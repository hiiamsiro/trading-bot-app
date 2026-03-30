-- Add isAdmin field to users table
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
