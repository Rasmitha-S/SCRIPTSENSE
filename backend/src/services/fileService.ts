import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { BASE_DIR } from '../database/index.js';

export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc', '.webp', '.bmp', '.tiff']);

function getUploadDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpUploadDir = path.join('/tmp', 'uploads');
    if (!fs.existsSync(tmpUploadDir)) {
      fs.mkdirSync(tmpUploadDir, { recursive: true });
    }
    return tmpUploadDir;
  }
  const uploadDir = path.join(BASE_DIR, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export const UPLOAD_DIRECTORY = getUploadDir();

// Multer in-memory storage for safe processing
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format '${ext}'. Allowed formats: PDF, JPG, JPEG, PNG, DOCX.`));
    }
  },
});

export function saveUploadedBuffer(buffer: Buffer, originalFilename: string, prefixId: string = ''): { relativePath: string; absolutePath: string } {
  const ext = path.extname(originalFilename).toLowerCase() || '.png';
  const cleanName = path.basename(originalFilename).replace(/\s+/g, '_');
  const targetFilename = prefixId ? `${prefixId}_${cleanName}` : `${Date.now()}_${cleanName}`;
  const destPath = path.join(UPLOAD_DIRECTORY, targetFilename);

  fs.writeFileSync(destPath, buffer);

  const relativePath = path.posix.join('uploads', targetFilename);
  return { relativePath, absolutePath: destPath };
}
