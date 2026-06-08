/**
 * Rutas de Reconocimiento Facial
 *
 * Endpoints auxiliares para operaciones faciales:
 * - POST /compare - Comparar dos descriptores
 * - POST /detect - Validar descriptor
 * - GET /stats - Estadísticas del sistema
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * POST /api/face/compare
 *
 * Comparar dos descriptores faciales
 * Útil para testing y debugging
 */
router.post('/compare', async (req, res) => {
    try {
        const { descriptor1, descriptor2 } = req.body;

        if (!descriptor1 || !descriptor2) {
            return res.status(400).json({
                error: 'Se requieren dos descriptores'
            });
        }

        if (descriptor1.length !== 128 || descriptor2.length !== 128) {
            return res.status(400).json({
                error: 'Los descriptores deben tener 128 valores'
            });
        }

        // Calcular distancia euclidiana
        let sum = 0;
        for (let i = 0; i < 128; i++) {
            const diff = descriptor1[i] - descriptor2[i];
            sum += diff * diff;
        }
        const distance = Math.sqrt(sum);

        const THRESHOLD = 0.5;
        const isMatch = distance < THRESHOLD;
        const confidence = Math.max(0, (1 - distance) * 100);

        res.json({
            distance: distance.toFixed(4),
            isMatch,
            confidence: confidence.toFixed(1) + '%',
            threshold: THRESHOLD,
            interpretation: isMatch
                ? 'Los rostros coinciden'
                : 'Los rostros NO coinciden'
        });

    } catch (error) {
        res.status(500).json({ error: 'Error comparando descriptores' });
    }
});

/**
 * POST /api/face/validate
 *
 * Validar que un descriptor tiene el formato correcto
 */
router.post('/validate', (req, res) => {
    try {
        const { descriptor } = req.body;

        const validation = {
            isArray: Array.isArray(descriptor),
            hasCorrectLength: descriptor?.length === 128,
            hasValidValues: descriptor?.every(v =>
                typeof v === 'number' && !isNaN(v) && isFinite(v)
            ),
            valueRange: descriptor ? {
                min: Math.min(...descriptor).toFixed(4),
                max: Math.max(...descriptor).toFixed(4),
                avg: (descriptor.reduce((a, b) => a + b, 0) / descriptor.length).toFixed(4)
            } : null
        };

        const isValid = validation.isArray &&
                        validation.hasCorrectLength &&
                        validation.hasValidValues;

        res.json({
            valid: isValid,
            validation,
            message: isValid
                ? 'Descriptor válido'
                : 'Descriptor inválido'
        });

    } catch (error) {
        res.status(500).json({ error: 'Error validando descriptor' });
    }
});

/**
 * GET /api/face/stats
 *
 * Obtener estadísticas del sistema (solo admin)
 */
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        const totalUsers = await User.countDocuments({ isActive: true });
        const totalAttendance = await User.aggregate([
            { $unwind: '$attendanceHistory' },
            { $count: 'total' }
        ]);

        // Asistencias de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const todayAttendance = await User.aggregate([
            { $unwind: '$attendanceHistory' },
            {
                $match: {
                    'attendanceHistory.date': {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            { $count: 'total' }
        ]);

        // Asistencias por día (última semana)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weeklyStats = await User.aggregate([
            { $unwind: '$attendanceHistory' },
            {
                $match: {
                    'attendanceHistory.date': { $gte: weekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$attendanceHistory.date'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            totalUsers,
            totalAttendance: totalAttendance[0]?.total || 0,
            todayAttendance: todayAttendance[0]?.total || 0,
            weeklyStats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

/**
 * POST /api/face/search
 *
 * Buscar usuario por descriptor facial (sin login)
 * Útil para verificar si un rostro ya está registrado
 */
router.post('/search', async (req, res) => {
    try {
        const { descriptor } = req.body;

        if (!descriptor || descriptor.length !== 128) {
            return res.status(400).json({
                error: 'Descriptor facial inválido'
            });
        }

        const match = await User.findByFace(descriptor);

        if (match) {
            res.json({
                found: true,
                message: 'Rostro encontrado en el sistema',
                confidence: match.confidence + '%',
                // No devolver datos sensibles del usuario
                hint: `Registrado como: ${match.user.name.charAt(0)}***`
            });
        } else {
            res.json({
                found: false,
                message: 'Rostro no registrado en el sistema'
            });
        }

    } catch (error) {
        res.status(500).json({ error: 'Error buscando rostro' });
    }
});

module.exports = router;
