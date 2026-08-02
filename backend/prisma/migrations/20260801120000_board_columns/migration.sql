-- AlterTable
ALTER TABLE "boards" ADD COLUMN "columns" TEXT[] NOT NULL DEFAULT ARRAY['todo', 'in-progress', 'done']::TEXT[];
