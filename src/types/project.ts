/**
 * Type definitions for Project management
 *
 * Projects are simple folder locations where users save their work.
 * They can optionally link to existing series/books but don't create them.
 */

export interface Project {
  id: number;
  name: string;
  folder_path: string;
  author_id?: number | null;
  series_id?: number | null;
  book_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProjectData {
  name: string;
  folder_path: string;
  author_id?: number;
  series_id?: number;
  book_id?: number;
}

export interface UpdateProjectData {
  name?: string;
  folder_path?: string;
  author_id?: number | null;
  series_id?: number | null;
  book_id?: number | null;
}
