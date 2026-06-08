/**
 * Middleware de Autenticación
 *
 * Verifica el token JWT en las peticiones protegidas.
 * Extrae el ID del usuario y lo agrega a req.user
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambiar_en_produccion';

/**
 * Middleware de autenticación
 *
 * Uso:
 * router.get('/ruta-protegida', authMiddleware, (req, res) => {
 *   console.log(req.user.id); // ID del usuario autenticado
 * });
 */
const authMiddleware = (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'Token no proporcionado',
                code: 'NO_TOKEN'
            });
        }

        // Formato esperado: "Bearer <token>"
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                error: 'Formato de token inválido',
                code: 'INVALID_FORMAT'
            });
        }

        const token = parts[1];

        // Verificar y decodificar token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Agregar datos del usuario al request
        req.user = {
            id: decoded.id
        };

        // Token válido, continuar
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        console.error('Error en authMiddleware:', error);
        return res.status(500).json({
            error: 'Error de autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware opcional de autenticación
 *
 * No bloquea si no hay token, pero si hay uno válido,
 * agrega los datos del usuario.
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return next();
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return next();
        }

        const token = parts[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = { id: decoded.id };
        next();

    } catch (error) {
        // Token inválido, pero continuamos sin usuario
        next();
    }
};

/**
 * Middleware de rol admin
 *
 * Debe usarse después de authMiddleware
 */
const adminOnly = async (req, res, next) => {
    try {
        const User = require('../models/User');
        const user = await User.findById(req.user.id);

        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                error: 'Acceso denegado. Se requiere rol de administrador.',
                code: 'FORBIDDEN'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Error verificando permisos' });
    }
};

module.exports = authMiddleware;
module.exports.optionalAuth = optionalAuth;
module.exports.adminOnly = adminOnly;
