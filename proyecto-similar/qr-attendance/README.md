# 📱 Sistema de Asistencia con Código QR

Sistema alternativo de control de asistencia usando códigos QR dinámicos.

## Descripción

Similar al sistema de reconocimiento facial, pero usa códigos QR que cambian cada minuto para evitar capturas de pantalla fraudulentas.

## Características

- ✅ Generación de QR dinámico (cambia cada 60 segundos)
- ✅ Escaneo desde app móvil o webcam
- ✅ Validación de tiempo y ubicación
- ✅ Historial de asistencias
- ✅ Panel de administración

## Estructura

```
qr-attendance/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── QRGenerator.jsx
│   │   │   ├── QRScanner.jsx
│   │   │   └── Dashboard.jsx
│   │   └── App.jsx
│   └── package.json
├── backend/
│   ├── models/
│   │   └── Attendance.js
│   ├── routes/
│   │   └── qr.js
│   └── server.js
└── README.md
```

## Instalación

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Uso

1. Admin genera QR desde panel
2. Empleado escanea QR con su dispositivo
3. Sistema valida y registra asistencia
