/**
 * Utilidades y helpers
 *
 * Funciones auxiliares para el sistema de asistencia facial
 */

/**
 * Formatear fecha a español
 *
 * @param {Date|string} date
 * @param {Object} options - Opciones de formato
 * @returns {string}
 */
export const formatDate = (date, options = {}) => {
    const d = new Date(date);
    const defaultOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    return d.toLocaleDateString('es-ES', defaultOptions);
};

/**
 * Formatear hora
 *
 * @param {Date|string} date
 * @returns {string}
 */
export const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Calcular días entre dos fechas
 *
 * @param {Date} date1
 * @param {Date} date2
 * @returns {number}
 */
export const daysBetween = (date1, date2) => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
};

/**
 * Verificar si es el mismo día
 *
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
export const isSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.toDateString() === d2.toDateString();
};

/**
 * Verificar si es hoy
 *
 * @param {Date|string} date
 * @returns {boolean}
 */
export const isToday = (date) => {
    return isSameDay(new Date(date), new Date());
};

/**
 * Generar ID único
 *
 * @returns {string}
 */
export const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Debounce - Limitar frecuencia de llamadas
 *
 * @param {Function} func
 * @param {number} wait - Milisegundos
 * @returns {Function}
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle - Ejecutar máximo una vez por intervalo
 *
 * @param {Function} func
 * @param {number} limit - Milisegundos
 * @returns {Function}
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Validar email
 *
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

/**
 * Capitalizar primera letra
 *
 * @param {string} str
 * @returns {string}
 */
export const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convertir imagen a base64
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
};

/**
 * Descargar datos como archivo
 *
 * @param {Object} data
 * @param {string} filename
 */
export const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Calcular porcentaje
 *
 * @param {number} value
 * @param {number} total
 * @returns {number}
 */
export const percentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
};

/**
 * Formatear bytes a unidades legibles
 *
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default {
    formatDate,
    formatTime,
    daysBetween,
    isSameDay,
    isToday,
    generateId,
    debounce,
    throttle,
    isValidEmail,
    capitalize,
    fileToBase64,
    downloadJson,
    percentage,
    formatBytes
};
