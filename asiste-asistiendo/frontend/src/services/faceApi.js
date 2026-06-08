/**
 * Servicio de Face API
 *
 * Maneja la integración con face-api.js para:
 * - Carga de modelos pre-entrenados
 * - Detección de rostros
 * - Extracción de descriptores faciales
 * - Comparación de rostros
 */
import * as faceapi from 'face-api.js';

// URL base para los modelos (CDN público)
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Cargar modelos de face-api.js
 *
 * Modelos necesarios:
 * - tinyFaceDetector: Detección rápida de rostros
 * - faceLandmark68Net: 68 puntos de referencia facial
 * - faceRecognitionNet: Generación de descriptores (128 valores)
 */
export const loadModels = async () => {
    try {
        console.log('Cargando modelos de face-api.js...');

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
        ]);

        console.log('Modelos cargados correctamente');
        return true;
    } catch (error) {
        console.error('Error cargando modelos:', error);
        throw new Error('No se pudieron cargar los modelos de reconocimiento facial');
    }
};

/**
 * Detectar rostro en imagen/video
 *
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} input
 * @returns {Object|null} Detección con landmarks y expresiones
 */
export const detectFace = async (input) => {
    const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5
    });

    const detection = await faceapi
        .detectSingleFace(input, options)
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withFaceExpressions();

    return detection || null;
};

/**
 * Extraer descriptor facial
 *
 * El descriptor es un array de 128 números que representa
 * las características únicas del rostro. Se usa para comparar
 * y reconocer rostros.
 *
 * @param {HTMLImageElement|HTMLVideoElement} input
 * @returns {Float32Array|null} Descriptor de 128 valores
 */
export const extractDescriptor = async (input) => {
    const detection = await detectFace(input);

    if (!detection) {
        console.log('No se detectó ningún rostro');
        return null;
    }

    // Verificar calidad de la detección
    if (detection.detection.score < 0.7) {
        console.log('Detección de baja calidad:', detection.detection.score);
        return null;
    }

    return detection.descriptor;
};

/**
 * Comparar dos descriptores faciales
 *
 * Usa distancia euclidiana para determinar similitud.
 * Valores típicos:
 * - < 0.4: Muy probable misma persona
 * - 0.4-0.6: Posible misma persona
 * - > 0.6: Probablemente diferente persona
 *
 * @param {Float32Array} descriptor1
 * @param {Float32Array} descriptor2
 * @returns {Object} { distance, isMatch, confidence }
 */
export const compareFaces = (descriptor1, descriptor2) => {
    if (!descriptor1 || !descriptor2) {
        return { distance: Infinity, isMatch: false, confidence: 0 };
    }

    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);

    // Umbral de coincidencia
    const THRESHOLD = 0.5;
    const isMatch = distance < THRESHOLD;

    // Calcular confianza (0-100%)
    const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));

    return {
        distance: distance.toFixed(4),
        isMatch,
        confidence: confidence.toFixed(1)
    };
};

/**
 * Encontrar mejor coincidencia en lista de descriptores
 *
 * @param {Float32Array} queryDescriptor - Descriptor a buscar
 * @param {Array} labeledDescriptors - Array de {label, descriptor}
 * @returns {Object|null} Mejor coincidencia o null
 */
export const findBestMatch = (queryDescriptor, labeledDescriptors) => {
    if (!queryDescriptor || !labeledDescriptors.length) {
        return null;
    }

    let bestMatch = null;
    let minDistance = Infinity;

    for (const { label, descriptor } of labeledDescriptors) {
        const result = compareFaces(queryDescriptor, descriptor);

        if (result.isMatch && result.distance < minDistance) {
            minDistance = result.distance;
            bestMatch = {
                label,
                distance: result.distance,
                confidence: result.confidence
            };
        }
    }

    return bestMatch;
};

/**
 * Dibujar detecciones en canvas
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} detection - Resultado de detectFace
 * @param {Object} options - Opciones de visualización
 */
export const drawDetection = (canvas, detection, options = {}) => {
    const {
        boxColor = '#00ff00',
        landmarkColor = '#00ff00',
        drawLandmarks = true,
        drawExpressions = true
    } = options;

    if (!detection) return;

    const ctx = canvas.getContext('2d');
    const { box } = detection.detection;

    // Dibujar caja
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Dibujar landmarks
    if (drawLandmarks && detection.landmarks) {
        ctx.fillStyle = landmarkColor;
        detection.landmarks.positions.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    // Mostrar expresión dominante
    if (drawExpressions && detection.expressions) {
        const expressions = detection.expressions;
        const dominant = Object.entries(expressions)
            .sort((a, b) => b[1] - a[1])[0];

        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.fillText(
            `${dominant[0]}: ${(dominant[1] * 100).toFixed(0)}%`,
            box.x,
            box.y - 5
        );
    }
};

export default {
    loadModels,
    detectFace,
    extractDescriptor,
    compareFaces,
    findBestMatch,
    drawDetection
};
