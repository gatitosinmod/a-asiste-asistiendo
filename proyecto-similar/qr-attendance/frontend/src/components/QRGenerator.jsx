import React, { useState, useEffect } from 'react';

/**
 * Generador de Códigos QR Dinámicos
 *
 * Genera un QR que cambia cada 60 segundos.
 * El QR contiene: timestamp + hash de validación
 */
const QRGenerator = ({ sessionId }) => {
    const [qrData, setQrData] = useState('');
    const [timeLeft, setTimeLeft] = useState(60);

    // Generar nuevo código QR
    const generateQR = () => {
        const timestamp = Date.now();
        const secret = 'clave_secreta_cambiar'; // En producción, usar variable de entorno

        // Crear payload con timestamp y hash
        const payload = {
            session: sessionId,
            timestamp,
            // Hash simple para validación (en producción usar crypto)
            hash: btoa(`${sessionId}-${timestamp}-${secret}`).slice(0, 16)
        };

        setQrData(JSON.stringify(payload));
        setTimeLeft(60);
    };

    // Regenerar QR cada 60 segundos
    useEffect(() => {
        generateQR();
        const interval = setInterval(generateQR, 60000);
        return () => clearInterval(interval);
    }, [sessionId]);

    // Countdown
    useEffect(() => {
        const countdown = setInterval(() => {
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 60));
        }, 1000);
        return () => clearInterval(countdown);
    }, []);

    // Generar QR como SVG (sin dependencias externas)
    const generateQRSVG = (data) => {
        // Simplificado: en producción usar librería como qrcode
        // Aquí mostramos placeholder
        return (
            <div style={styles.qrPlaceholder}>
                <div style={styles.qrCode}>
                    {/* En producción: <QRCode value={data} size={250} /> */}
                    <pre style={styles.qrData}>{data.slice(0, 50)}...</pre>
                </div>
            </div>
        );
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>📱 Código QR de Asistencia</h2>

            <div style={styles.qrContainer}>
                {generateQRSVG(qrData)}
            </div>

            <div style={styles.timer}>
                <span style={styles.timerLabel}>Nuevo código en:</span>
                <span style={{
                    ...styles.timerValue,
                    color: timeLeft < 10 ? '#e74c3c' : '#2ecc71'
                }}>
                    {timeLeft}s
                </span>
            </div>

            <p style={styles.instructions}>
                Escanea este código con tu dispositivo para registrar tu asistencia
            </p>

            <button style={styles.refreshButton} onClick={generateQR}>
                🔄 Generar nuevo código
            </button>
        </div>
    );
};

const styles = {
    container: {
        textAlign: 'center',
        padding: '30px',
        background: 'white',
        borderRadius: '15px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        margin: '0 auto',
    },
    title: {
        marginBottom: '20px',
        color: '#333',
    },
    qrContainer: {
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '10px',
        marginBottom: '20px',
    },
    qrPlaceholder: {
        width: '250px',
        height: '250px',
        margin: '0 auto',
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px dashed #ddd',
    },
    qrCode: {
        padding: '10px',
    },
    qrData: {
        fontSize: '10px',
        wordBreak: 'break-all',
        color: '#666',
    },
    timer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
    },
    timerLabel: {
        color: '#666',
    },
    timerValue: {
        fontSize: '28px',
        fontWeight: 'bold',
    },
    instructions: {
        color: '#888',
        fontSize: '14px',
        marginBottom: '20px',
    },
    refreshButton: {
        padding: '12px 24px',
        background: '#3498db',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },
};

export default QRGenerator;
