/**
 * Modelo de Usuario - PostgreSQL/Sequelize
 *
 * Almacena:
 * - Datos básicos del usuario
 * - Descriptor facial (128 valores como ARRAY de FLOAT)
 * - Historial de asistencias (tabla relacionada)
 */
const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

class User extends Model {
    /**
     * Comparar descriptor facial
     * Calcula distancia euclidiana entre dos descriptores
     */
    compareFace(otherDescriptor) {
        if (!otherDescriptor || otherDescriptor.length !== 128) {
            return { distance: Infinity, isMatch: false };
        }

        // Calcular distancia euclidiana
        let sum = 0;
        for (let i = 0; i < 128; i++) {
            const diff = this.face_descriptor[i] - otherDescriptor[i];
            sum += diff * diff;
        }
        const distance = Math.sqrt(sum);

        // Umbral de coincidencia
        const THRESHOLD = 0.5;

        return {
            distance: distance.toFixed(4),
            isMatch: distance < THRESHOLD,
            confidence: Math.max(0, (1 - distance) * 100).toFixed(1)
        };
    }

    /**
     * Verificar si la cuenta está bloqueada
     */
    isLocked() {
        return this.lock_until && new Date(this.lock_until) > new Date();
    }

    /**
     * Incrementar intentos fallidos
     */
    async incrementLoginAttempts() {
        if (this.lock_until && new Date(this.lock_until) < new Date()) {
            await this.update({
                failed_login_attempts: 1,
                lock_until: null
            });
            return;
        }

        const updates = { failed_login_attempts: this.failed_login_attempts + 1 };

        // Bloquear después de 5 intentos
        if (this.failed_login_attempts + 1 >= 5) {
            updates.lock_until = new Date(Date.now() + 15 * 60 * 1000); // 15 min
        }

        await this.update(updates);
    }

    /**
     * Registrar login exitoso
     */
    async successfulLogin() {
        await this.update({
            last_login: new Date(),
            failed_login_attempts: 0,
            lock_until: null
        });
    }

    /**
     * Comparar contraseña
     */
    async comparePassword(candidatePassword) {
        if (!this.password) return false;
        return bcrypt.compare(candidatePassword, this.password);
    }

    /**
     * Buscar usuario por descriptor facial
     */
    static async findByFace(descriptor) {
        if (!descriptor || descriptor.length !== 128) {
            return null;
        }

        const users = await User.findAll({ where: { is_active: true } });

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
    }
}

User.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            len: [2, 100]
        }
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    // Descriptor facial - array de 128 floats
    face_descriptor: {
        type: DataTypes.ARRAY(DataTypes.FLOAT),
        allowNull: false,
        validate: {
            isValidDescriptor(value) {
                if (!value || value.length !== 128) {
                    throw new Error('El descriptor facial debe tener 128 valores');
                }
            }
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    failed_login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lock_until: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true,
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password') && user.password) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        }
    }
});

// Modelo de Historial de Asistencia
class Attendance extends Model {}

Attendance.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id'
        }
    },
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    type: {
        type: DataTypes.ENUM('entrada', 'salida'),
        defaultValue: 'entrada'
    },
    location: {
        type: DataTypes.STRING(100),
        defaultValue: 'principal'
    }
}, {
    sequelize,
    modelName: 'Attendance',
    tableName: 'attendance_history',
    timestamps: true,
    underscored: true
});

// Relaciones
User.hasMany(Attendance, { foreignKey: 'user_id', as: 'attendanceHistory' });
Attendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { User, Attendance };
