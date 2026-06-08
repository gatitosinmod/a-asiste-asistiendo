/**
 * Modelo de Usuario
 *
 * Schema de MongoDB para usuarios del sistema de asistencia facial.
 * Almacena:
 * - Datos básicos del usuario
 * - Descriptor facial (128 valores Float32)
 * - Historial de asistencias
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Datos básicos
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],
        trim: true,
        minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
        maxlength: [100, 'El nombre no puede exceder 100 caracteres']
    },

    email: {
        type: String,
        required: [true, 'El email es requerido'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },

    // Descriptor facial - array de 128 números
    // Generado por face-api.js, único para cada rostro
    faceDescriptor: {
        type: [Number],
        required: [true, 'El descriptor facial es requerido'],
        validate: {
            validator: function(arr) {
                return arr.length === 128;
            },
            message: 'El descriptor facial debe tener exactamente 128 valores'
        }
    },

    // Contraseña opcional (backup si falla reconocimiento facial)
    password: {
        type: String,
        select: false, // No incluir en queries por defecto
        minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
    },

    // Rol del usuario
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },

    // Estado de la cuenta
    isActive: {
        type: Boolean,
        default: true
    },

    // Historial de asistencias
    attendanceHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['entrada', 'salida'],
            default: 'entrada'
        },
        location: {
            type: String,
            default: 'principal'
        }
    }],

    // Metadatos
    lastLogin: {
        type: Date
    },

    failedLoginAttempts: {
        type: Number,
        default: 0
    },

    lockUntil: {
        type: Date
    }
}, {
    timestamps: true // createdAt, updatedAt automáticos
});

// ============================================
// ÍNDICES
// ============================================

userSchema.index({ email: 1 });
userSchema.index({ 'attendanceHistory.date': -1 });

// ============================================
// MÉTODOS DE INSTANCIA
// ============================================

/**
 * Comparar descriptor facial
 *
 * Calcula la distancia euclidiana entre dos descriptores.
 * Menor distancia = mayor similitud.
 *
 * @param {Array<number>} otherDescriptor
 * @returns {Object} { distance, isMatch }
 */
userSchema.methods.compareFace = function(otherDescriptor) {
    if (!otherDescriptor || otherDescriptor.length !== 128) {
        return { distance: Infinity, isMatch: false };
    }

    // Calcular distancia euclidiana
    let sum = 0;
    for (let i = 0; i < 128; i++) {
        const diff = this.faceDescriptor[i] - otherDescriptor[i];
        sum += diff * diff;
    }
    const distance = Math.sqrt(sum);

    // Umbral de coincidencia (ajustable)
    const THRESHOLD = 0.5;

    return {
        distance: distance.toFixed(4),
        isMatch: distance < THRESHOLD,
        confidence: Math.max(0, (1 - distance) * 100).toFixed(1)
    };
};

/**
 * Verificar si la cuenta está bloqueada
 */
userSchema.methods.isLocked = function() {
    return this.lockUntil && this.lockUntil > Date.now();
};

/**
 * Incrementar intentos fallidos de login
 */
userSchema.methods.incrementLoginAttempts = async function() {
    // Resetear si el bloqueo ya expiró
    if (this.lockUntil && this.lockUntil < Date.now()) {
        await this.updateOne({
            $set: { failedLoginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
        return;
    }

    // Incrementar intentos
    const updates = { $inc: { failedLoginAttempts: 1 } };

    // Bloquear después de 5 intentos fallidos
    if (this.failedLoginAttempts + 1 >= 5) {
        updates.$set = {
            lockUntil: Date.now() + 15 * 60 * 1000 // 15 minutos
        };
    }

    await this.updateOne(updates);
};

/**
 * Registrar login exitoso
 */
userSchema.methods.successfulLogin = async function() {
    await this.updateOne({
        $set: { lastLogin: new Date() },
        $unset: { failedLoginAttempts: 1, lockUntil: 1 }
    });
};

// ============================================
// MÉTODOS ESTÁTICOS
// ============================================

/**
 * Buscar usuario por descriptor facial
 *
 * Compara el descriptor proporcionado con todos los usuarios
 * y retorna el que tenga la menor distancia (mejor coincidencia).
 *
 * @param {Array<number>} descriptor
 * @returns {Object|null} Usuario encontrado o null
 */
userSchema.statics.findByFace = async function(descriptor) {
    if (!descriptor || descriptor.length !== 128) {
        return null;
    }

    const users = await this.find({ isActive: true });

    let bestMatch = null;
    let minDistance = Infinity;

    for (const user of users) {
        const result = user.compareFace(descriptor);

        if (result.isMatch && parseFloat(result.distance) < minDistance) {
            minDistance = parseFloat(result.distance);
            bestMatch = {
                user,
                distance: result.distance,
                confidence: result.confidence
            };
        }
    }

    return bestMatch;
};

// ============================================
// HOOKS
// ============================================

// Hash de contraseña antes de guardar
userSchema.pre('save', async function(next) {
    if (this.password && this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

// Método para comparar contraseña
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
