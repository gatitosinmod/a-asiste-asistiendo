# 📚 Guía Paso a Paso: Sistema de Asistencia Facial

## Introducción

Esta guía te llevará desde cero hasta tener un sistema de asistencia facial funcionando. Está diseñada para principiantes que quieren aprender mientras construyen.

---

## 🎯 Objetivos de Aprendizaje

Al completar este proyecto aprenderás:
- Cómo funciona el reconocimiento facial
- Desarrollo fullstack con React y Node.js
- Manejo de cámara web con JavaScript
- Autenticación con JWT
- Bases de datos con MongoDB

---

## 📋 Prerrequisitos

Antes de empezar, asegúrate de tener:

1. **Node.js** (v18 o superior)
   ```bash
   # Verificar instalación
   node --version
   ```

2. **MongoDB** (local o cuenta en MongoDB Atlas)

3. **Editor de código** (VS Code recomendado)

4. **Navegador moderno** (Chrome o Firefox)

---

## 🚀 FASE 1: Configuración del Entorno (30 min)

### Paso 1.1: Crear estructura de carpetas

```bash
mkdir asiste-asistiendo
cd asiste-asistiendo
mkdir frontend backend ml-model
```

### Paso 1.2: Inicializar Backend

```bash
cd backend
npm init -y
npm install express mongoose jsonwebtoken bcryptjs cors dotenv helmet morgan
npm install -D nodemon
```

### Paso 1.3: Inicializar Frontend

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install face-api.js axios react-webcam
```

---

## 🚀 FASE 2: Backend Básico (2-3 horas)

### Paso 2.1: Crear servidor Express

Crea `backend/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/facial-auth')
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Ruta de prueba
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
```

### Paso 2.2: Crear modelo de Usuario

Crea `backend/models/User.js`:

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  faceDescriptor: {
    type: [Number],
    required: true,
    validate: arr => arr.length === 128
  },
  attendanceHistory: [{
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Método para comparar rostros
userSchema.methods.compareFace = function(otherDescriptor) {
  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = this.faceDescriptor[i] - otherDescriptor[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  return { distance, isMatch: distance < 0.5 };
};

module.exports = mongoose.model('User', userSchema);
```

### Paso 2.3: Crear rutas de autenticación

Crea `backend/routes/auth.js`:

```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Registro
router.post('/register', async (req, res) => {
  try {
    const { name, email, faceDescriptor } = req.body;

    const user = new User({ name, email, faceDescriptor });
    await user.save();

    res.status(201).json({ success: true, message: 'Usuario registrado' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Login facial
router.post('/login-face', async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    const users = await User.find();

    for (const user of users) {
      const { isMatch } = user.compareFace(faceDescriptor);
      if (isMatch) {
        const token = jwt.sign({ id: user._id }, 'secreto', { expiresIn: '7d' });
        return res.json({ success: true, token, user: { name: user.name } });
      }
    }

    res.status(401).json({ success: false, message: 'Rostro no reconocido' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
```

### Paso 2.4: Probar backend

```bash
# En terminal
cd backend
npm run dev

# En otra terminal o con Postman
curl http://localhost:3001/api/health
# Debería responder: {"status":"ok"}
```

---

## 🚀 FASE 3: Frontend con Cámara (3-4 horas)

### Paso 3.1: Cargar modelos de face-api.js

Crea `frontend/src/services/faceApi.js`:

```javascript
import * as faceapi from 'face-api.js';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

export const loadModels = async () => {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  console.log('Modelos cargados');
};

export const extractDescriptor = async (video) => {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor || null;
};
```

### Paso 3.2: Crear componente de cámara

Crea `frontend/src/components/Camera.jsx`:

```javascript
import { useRef, useEffect, useState } from 'react';

export default function Camera({ onCapture }) {
  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch(err => console.error('Error cámara:', err));

    return () => {
      // Limpiar al desmontar
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay muted style={{ transform: 'scaleX(-1)' }} />
      <button onClick={() => onCapture(videoRef.current)} disabled={!ready}>
        Capturar
      </button>
    </div>
  );
}
```

### Paso 3.3: Integrar todo en App.jsx

```javascript
import { useState, useEffect } from 'react';
import { loadModels, extractDescriptor } from './services/faceApi';
import Camera from './components/Camera';

export default function App() {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Cargando modelos...');

  useEffect(() => {
    loadModels().then(() => {
      setReady(true);
      setMessage('¡Listo! Mira a la cámara');
    });
  }, []);

  const handleCapture = async (video) => {
    const descriptor = await extractDescriptor(video);
    if (descriptor) {
      // Enviar al backend
      const response = await fetch('http://localhost:3001/api/auth/login-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceDescriptor: Array.from(descriptor) })
      });
      const data = await response.json();
      setMessage(data.success ? `¡Hola ${data.user.name}!` : data.message);
    } else {
      setMessage('No se detectó rostro');
    }
  };

  return (
    <div>
      <h1>Sistema de Asistencia Facial</h1>
      <p>{message}</p>
      {ready && <Camera onCapture={handleCapture} />}
    </div>
  );
}
```

---

## 🚀 FASE 4: Funcionalidades Completas (2-3 horas)

### Paso 4.1: Agregar registro de usuarios

### Paso 4.2: Crear Dashboard con historial

### Paso 4.3: Agregar estilos CSS

### Paso 4.4: Manejar errores y estados de carga

---

## 🧪 FASE 5: Testing y Pulido (1-2 horas)

### Paso 5.1: Probar flujo completo
1. Registrar usuario nuevo
2. Cerrar sesión
3. Login con reconocimiento facial
4. Marcar asistencia
5. Verificar historial

### Paso 5.2: Ajustar umbral de reconocimiento
Si hay muchos falsos positivos/negativos, ajusta el umbral en `User.js`:
```javascript
// Más estricto (menos falsos positivos)
return { isMatch: distance < 0.4 };

// Más permisivo (menos falsos negativos)
return { isMatch: distance < 0.6 };
```

---

## 💡 Consejos Finales

1. **Iluminación**: El reconocimiento facial funciona mejor con buena luz
2. **Posición**: Mantén el rostro centrado en la cámara
3. **Múltiples capturas**: Registra con varias fotos para mejor precisión
4. **Backup**: Siempre ten una contraseña como método alternativo

---

## 🔜 Siguientes Pasos

Una vez domines lo básico:
1. Agregar detección de vida (liveness detection)
2. Implementar tu propio modelo de ML
3. Añadir reconocimiento de múltiples rostros
4. Integrar con sistema de control de acceso físico

¡Felicidades por completar el proyecto! 🎉
