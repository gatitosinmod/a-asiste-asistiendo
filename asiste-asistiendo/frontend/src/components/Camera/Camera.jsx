import React, { useRef, useCallback, useState } from 'react';

/**
 * Componente Camera
 *
 * Proporciona acceso a la cámara del dispositivo usando la API getUserMedia.
 * Características:
 * - Vista previa en tiempo real
 * - Captura de imagen
 * - Manejo de permisos
 * - Selector de cámara (frontal/trasera)
 */
const Camera = ({ onCapture, onStream, width = 480, height = 360 }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState(null);
    const [facingMode, setFacingMode] = useState('user'); // 'user' = frontal, 'environment' = trasera

    // Iniciar stream de cámara
    const startCamera = useCallback(async () => {
        try {
            const constraints = {
                video: {
                    width: { ideal: width },
                    height: { ideal: height },
                    facingMode: facingMode
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                    setStreaming(true);
                    setError(null);

                    // Notificar al padre que el stream está listo
                    if (onStream) {
                        onStream(stream, videoRef.current);
                    }
                };
            }
        } catch (err) {
            console.error('Error accediendo a la cámara:', err);
            if (err.name === 'NotAllowedError') {
                setError('Permiso de cámara denegado. Por favor, permite el acceso.');
            } else if (err.name === 'NotFoundError') {
                setError('No se encontró ninguna cámara en el dispositivo.');
            } else {
                setError('Error al acceder a la cámara: ' + err.message);
            }
        }
    }, [width, height, facingMode, onStream]);

    // Detener stream de cámara
    const stopCamera = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = videoRef.current.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setStreaming(false);
        }
    }, []);

    // Capturar imagen actual
    const captureImage = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return null;

        const canvas = canvasRef.current;
        const video = videoRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Convertir a blob para enviar al servidor
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const imageData = canvas.toDataURL('image/jpeg', 0.8);

                if (onCapture) {
                    onCapture({ blob, imageData, canvas });
                }

                resolve({ blob, imageData });
            }, 'image/jpeg', 0.8);
        });
    }, [onCapture]);

    // Cambiar cámara frontal/trasera
    const toggleCamera = useCallback(() => {
        stopCamera();
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        setTimeout(startCamera, 100);
    }, [stopCamera, startCamera]);

    // Iniciar cámara al montar
    React.useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, []);

    return (
        <div style={styles.container}>
            {error ? (
                <div style={styles.errorContainer}>
                    <p style={styles.errorText}>{error}</p>
                    <button style={styles.button} onClick={startCamera}>
                        Reintentar
                    </button>
                </div>
            ) : (
                <>
                    <div style={styles.videoContainer}>
                        <video
                            ref={videoRef}
                            style={styles.video}
                            autoPlay
                            playsInline
                            muted
                        />
                        {/* Overlay con guía para rostro */}
                        <div style={styles.faceGuide}>
                            <div style={styles.faceOval}></div>
                        </div>
                    </div>

                    <canvas ref={canvasRef} style={styles.canvas} />

                    <div style={styles.controls}>
                        <button
                            style={styles.button}
                            onClick={captureImage}
                            disabled={!streaming}
                        >
                            📸 Capturar
                        </button>
                        <button
                            style={styles.secondaryButton}
                            onClick={toggleCamera}
                        >
                            🔄 Cambiar Cámara
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '15px',
    },
    videoContainer: {
        position: 'relative',
        borderRadius: '15px',
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    },
    video: {
        display: 'block',
        maxWidth: '100%',
        transform: 'scaleX(-1)', // Efecto espejo
    },
    faceGuide: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
    },
    faceOval: {
        width: '200px',
        height: '280px',
        border: '3px dashed rgba(102, 126, 234, 0.6)',
        borderRadius: '50%',
    },
    canvas: {
        display: 'none', // Canvas oculto para captura
    },
    controls: {
        display: 'flex',
        gap: '10px',
    },
    button: {
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
    },
    secondaryButton: {
        padding: '12px 24px',
        background: '#f0f0f0',
        color: '#333',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
    errorContainer: {
        textAlign: 'center',
        padding: '40px',
    },
    errorText: {
        color: '#e74c3c',
        marginBottom: '20px',
    },
};

export default Camera;
