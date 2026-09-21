import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { UPLOAD_DIRECTORY } from './services/fileService.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { testRouter } from './routes/testRoutes.js';
import { studentRouter } from './routes/studentRoutes.js';
import { uploadRouter } from './routes/uploadRoutes.js';
import { evalRouter } from './routes/evalRoutes.js';
import { resultRouter } from './routes/resultRoutes.js';
import { systemRouter } from './routes/systemRoutes.js';

export const app: Express = express();

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With']
}));

// Body parsers
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(UPLOAD_DIRECTORY));

// Mount Routers
app.use('/api', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/tests', testRouter);
app.use('/api/students', studentRouter);
app.use('/api', uploadRouter);
app.use('/api', evalRouter);
app.use('/api/results', resultRouter);
app.use('/api/system', systemRouter);

// Root health check endpoint
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    app: 'ScriptSense Backend',
    status: 'online',
    docs: '/docs'
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[SERVER ERROR]', err);
  const status = err.status || err.statusCode || 500;
  const detail = err.message || err.detail || 'Internal server error';
  res.status(status).json({ detail });
});
