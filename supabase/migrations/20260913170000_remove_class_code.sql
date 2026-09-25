-- Migration: remove the obsolete code column from classes
ALTER TABLE classes DROP COLUMN IF EXISTS code;
