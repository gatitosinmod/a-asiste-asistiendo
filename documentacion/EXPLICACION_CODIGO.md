# 🔍 Explicación Detallada del Código

Este documento explica cada archivo importante del proyecto, línea por línea.

---

## 📁 Frontend

### `src/services/faceApi.js`

Este archivo maneja toda la interacción con face-api.js.

```javascript
import * as faceapi from 'face-api.js';

// URL donde están los modelos pre-entrenados
// Usamos un CDN público para no tener que hostear los archivos
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
```

#### Función `loadModels()`

```javascript
export const loadModels = async () => {
    // Promise.all ejecuta las 3 cargas en PARALELO (más rápido)
    await Promise.all([
        // Modelo pequeño para detectar rostros (rápido pero menos preciso)
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),

        // Modelo para encontrar los 68 puntos del rostro
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),

        // Modelo que genera el descriptor de 128 números
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
};
```

**¿Por qué 3 modelos?**
- Cada uno hace una tarea específica
- Podrían combinarse en uno, pero así es más flexible
- Puedes cargar solo lo que necesitas

#### Función `extractDescriptor()`

```javascript
export const extractDescriptor = async (input) => {
    // TinyFaceDetectorOptions configura el detector
    const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,      // Tamaño de imagen para el modelo (416px)
        scoreThreshold: 0.5  // Mínima confianza para considerar detección
    });

    // Encadenar operaciones: detectar → landmarks → descriptor
    const detection = await faceapi
        .detectSingleFace(input, options)  // Detectar UN rostro
        .withFaceLandmarks()               // Encontrar 68 puntos
        .withFaceDescriptor();             // Generar descriptor

    // Si no se detectó rostro, devuelve null
    // detection?.descriptor usa optional chaining de JS
    return detection?.descriptor || null;
};
```

**¿Por qué `detectSingleFace` y no `detectAllFaces`?**
- Para login solo necesitamos UN rostro
- Es más rápido
- Evita ambigüedad si hay varias personas

---

### `src/components/FaceRecognition.jsx`

Este componente maneja la cámara y el proceso de reconocimiento.

```javascript
// useRef crea una referencia que persiste entre renders
const videoRef = useRef(null);
const canvasRef = useRef(null);

// useState para manejar estados de la UI
const [detecting, setDetecting] = useState(false);
const [faceDetected, setFaceDetected] = useState(false);
```

#### Iniciar cámara

```javascript
useEffect(() => {
    const startCamera = async () => {
        // Pedir acceso a la cámara
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',  // Cámara frontal
                width: 480,
                height: 360
            }
        });

        // Conectar stream al elemento video
        videoRef.current.srcObject = stream;
    };
    startCamera();

    // Cleanup: detener cámara al desmontar componente
    return () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
    };
}, []);  // [] significa que se ejecuta solo al montar
```

#### Detección continua

```javascript
useEffect(() => {
    if (!detecting) return;

    // setInterval ejecuta cada 100ms (10 FPS)
    const interval = setInterval(async () => {
        const detection = await faceapi
            .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (detection) {
            setFaceDetected(true);
            // Dibujar caja verde alrededor del rostro
            drawDetection(canvasRef.current, detection);
        } else {
            setFaceDetected(false);
        }
    }, 100);

    return () => clearInterval(interval);
}, [detecting]);
```

**¿Por qué 100ms?**
- 10 FPS es suficiente para feedback visual
- Más rápido consumiría mucha CPU
- Más lento se sentiría lagueado

---

## 📁 Backend

### `server.js`

Punto de entrada del servidor.

```javascript
// Cargar variables de entorno desde .env
require('dotenv').config();

const express = require('express');
const app = express();

// Middleware de seguridad
app.use(helmet());  // Agrega headers de seguridad HTTP

// CORS: permitir peticiones desde el frontend
app.use(cors({
    origin: 'http://localhost:5173',  // URL del frontend
    credentials: true  // Permitir cookies/headers de auth
}));

// Rate limiting: máximo 100 peticiones por IP cada 15 min
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Parsear JSON con límite de 10MB (descriptores son grandes)
app.use(express.json({ limit: '10mb' }));
```

#### Conexión a MongoDB

```javascript
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch((err) => {
        console.error('❌ Error:', err.message);
        process.exit(1);  // Salir si no hay DB
    });
```

---

### `models/User.js`

Define la estructura de datos de usuario.

```javascript
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre es requerido'],  // Mensaje de error personalizado
        trim: true,  // Eliminar espacios al inicio/final
        minlength: [2, 'Mínimo 2 caracteres']
    },

    email: {
        type: String,
        required: true,
        unique: true,  // No puede repetirse
        lowercase: true,  // Convertir a minúsculas
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']  // Validar formato
    },

    // El descriptor facial: array de exactamente 128 números
    faceDescriptor: {
        type: [Number],
        required: true,
        validate: {
            validator: arr => arr.length === 128,
            message: 'Debe tener 128 valores'
        }
    },

    // Historial de asistencias
    attendanceHistory: [{
        date: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true  // Agrega createdAt y updatedAt automáticamente
});
```

#### Método de comparación

```javascript
userSchema.methods.compareFace = function(otherDescriptor) {
    // Calcular distancia euclidiana
    let sum = 0;
    for (let i = 0; i < 128; i++) {
        const diff = this.faceDescriptor[i] - otherDescriptor[i];
        sum += diff * diff;  // Sumar cuadrados de diferencias
    }
    const distance = Math.sqrt(sum);  // Raíz cuadrada

    // Umbral de 0.5 determina si es la misma persona
    return {
        distance: distance.toFixed(4),
        isMatch: distance < 0.5,
        confidence: Math.max(0, (1 - distance) * 100).toFixed(1)
    };
};
```

**Explicación matemática:**
```
Descriptor A: [a1, a2, ..., a128]
Descriptor B: [b1, b2, ..., b128]

Distancia = √[(a1-b1)² + (a2-b2)² + ... + (a128-b128)²]
```

---

### `routes/auth.js`

Maneja registro y login.

#### Registro

```javascript
router.post('/register', async (req, res) => {
    const { name, email, faceDescriptor } = req.body;

    // Verificar si email ya existe
    const existing = await User.findOne({ email });
    if (existing) {
        return res.status(400).json({ message: 'Email ya registrado' });
    }

    // Verificar si el rostro ya está registrado
    const faceMatch = await User.findByFace(faceDescriptor);
    if (faceMatch) {
        return res.status(400).json({ message: 'Rostro ya registrado' });
    }

    // Crear y guardar usuario
    const user = new User({ name, email, faceDescriptor });
    await user.save();

    res.status(201).json({ success: true });
});
```

#### Login facial

```javascript
router.post('/login-face', async (req, res) => {
    const { faceDescriptor } = req.body;

    // Buscar coincidencia en todos los usuarios
    const match = await User.findByFace(faceDescriptor);

    if (!match) {
        return res.status(401).json({ message: 'Rostro no reconocido' });
    }

    // Generar JWT con ID del usuario
    const token = jwt.sign(
        { id: match.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    res.json({
        success: true,
        token,
        user: { name: match.user.name, email: match.user.email },
        confidence: match.confidence
    });
});
```

---

### `middleware/authMiddleware.js`

Protege rutas que requieren autenticación.

```javascript
const authMiddleware = (req, res, next) => {
    // Obtener header "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token no proporcionado' });
    }

    // Separar "Bearer" del token
    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Formato inválido' });
    }

    try {
        // Verificar y decodificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Agregar usuario al request para uso posterior
        req.user = { id: decoded.id };

        next();  // Continuar al siguiente middleware/ruta
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(401).json({ error: 'Token inválido' });
    }
};
```

**Uso:**
```javascript
// Ruta protegida
router.get('/profile', authMiddleware, (req, res) => {
    // req.user.id contiene el ID del usuario autenticado
    const user = await User.findById(req.user.id);
    res.json(user);
});
```

---

## 🔑 Conceptos Clave de JavaScript Usados

### 1. async/await
```javascript
// En lugar de .then().catch()
const result = await someAsyncFunction();
```

### 2. Optional chaining (?.)
```javascript
// Si detection es null, no da error
const descriptor = detection?.descriptor;
```

### 3. Destructuring
```javascript
const { name, email } = req.body;
// Equivale a:
// const name = req.body.name;
// const email = req.body.email;
```

### 4. Arrow functions
```javascript
const sum = (a, b) => a + b;
// Equivale a:
// function sum(a, b) { return a + b; }
```

### 5. Template literals
```javascript
console.log(`Hola ${name}`);
// Equivale a:
// console.log('Hola ' + name);
```

---

## 📊 Diagrama de Flujo del Código

```
FRONTEND                          BACKEND                     DATABASE
   |                                 |                            |
   | 1. Cargar modelos               |                            |
   |<---(CDN)                        |                            |
   |                                 |                            |
   | 2. Detectar rostro              |                            |
   | 3. Extraer descriptor           |                            |
   |                                 |                            |
   |---POST /login-face------------->|                            |
   |   {faceDescriptor: [...]}       |                            |
   |                                 | 4. Buscar usuarios         |
   |                                 |--------------------------->|
   |                                 |<---[users]-----------------|
   |                                 |                            |
   |                                 | 5. Comparar descriptores   |
   |                                 | 6. Generar JWT             |
   |                                 |                            |
   |<--{token, user}-----------------|                            |
   |                                 |                            |
   | 7. Guardar token                |                            |
   | 8. Mostrar dashboard            |                            |
```

---

¡Espero que esta explicación te ayude a entender cada parte del código!
