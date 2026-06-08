/**
 * Servidor Principal - Sistema de Asistencia Facial
 * VERSIÓN POSTGRESQL
 *
 * Configuración de Express con:
 * - Middlewares de seguridad
 * - Conexión a PostgreSQL con Sequelize
 * - Rutas de API
 * - Manejo de errores
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Configuración de base de datos PostgreSQL
const { testConnection, syncDatabase } = require('./config/database');
const { User, Attendance } = require('./models/User.postgres');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARES
// ============================================

app.use(helmet());

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Demasiadas peticiones, intenta más tarde' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));

if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// ============================================
// CONEXIÓN A POSTGRESQL
// ============================================

const initializeDatabase = async () => {
    const connected = await testConnection();
    if (!connected) {
        console.error('No se pudo conectar a PostgreSQL');
        process.exit(1);
    }

    // Sincronizar modelos (en desarrollo)
    if (process.env.NODE_ENV === 'development') {
        await syncDatabase(false); // false = no borrar datos existentes
    }
};

// ============================================
// RUTAS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'PostgreSQL',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// --- AUTENTICACIÓN ---

// Registrar usuario con rostro
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, faceDescriptor, password } = req.body;

        // Verificar si ya existe
        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Crear usuario
        const user = await User.create({
            name,
            email,
            face_descriptor: faceDescriptor,
            password
        });

        res.status(201).json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// Login con rostro
app.post('/api/auth/login-face', async (req, res) => {
    try {
        const { faceDescriptor } = req.body;

        const match = await User.findByFace(faceDescriptor);

        if (!match) {
            return res.status(401).json({ error: 'Rostro no reconocido' });
        }

        if (match.user.isLocked()) {
            return res.status(423).json({ error: 'Cuenta bloqueada temporalmente' });
        }

        await match.user.successfulLogin();

        // Generar token JWT
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { id: match.user.id, email: match.user.email },
            process.env.JWT_SECRET || 'secret-key',
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: match.user.id,
                name: match.user.name,
                email: match.user.email,
                role: match.user.role
            },
            confidence: match.confidence
        });
    } catch (error) {
        console.error('Error en login facial:', error);
        res.status(500).json({ error: 'Error en autenticación' });
    }
});

// --- ASISTENCIA ---

// Middleware de autenticación
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token no proporcionado' });
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Obtener asistencias del usuario
app.get('/api/attendance', authMiddleware, async (req, res) => {
    try {
        const attendances = await Attendance.findAll({
            where: { user_id: req.user.id },
            order: [['date', 'DESC']],
            limit: 100
        });

        res.json({ records: attendances });
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo asistencias' });
    }
});

// Marcar asistencia
app.post('/api/attendance/mark', authMiddleware, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Verificar si ya marcó hoy
        const existing = await Attendance.findOne({
            where: {
                user_id: req.user.id,
                date: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow
                }
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Ya marcaste asistencia hoy' });
        }

        // Crear registro
        await Attendance.create({
            user_id: req.user.id,
            date: new Date(),
            type: 'entrada'
        });

        res.json({ success: true, message: 'Asistencia marcada' });
    } catch (error) {
        res.status(500).json({ error: 'Error marcando asistencia' });
    }
});

// --- USUARIOS (Admin) ---

app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: ['id', 'name', 'email', 'role', 'is_active', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    }
});

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

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

const startServer = async () => {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`
    ================================================
    🚀 Servidor de Autenticación Facial (PostgreSQL)
    ================================================
    📍 Puerto: ${PORT}
    🌐 URL: http://localhost:${PORT}
    📊 API: http://localhost:${PORT}/api
    🐘 DB: PostgreSQL
    ================================================
        `);
    });
};

startServer();

module.exports = app;
