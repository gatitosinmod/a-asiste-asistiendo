import React, { useRef, useEffect, useState } from 'react';

/**
 * Escáner de Códigos QR
 *
 * Usa la cámara del dispositivo para escanear códigos QR.
 * Valida que el código sea reciente (< 60 segundos).
 */
const QRScanner = ({ onScan, onError }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [lastResult, setLastResult] = useState(null);

    // Iniciar cámara
    useEffect(() => {
        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' } // Cámara trasera
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setScanning(true);
                }
            } catch (err) {
                onError?.('No se pudo acceder a la cámara');
            }
        };
        startCamera();

        return () => {
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    // Escanear frames continuamente
    useEffect(() => {
        if (!scanning) return;

        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas?.getContext('2d');

        const scanFrame = () => {
            if (!video || !ctx) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            // Obtener datos de imagen para análisis
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // En producción: usar jsQR o similar para decodificar
            // const code = jsQR(imageData.data, imageData.width, imageData.height);
            // if (code) {
            //     handleQRDetected(code.data);
            // }

            // Placeholder: simular detección
            // En implementación real, descomentar lo de arriba
        };

        const interval = setInterval(scanFrame, 100);
        return () => clearInterval(interval);
    }, [scanning]);

    // Procesar QR detectado
    const handleQRDetected = async (data) => {
        if (lastResult === data) return; // Evitar duplicados

        setLastResult(data);

        try {
            const payload = JSON.parse(data);

            // Validar que el QR no tenga más de 60 segundos
            const age = Date.now() - payload.timestamp;
            if (age > 60000) {
                onError?.('Código QR expirado. Pide uno nuevo.');
                return;
            }

            // Enviar al servidor para validación
            const response = await fetch('/api/attendance/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    qrData: payload,
                    scannedAt: Date.now()
                })
            });

            const result = await response.json();

            if (result.success) {
                onScan?.(result);
            } else {
                onError?.(result.message);
            }
        } catch (err) {
            onError?.('Código QR inválido');
        }
    };

    // Simular escaneo para demo
    const simulateScan = () => {
        const mockData = JSON.stringify({
            session: 'demo-session',
            timestamp: Date.now(),
            hash: 'abc123xyz789'
        });
        handleQRDetected(mockData);
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>📷 Escanear Código QR</h2>

            <div style={styles.scannerContainer}>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.video}
                />
                <canvas ref={canvasRef} style={styles.canvas} />

                {/* Marco de escaneo */}
                <div style={styles.scanFrame}>
                    <div style={styles.corner} data-position="top-left" />
                    <div style={styles.corner} data-position="top-right" />
                    <div style={styles.corner} data-position="bottom-left" />
                    <div style={styles.corner} data-position="bottom-right" />
                </div>
            </div>

            <p style={styles.instructions}>
                Apunta la cámara al código QR mostrado en pantalla
            </p>

            {/* Botón de demo */}
            <button style={styles.demoButton} onClick={simulateScan}>
                🧪 Simular escaneo (demo)
            </button>
        </div>
    );
};

const styles = {
    container: {
        textAlign: 'center',
        padding: '20px',
    },
    title: {
        marginBottom: '20px',
        color: '#333',
    },
    scannerContainer: {
        position: 'relative',
        width: '300px',
        height: '300px',
        margin: '0 auto 20px',
        overflow: 'hidden',
        borderRadius: '15px',
        background: '#000',
    },
    video: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    canvas: {
        display: 'none',
    },
    scanFrame: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '200px',
        height: '200px',
        border: '2px solid rgba(46, 204, 113, 0.5)',
    },
    corner: {
        position: 'absolute',
        width: '20px',
        height: '20px',
        borderColor: '#2ecc71',
        borderStyle: 'solid',
        borderWidth: '0',
    },
    instructions: {
        color: '#666',
        marginBottom: '20px',
    },
    demoButton: {
        padding: '10px 20px',
        background: '#9b59b6',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
    },
};

export default QRScanner;
