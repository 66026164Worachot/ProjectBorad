import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import 'dotenv/config';

import apiAuthRoutes from './routes/apiAuthRoutes.js';
import apiProtectRoutes from './routes/apiProtectRoutes.js';
import apiUserRoutes from './routes/apiUserRoutes.js';
import apiMenuRoutes from './routes/apiMenuRoutes.js';
import apiReservationRoutes from './routes/apiReservationRoutes.js';
import apiDashboardRoutes from './routes/apiDashboardRoutes.js';
import apiPaymentRoutes from './routes/apiPaymentRoutes.js';
import apiBoardgameRoutes from './routes/apiBoardgameRoutes.js';
import apiWalletRoutes from './routes/apiWalletRoutes.js';


import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const swaggerPath = path.join(__dirname, 'docs', 'openapi.yaml');
let swaggerDocument;

try {
  const spec = readFileSync(swaggerPath, 'utf8');
  const parsed = yaml.load(spec);
  swaggerDocument = typeof parsed === 'object' && parsed ? parsed : null;
} catch (error) {
  console.error('Failed to load Swagger spec:', error);
  swaggerDocument = null;
}

if (!swaggerDocument) {
  swaggerDocument = {
    openapi: '3.0.3',
    info: {
      title: 'ProjectBorad API',
      version: '1.0.0',
      description: 'Swagger spec ไม่สามารถโหลดได้ ตรวจสอบไฟล์ docs/openapi.yaml'
    }
  };
}

// CORS Configuration - แก้ไขให้รองรับ DELETE และ PUT
const allowedDomains = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(domain => domain.trim())
  : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5173', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // อนุญาต requests ที่ไม่มี origin (เช่น Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedDomains.includes(origin)) {
      callback(null, true); // อนุญาต
    } else {
      callback(new Error('Not allowed by CORS')); // บล็อก
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // ⚠️ เพิ่ม DELETE, PUT, PATCH
  credentials: true, // รองรับ Cookie หรือ JWT Token
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Cache preflight request สำหรับ 24 ชั่วโมง
};

app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());
app.use(cors(corsOptions)); // ⚠️ ใช้ corsOptions ที่แก้ไขแล้ว
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: 'ProjectBorad API Docs'
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));
app.get('/api/docs/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

// Basic rate limit (especially for /api/auth/*)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/auth', authLimiter);

// Health & default
app.get('/', (req, res) => res.send('JWT + OAuth (mock) API is running'));
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Mount routes
app.use('/api/auth', apiAuthRoutes);
app.use('/api/protect', apiProtectRoutes);
app.use('/api/users', apiUserRoutes); 
app.use('/api/menu', apiMenuRoutes);
app.use('/api/reservations', apiReservationRoutes);
app.use('/api/dashboard', apiDashboardRoutes);
app.use('/api/payments', apiPaymentRoutes);
app.use('/api/boardgames', apiBoardgameRoutes);
app.use('/api/wallet', apiWalletRoutes);

// Global error handler (รวมการจัดการ CORS error)
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      ok: false, 
      error: { 
        code: 'CORS_BLOCKED', 
        message: 'Access denied: CORS policy does not allow this origin',
        origin: req.headers.origin || 'unknown'
      } 
    });
  }
  
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    ok: false, 
    error: { 
      code: 'INTERNAL_ERROR', 
      message: 'Something went wrong' 
    } 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Allowed CORS origins:`, allowedDomains.join(', '));
  console.log(`✅ CORS methods:`, corsOptions.methods.join(', '));
});
