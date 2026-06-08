import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { detectFace, extractDescriptor, compareFaces } from '../../services/faceApi.js';
import { registerUser } from '../../services/auth.js';

/**
 * Componente FaceRecognition
 *
 * Maneja la detección y reconocimiento facial en tiempo real.
 * Utiliza face-api.js para:
 * - Detección de rostros
 * - Extracción de landmarks (puntos faciales)
 * - Generación de descriptores faciales (128 valores únicos)
 * - Comparación de rostros
 */
const FaceRecognition = ({ mode, onLogin, onError }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [detecting, setDetecting] = useState(false);
    const [faceDetected, setFaceDetected] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [registerData, setRegisterData] = useState({ name: '', email: '' });
    const [capturedDescriptor, setCapturedDescriptor] = useState(null);
    const detectionIntervalRef = useRef(null);

    // Iniciar cámara
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user', width: 480, height: 360 }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (err) {
                onError('No se pudo acceder a la cámara');
            }
        };
        startCamera();

        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, []);

    // Detección continua de rostros
    useEffect(() => {
        if (!detecting) return;

        detectionIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Ajustar canvas al tamaño del video
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Detectar rostro
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (detection) {
                setFaceDetected(true);

                // Dibujar caja de detección
                const { x, y, width, height } = detection.detection.box;
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.strokeRect(x, y, width, height);

                // Dibujar landmarks
                const landmarks = detection.landmarks;
                ctx.fillStyle = '#00ff00';
                landmarks.positions.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                });
            } else {
                setFaceDetected(false);
            }
        }, 100);

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, [detecting]);

    // Iniciar detección cuando el video esté listo
    const handleVideoPlay = () => {
        setDetecting(true);
    };

    // Capturar rostro para login
    const handleCapture = async () => {
        if (!videoRef.current || processing) return;

        setProcessing(true);
        try {
            const descriptor = await extractDescriptor(videoRef.current);

            if (!descriptor) {
                onError('No se detectó un rostro claro. Intenta de nuevo.');
                return;
            }

            if (mode === 'login') {
                // Intentar login con el descriptor
                onLogin(Array.from(descriptor));
            } else {
                // Guardar descriptor para registro
                setCapturedDescriptor(Array.from(descriptor));
            }
        } catch (err) {
            onError('Error procesando el rostro');
        } finally {
            setProcessing(false);
        }
    };

    // Registrar nuevo usuario
    const handleRegister = async (e) => {
        e.preventDefault();
        if (!capturedDescriptor) {
            onError('Primero captura tu rostro');
            return;
        }

        setProcessing(true);
        try {
            const result = await registerUser({
                name: registerData.name,
                email: registerData.email,
                faceDescriptor: capturedDescriptor
            });

            if (result.success) {
                alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
                setCapturedDescriptor(null);
                setRegisterData({ name: '', email: '' });
            } else {
                onError(result.message || 'Error en el registro');
            }
        } catch (err) {
            onError('Error al registrar usuario');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={styles.container}>
            {/* Vista de cámara */}
            <div style={styles.cameraContainer}>
                <video
                    ref={videoRef}
                    style={styles.video}
                    autoPlay
                    playsInline
                    muted
                    onPlay={handleVideoPlay}
                />
                <canvas ref={canvasRef} style={styles.canvas} />

                {/* Indicador de estado */}
                <div style={{
                    ...styles.indicator,
                    background: faceDetected ? '#2ecc71' : '#e74c3c'
                }}>
                    {faceDetected ? '✓ Rostro detectado' : '○ Buscando rostro...'}
                </div>
            </div>

            {/* Controles */}
            <div style={styles.controls}>
                {mode === 'login' ? (
                    <button
                        style={{
                            ...styles.button,
                            opacity: faceDetected && !processing ? 1 : 0.5
                        }}
                        onClick={handleCapture}
                        disabled={!faceDetected || processing}
                    >
                        {processing ? '⏳ Verificando...' : '🔓 Iniciar Sesión'}
                    </button>
                ) : (
                    <>
                        {!capturedDescriptor ? (
                            <button
                                style={{
                                    ...styles.button,
                                    opacity: faceDetected && !processing ? 1 : 0.5
                                }}
                                onClick={handleCapture}
                                disabled={!faceDetected || processing}
                            >
                                {processing ? '⏳ Procesando...' : '📸 Capturar Rostro'}
                            </button>
                        ) : (
                            <form onSubmit={handleRegister} style={styles.form}>
                                <div style={styles.capturedBadge}>
                                    ✅ Rostro capturado
                                </div>
                                <input
                                    type="text"
                                    placeholder="Tu nombre"
                                    value={registerData.name}
                                    onChange={(e) => setRegisterData(prev => ({
                                        ...prev, name: e.target.value
                                    }))}
                                    style={styles.input}
                                    required
                                />
                                <input
                                    type="email"
                                    placeholder="Tu email"
                                    value={registerData.email}
                                    onChange={(e) => setRegisterData(prev => ({
                                        ...prev, email: e.target.value
                                    }))}
                                    style={styles.input}
                                    required
                                />
                                <button
                                    type="submit"
                                    style={styles.button}
                                    disabled={processing}
                                >
                                    {processing ? '⏳ Registrando...' : '✨ Completar Registro'}
                                </button>
                                <button
                                    type="button"
                                    style={styles.secondaryButton}
                                    onClick={() => setCapturedDescriptor(null)}
                                >
                                    🔄 Volver a capturar
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
    },
    cameraContainer: {
        position: 'relative',
        borderRadius: '15px',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    },
    video: {
        display: 'block',
        maxWidth: '100%',
        transform: 'scaleX(-1)',
    },
    canvas: {
        position: 'absolute',
        top: 0,
        left: 0,
        transform: 'scaleX(-1)',
    },
    indicator: {
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        borderRadius: '20px',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    controls: {
        width: '100%',
    },
    button: {
        width: '100%',
        padding: '15px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginTop: '10px',
    },
    secondaryButton: {
        width: '100%',
        padding: '12px',
        background: '#f0f0f0',
        color: '#333',
        border: 'none',
        borderRadius: '10px',
        fontSize: '14px',
        cursor: 'pointer',
        marginTop: '10px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    input: {
        padding: '12px 15px',
        border: '2px solid #eee',
        borderRadius: '10px',
        fontSize: '16px',
        outline: 'none',
        transition: 'border-color 0.3s',
    },
    capturedBadge: {
        background: '#d4edda',
        color: '#155724',
        padding: '10px',
        borderRadius: '8px',
        textAlign: 'center',
        fontWeight: 'bold',
    },
};

export default FaceRecognition;
