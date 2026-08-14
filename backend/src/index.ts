import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import telegramRoutes from './routes/telegram.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar trust proxy para Render
app.set('trust proxy', true);

// Configurar CORS para permitir requests desde el frontend
app.use(cors({
  origin: '*', // Permitir todos los orígenes (puedes restringir después)
  credentials: true
}));

app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/telegram', telegramRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📱 Telegram webhook: http://localhost:${PORT}/telegram/webhook`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/pin`);
  console.log(`📊 API: http://localhost:${PORT}/api/dashboard`);
});

export default app;
