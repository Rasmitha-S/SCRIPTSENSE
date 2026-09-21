import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { dbPath, queryOne } from '../database/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { UPLOAD_DIRECTORY } from '../services/fileService.js';

export const systemRouter = Router();

// GET /api/system/storage-status
systemRouter.get('/storage-status', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  let dbSizeKb = 0;
  if (fs.existsSync(dbPath)) {
    try {
      dbSizeKb = Math.round((fs.statSync(dbPath).size / 1024) * 100) / 100;
    } catch (e) {}
  }

  const studentCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students') || { count: 0 }).count;
  const sheetCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM answer_sheets') || { count: 0 }).count;
  const modelCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM model_answers') || { count: 0 }).count;
  const evalCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM evaluations') || { count: 0 }).count;
  const verifiedCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM final_results') || { count: 0 }).count;
  const userCount = (queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users') || { count: 0 }).count;

  let totalFiles = 0;
  let totalStorageMb = 0;

  if (fs.existsSync(UPLOAD_DIRECTORY)) {
    try {
      const files = fs.readdirSync(UPLOAD_DIRECTORY).filter(f => fs.statSync(path.join(UPLOAD_DIRECTORY, f)).isFile());
      totalFiles = files.length;
      const totalBytes = files.reduce((acc, f) => acc + fs.statSync(path.join(UPLOAD_DIRECTORY, f)).size, 0);
      totalStorageMb = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
    } catch (e) {}
  }

  res.json({
    status: 'Online & Healthy',
    database: {
      engine: 'SQLite Relational Storage',
      connection_status: 'Connected & Synchronized',
      database_file: dbPath,
      database_size_kb: dbSizeKb,
      tables: {
        users: userCount,
        students: studentCount,
        answer_sheets: sheetCount,
        model_answers: modelCount,
        evaluations: evalCount,
        final_results: verifiedCount
      }
    },
    storage: {
      storage_provider: 'Local Persistent Disk Storage',
      upload_directory: UPLOAD_DIRECTORY,
      total_files: totalFiles,
      storage_used_mb: totalStorageMb,
      allowed_formats: ['PDF', 'JPG', 'JPEG', 'PNG', 'DOCX']
    }
  });
});
