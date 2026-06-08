/**
 * Rutas de Autenticación
 *
 * Endpoints para:
 * - POST /register - Registrar nuevo usuario
 * - POST /login-face - Login con reconocimiento facial
 * - GET /verify - Verificar token JWT
 * - POST /logout - Cerrar sesión
 * - PUT /profile - Actualizar perfil
 * - PUT /face - Actualizar descriptor facial
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambiar_en_produccion';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

/**
 * Generar token JWT
 */
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
};

// ============================================
// REGISTRO
// ============================================

/**
 * POST /api/auth/register
 *
 * Registrar nuevo usuario con descriptor facial
 */
router.post('/register', [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
    body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
    body('faceDescriptor').isArray({ min: 128, max: 128 }).withMessage('Descriptor facial inválido')
], async (req, res) => {
    try {
        // Validar campos
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, email, faceDescriptor } = req.body;

        // Verificar si el email ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Este email ya está registrado'
            });
        }

        // Verificar que el rostro no esté ya registrado
        const faceMatch = await User.findByFace(faceDescriptor);
        if (faceMatch) {
            return res.status(400).json({
                success: false,
                message: 'Este rostro ya está registrado con otra cuenta'
            });
        }

        // Crear usuario
        const user = new User({
            name,
            email,
            faceDescriptor
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario'
        });
    }
});

// ============================================
// LOGIN CON ROSTRO
// ============================================

/**
 * POST /api/auth/login-face
 *
 * Autenticar usuario mediante descriptor facial
 */
router.post('/login-face', [
    body('faceDescriptor').isArray({ min: 128, max: 128 }).withMessage('Descriptor facial inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Descriptor facial inválido'
            });
        }

        const { faceDescriptor } = req.body;

        // Buscar usuario por rostro
        const match = await User.findByFace(faceDescriptor);

        if (!match) {
            return res.status(401).json({
                success: false,
                message: 'Rostro no reconocido. ¿Ya estás registrado?'
            });
        }

        const { user, confidence } = match;

        // Verificar si la cuenta está bloqueada
        if (user.isLocked()) {
            return res.status(423).json({
                success: false,
                message: 'Cuenta bloqueada temporalmente. Intenta más tarde.'
            });
        }

        // Verificar si la cuenta está activa
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Cuenta desactivada'
            });
        }

        // Registrar login exitoso
        await user.successfulLogin();

        // Generar token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: `¡Bienvenido, ${user.name}!`,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            confidence: `${confidence}%`
        });

    } catch (error) {
        console.error('Error en login facial:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el login'
        });
    }
});

// ============================================
// VERIFICAR TOKEN
// ============================================

/**
 * GET /api/auth/verify
 *
 * Verificar si el token JWT es válido
 */
router.get('/verify', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-faceDescriptor');

        if (!user || !user.isActive) {
            return res.status(401).json({ valid: false });
        }

        res.json({
            valid: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

// ============================================
// LOGOUT
// ============================================

/**
 * POST /api/auth/logout
 *
 * Cerrar sesión (principalmente para logging)
 */
router.post('/logout', authMiddleware, async (req, res) => {
    // En una implementación más robusta, aquí se invalidaría el token
    // (por ejemplo, agregándolo a una lista negra en Redis)
    res.json({
        success: true,
        message: 'Sesión cerrada'
    });
});

// ============================================
// ACTUALIZAR PERFIL
// ============================================

/**
 * PUT /api/auth/profile
 *
 * Actualizar datos del perfil
 */
router.put('/profile', authMiddleware, [
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
    body('email').optional().isEmail().normalizeEmail()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.email) {
            // Verificar que el nuevo email no esté en uso
            const existing = await User.findOne({
                email: req.body.email,
                _id: { $ne: req.user.id }
            });
            if (existing) {
                return res.status(400).json({
                    message: 'Este email ya está en uso'
                });
            }
            updates.email = req.body.email;
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        ).select('-faceDescriptor');

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando perfil' });
    }
});

// ============================================
// ACTUALIZAR ROSTRO
// ============================================

/**
 * PUT /api/auth/face
 *
 * Actualizar descriptor facial del usuario
 */
router.put('/face', authMiddleware, [
    body('faceDescriptor').isArray({ min: 128, max: 128 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: 'Descriptor facial inválido' });
        }

        const { faceDescriptor } = req.body;

        // Verificar que el nuevo rostro no esté registrado con otro usuario
        const match = await User.findByFace(faceDescriptor);
        if (match && match.user._id.toString() !== req.user.id) {
            return res.status(400).json({
                message: 'Este rostro ya está registrado con otra cuenta'
            });
        }

        await User.findByIdAndUpdate(req.user.id, { faceDescriptor });

        res.json({
            success: true,
            message: 'Rostro actualizado correctamente'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error actualizando rostro' });
    }
});

module.exports = router;
