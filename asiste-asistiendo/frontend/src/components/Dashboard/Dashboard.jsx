import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Componente Dashboard
 *
 * Panel principal después del login exitoso.
 * Muestra:
 * - Información del usuario
 * - Historial de asistencias
 * - Botón para marcar asistencia
 * - Estadísticas básicas
 */
const Dashboard = ({ user, onLogout }) => {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(false);
    const [todayMarked, setTodayMarked] = useState(false);

    // Cargar historial de asistencias
    useEffect(() => {
        loadAttendance();
    }, []);

    const loadAttendance = async () => {
        try {
            const response = await axios.get('/api/attendance', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setAttendance(response.data.records || []);

            // Verificar si ya marcó hoy
            const today = new Date().toDateString();
            const markedToday = response.data.records?.some(
                record => new Date(record.date).toDateString() === today
            );
            setTodayMarked(markedToday);
        } catch (err) {
            console.error('Error cargando asistencias:', err);
        }
    };

    // Marcar asistencia
    const markAttendance = async () => {
        setLoading(true);
        try {
            await axios.post('/api/attendance/mark', {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setTodayMarked(true);
            loadAttendance();
        } catch (err) {
            console.error('Error marcando asistencia:', err);
        } finally {
            setLoading(false);
        }
    };

    // Formatear fecha
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Calcular estadísticas
    const stats = {
        total: attendance.length,
        thisMonth: attendance.filter(a => {
            const date = new Date(a.date);
            const now = new Date();
            return date.getMonth() === now.getMonth() &&
                   date.getFullYear() === now.getFullYear();
        }).length,
        streak: calculateStreak(attendance)
    };

    function calculateStreak(records) {
        if (!records.length) return 0;
        let streak = 0;
        const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
        let currentDate = new Date();

        for (const record of sorted) {
            const recordDate = new Date(record.date);
            const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                streak++;
                currentDate = recordDate;
            } else {
                break;
            }
        }
        return streak;
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.userInfo}>
                    <div style={styles.avatar}>
                        {user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                        <h2 style={styles.userName}>{user?.name || 'Usuario'}</h2>
                        <p style={styles.userEmail}>{user?.email || ''}</p>
                    </div>
                </div>
                <button style={styles.logoutButton} onClick={onLogout}>
                    🚪 Cerrar Sesión
                </button>
            </div>

            {/* Tarjeta de Asistencia */}
            <div style={styles.attendanceCard}>
                <h3 style={styles.cardTitle}>📅 Asistencia de Hoy</h3>
                {todayMarked ? (
                    <div style={styles.markedBadge}>
                        ✅ Asistencia registrada
                    </div>
                ) : (
                    <button
                        style={styles.markButton}
                        onClick={markAttendance}
                        disabled={loading}
                    >
                        {loading ? '⏳ Registrando...' : '✋ Marcar Asistencia'}
                    </button>
                )}
            </div>

            {/* Estadísticas */}
            <div style={styles.statsContainer}>
                <div style={styles.statCard}>
                    <span style={styles.statNumber}>{stats.total}</span>
                    <span style={styles.statLabel}>Total</span>
                </div>
                <div style={styles.statCard}>
                    <span style={styles.statNumber}>{stats.thisMonth}</span>
                    <span style={styles.statLabel}>Este mes</span>
                </div>
                <div style={styles.statCard}>
                    <span style={styles.statNumber}>{stats.streak}🔥</span>
                    <span style={styles.statLabel}>Racha</span>
                </div>
            </div>

            {/* Historial */}
            <div style={styles.historySection}>
                <h3 style={styles.sectionTitle}>📋 Historial Reciente</h3>
                <div style={styles.historyList}>
                    {attendance.length === 0 ? (
                        <p style={styles.emptyText}>No hay registros de asistencia</p>
                    ) : (
                        attendance.slice(0, 10).map((record, index) => (
                            <div key={index} style={styles.historyItem}>
                                <span style={styles.historyIcon}>✓</span>
                                <span style={styles.historyDate}>
                                    {formatDate(record.date)}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        maxWidth: '600px',
        width: '100%',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid #eee',
    },
    userInfo: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
    },
    avatar: {
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
    },
    userName: {
        margin: 0,
        color: '#333',
        fontSize: '20px',
    },
    userEmail: {
        margin: '5px 0 0',
        color: '#666',
        fontSize: '14px',
    },
    logoutButton: {
        padding: '10px 20px',
        background: '#f0f0f0',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#666',
    },
    attendanceCard: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '15px',
        padding: '25px',
        color: 'white',
        textAlign: 'center',
        marginBottom: '20px',
    },
    cardTitle: {
        margin: '0 0 15px',
        fontSize: '18px',
    },
    markedBadge: {
        background: 'rgba(255,255,255,0.2)',
        padding: '15px',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
    },
    markButton: {
        padding: '15px 30px',
        background: 'white',
        color: '#667eea',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'transform 0.2s',
    },
    statsContainer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '15px',
        marginBottom: '25px',
    },
    statCard: {
        background: '#f8f9fa',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
    },
    statNumber: {
        display: 'block',
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#667eea',
    },
    statLabel: {
        fontSize: '12px',
        color: '#666',
        textTransform: 'uppercase',
    },
    historySection: {
        marginTop: '20px',
    },
    sectionTitle: {
        margin: '0 0 15px',
        color: '#333',
        fontSize: '16px',
    },
    historyList: {
        maxHeight: '200px',
        overflowY: 'auto',
    },
    historyItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px',
        borderBottom: '1px solid #eee',
    },
    historyIcon: {
        color: '#2ecc71',
        fontWeight: 'bold',
    },
    historyDate: {
        color: '#666',
        fontSize: '14px',
    },
    emptyText: {
        color: '#999',
        textAlign: 'center',
        padding: '20px',
    },
};

export default Dashboard;
