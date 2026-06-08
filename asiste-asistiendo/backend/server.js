/**
 * Servidor Principal - Sistema de Asistencia Facial
 *
 * Configuración de Express con:
 * - Middlewares de seguridad
 * - Conexión a MongoDB
 * - Rutas de API
 * - Manejo de errores
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Importar rutas
const authRoutes = require('./routes/auth');
const faceRoutes = require('./routes/face');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARES
// ============================================

// Seguridad HTTP headers
app.use(helmet());

// CORS - permitir frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

// Rate limiting - protección contra ataques de fuerza bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 peticiones por IP
    message: { error: 'Demasiadas peticiones, intenta más tarde' }
});
app.use('/api/', limiter);

// Parsear JSON (con límite para descriptores faciales)
app.use(express.json({ limit: '10mb' }));

// Logging en desarrollo
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// ============================================
// CONEXIÓN A BASE DE DATOS
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/facial-auth';

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('✅ Conectado a MongoDB');
    })
    .catch((err) => {
        console.error('❌ Error conectando a MongoDB:', err.message);
        process.exit(1);
    });

// ============================================
// RUTAS
// ============================================

// Ruta de health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de reconocimiento facial
app.use('/api/face', faceRoutes);

// Ruta de asistencia
app.get('/api/attendance', require('./middleware/authMiddleware'), async (req, res) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(req.user.id);
        res.json({ records: user.attendanceHistory || [] });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo asistencias' });
    }
});

app.post('/api/attendance/mark', require('./middleware/authMiddleware'), async (req, res) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(req.user.id);

        // Verificar si ya marcó hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alreadyMarked = user.attendanceHistory?.some(record => {
            const recordDate = new Date(record.date);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate.getTime() === today.getTime();
        });

        if (alreadyMarked) {
            return res.status(400).json({ error: 'Ya marcaste asistencia hoy' });
        }

        // Agregar registro
        user.attendanceHistory = user.attendanceHistory || [];
        user.attendanceHistory.push({ date: new Date() });
        await user.save();

        res.json({ success: true, message: 'Asistencia marcada' });
    } catch (error) {
        res.status(500).json({ error: 'Error marcando asistencia' });
    }
});

// ============================================
// MANEJO DE ERRORES
// ============================================

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Error interno del servidor'
            : err.message
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log(`
    ================================================
    🚀 Servidor de Autenticación Facial
    ================================================
    📍 Puerto: ${PORT}
    🌐 URL: http://localhost:${PORT}
    📊 API: http://localhost:${PORT}/api
    ================================================
    `);
});

module.exports = app;
