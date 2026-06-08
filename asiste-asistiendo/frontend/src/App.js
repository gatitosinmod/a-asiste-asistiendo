import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import Camera from './components/Camera/Camera.jsx';
import FaceRecognition from './components/FaceRecognition/FaceRecognition.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import { loadModels } from './services/faceApi.js';
import { checkAuth, login, logout } from './services/auth.js';

/**
 * App Principal - Sistema de Asistencia Facial
 *
 * Flujo:
 * 1. Cargar modelos de face-api.js
 * 2. Mostrar cámara para captura facial
 * 3. Detectar y reconocer rostro
 * 4. Si coincide con usuario registrado → Dashboard
 * 5. Si no → Opción de registrar nuevo usuario
 */
function App() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [user, setUser] = useState(null);
    const [view, setView] = useState('login'); // 'login', 'register', 'dashboard'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Cargar modelos de detección facial al iniciar
    useEffect(() => {
        const initModels = async () => {
            try {
                await loadModels();
                setModelsLoaded(true);

                // Verificar si hay sesión activa
                const authUser = await checkAuth();
                if (authUser) {
                    setUser(authUser);
                    setView('dashboard');
                }
            } catch (err) {
                setError('Error cargando modelos de reconocimiento facial');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        initModels();
    }, []);

    // Manejar login exitoso
    const handleLogin = async (faceDescriptor) => {
        try {
            setLoading(true);
            const result = await login(faceDescriptor);
            if (result.success) {
                setUser(result.user);
                setView('dashboard');
            } else {
                setError(result.message || 'Rostro no reconocido');
            }
        } catch (err) {
            setError('Error durante el login');
        } finally {
            setLoading(false);
        }
    };

    // Manejar logout
    const handleLogout = async () => {
        await logout();
        setUser(null);
        setView('login');
    };

    // Pantalla de carga
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <div style={styles.spinner}></div>
                    <p style={styles.loadingText}>
                        {modelsLoaded ? 'Verificando sesión...' : 'Cargando modelos de IA...'}
                    </p>
                </div>
            </div>
        );
    }

    // Pantalla de error
    if (error && !modelsLoaded) {
        return (
            <div style={styles.container}>
                <div style={styles.card}>
                    <h2 style={styles.errorTitle}>Error</h2>
                    <p style={styles.errorText}>{error}</p>
                    <button
                        style={styles.button}
                        onClick={() => window.location.reload()}
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {view === 'dashboard' ? (
                <Dashboard user={user} onLogout={handleLogout} />
            ) : (
                <div style={styles.card}>
                    <h1 style={styles.title}>
                        🔐 Sistema de Asistencia Facial
                    </h1>

                    {error && (
                        <div style={styles.errorBanner}>
                            {error}
                            <button
                                style={styles.closeError}
                                onClick={() => setError(null)}
                            >×</button>
                        </div>
                    )}

                    <div style={styles.tabs}>
                        <button
                            style={{
                                ...styles.tab,
                                ...(view === 'login' ? styles.activeTab : {})
                            }}
                            onClick={() => setView('login')}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            style={{
                                ...styles.tab,
                                ...(view === 'register' ? styles.activeTab : {})
                            }}
                            onClick={() => setView('register')}
                        >
                            Registrarse
                        </button>
                    </div>

                    <FaceRecognition
                        mode={view}
                        onLogin={handleLogin}
                        onError={setError}
                    />
                </div>
            )}
        </div>
    );
}

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
    },
    card: {
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        maxWidth: '500px',
        width: '100%',
    },
    title: {
        textAlign: 'center',
        color: '#333',
        marginBottom: '30px',
        fontSize: '24px',
    },
    tabs: {
        display: 'flex',
        marginBottom: '20px',
        borderBottom: '2px solid #eee',
    },
    tab: {
        flex: 1,
        padding: '15px',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        color: '#666',
        transition: 'all 0.3s',
    },
    activeTab: {
        color: '#667eea',
        borderBottom: '2px solid #667eea',
        marginBottom: '-2px',
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto 20px',
    },
    loadingText: {
        textAlign: 'center',
        color: '#666',
    },
    errorTitle: {
        color: '#e74c3c',
        textAlign: 'center',
    },
    errorText: {
        color: '#666',
        textAlign: 'center',
        margin: '20px 0',
    },
    errorBanner: {
        background: '#fee',
        color: '#c00',
        padding: '10px 15px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    closeError: {
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#c00',
    },
    button: {
        display: 'block',
        width: '100%',
        padding: '15px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        cursor: 'pointer',
    },
};

// Agregar animación de spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);

// Renderizar aplicación
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

export default App;
