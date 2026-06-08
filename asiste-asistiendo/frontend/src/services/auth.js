/**
 * Servicio de Autenticación
 *
 * Maneja la comunicación con el backend para:
 * - Login con reconocimiento facial
 * - Registro de nuevos usuarios
 * - Verificación de sesión
 * - Logout
 */
import axios from 'axios';

// Configurar base URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Crear instancia de axios con configuración
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);

/**
 * Login con descriptor facial
 *
 * Envía el descriptor al backend para buscar coincidencia
 * en la base de datos de usuarios registrados.
 *
 * @param {Array<number>} faceDescriptor - Array de 128 valores
 * @returns {Object} { success, user, token, message }
 */
export const login = async (faceDescriptor) => {
    try {
        const response = await api.post('/auth/login-face', {
            faceDescriptor
        });

        const { token, user } = response.data;

        // Guardar sesión
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        return {
            success: true,
            user,
            token
        };
    } catch (error) {
        const message = error.response?.data?.message || 'Error al iniciar sesión';
        return {
            success: false,
            message
        };
    }
};

/**
 * Registrar nuevo usuario
 *
 * @param {Object} userData - { name, email, faceDescriptor }
 * @returns {Object} { success, user, message }
 */
export const registerUser = async (userData) => {
    try {
        const response = await api.post('/auth/register', {
            name: userData.name,
            email: userData.email,
            faceDescriptor: userData.faceDescriptor
        });

        return {
            success: true,
            user: response.data.user,
            message: 'Usuario registrado exitosamente'
        };
    } catch (error) {
        const message = error.response?.data?.message || 'Error al registrar usuario';
        return {
            success: false,
            message
        };
    }
};

/**
 * Verificar sesión actual
 *
 * @returns {Object|null} Usuario actual o null
 */
export const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
        return null;
    }

    try {
        // Verificar que el token sigue siendo válido
        const response = await api.get('/auth/verify');

        if (response.data.valid) {
            return JSON.parse(storedUser);
        }

        // Token inválido, limpiar sesión
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
    } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
    }
};

/**
 * Cerrar sesión
 *
 * @returns {boolean} Éxito
 */
export const logout = async () => {
    try {
        await api.post('/auth/logout');
    } catch (error) {
        console.log('Error al cerrar sesión en servidor');
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    return true;
};

/**
 * Obtener usuario actual desde localStorage
 *
 * @returns {Object|null} Usuario actual
 */
export const getCurrentUser = () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};

/**
 * Actualizar perfil de usuario
 *
 * @param {Object} updates - Campos a actualizar
 * @returns {Object} { success, user, message }
 */
export const updateProfile = async (updates) => {
    try {
        const response = await api.put('/auth/profile', updates);

        const updatedUser = response.data.user;
        localStorage.setItem('user', JSON.stringify(updatedUser));

        return {
            success: true,
            user: updatedUser
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || 'Error actualizando perfil'
        };
    }
};

/**
 * Actualizar descriptor facial
 *
 * Permite al usuario actualizar su rostro registrado
 *
 * @param {Array<number>} newDescriptor
 * @returns {Object} { success, message }
 */
export const updateFaceDescriptor = async (newDescriptor) => {
    try {
        await api.put('/auth/face', {
            faceDescriptor: newDescriptor
        });

        return {
            success: true,
            message: 'Rostro actualizado correctamente'
        };
    } catch (error) {
        return {
            success: false,
            message: error.response?.data?.message || 'Error actualizando rostro'
        };
    }
};

export default {
    login,
    registerUser,
    checkAuth,
    logout,
    getCurrentUser,
    updateProfile,
    updateFaceDescriptor
};
