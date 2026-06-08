/**
 * Servidor - Sistema de Asistencia QR
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

app.use(cors());
app.use(express.json());

// Conexión MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qr-attendance')
    .then(() => console.log('✅ MongoDB conectado'))
    .catch(err => console.error('❌ Error MongoDB:', err));

// Modelo de Asistencia
const attendanceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sessionId: { type: String, required: true },
    scannedAt: { type: Date, default: Date.now },
    qrTimestamp: { type: Number, required: true },
    validated: { type: Boolean, default: true }
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

// Modelo de Usuario (simplificado)
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String
});

const User = mongoose.model('User', userSchema);

// Middleware de autenticación
const auth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'secreto');
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Rutas

// Generar sesión de QR (admin)
app.post('/api/qr/session', auth, (req, res) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    res.json({ sessionId, expiresIn: 60 });
});

// Validar escaneo de QR
app.post('/api/attendance/scan', auth, async (req, res) => {
    try {
        const { qrData, scannedAt } = req.body;

        // Verificar que el QR no tenga más de 90 segundos
        const age = scannedAt - qrData.timestamp;
        if (age > 90000) {
            return res.status(400).json({
                success: false,
                message: 'Código QR expirado'
            });
        }

        // Verificar que no haya marcado ya hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingAttendance = await Attendance.findOne({
            userId: req.user.id,
            scannedAt: { $gte: today }
        });

        if (existingAttendance) {
            return res.status(400).json({
                success: false,
                message: 'Ya marcaste asistencia hoy'
            });
        }

        // Registrar asistencia
        const attendance = new Attendance({
            userId: req.user.id,
            sessionId: qrData.session,
            scannedAt: new Date(scannedAt),
            qrTimestamp: qrData.timestamp
        });

        await attendance.save();

        res.json({
            success: true,
            message: '¡Asistencia registrada!',
            attendance: {
                date: attendance.scannedAt,
                session: attendance.sessionId
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error del servidor' });
    }
});

// Obtener historial de asistencias
app.get('/api/attendance/history', auth, async (req, res) => {
    const records = await Attendance.find({ userId: req.user.id })
        .sort({ scannedAt: -1 })
        .limit(30);

    res.json({ records });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 Servidor QR Attendance en http://localhost:${PORT}`);
});
