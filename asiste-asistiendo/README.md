# 🔐 Sistema de Asistencia Facial

Sistema de autenticación y control de asistencia mediante reconocimiento facial, construido con React y Node.js.

## 📋 Características

- ✅ **Registro facial**: Los usuarios se registran con su rostro
- ✅ **Login sin contraseña**: Autenticación usando solo el rostro
- ✅ **Detección en tiempo real**: Usa la cámara para detectar rostros
- ✅ **Historial de asistencias**: Registro de entradas y salidas
- ✅ **Dashboard personal**: Estadísticas y racha de asistencia
- ✅ **Preparado para ML propio**: Estructura para migrar a modelo propio

## 🛠️ Tecnologías

### Frontend
- React 18
- face-api.js (TensorFlow.js)
- Axios
- Vite

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT (autenticación)
- bcrypt (hashing)

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+
- MongoDB (local o Atlas)
- Navegador con soporte para cámara

### Opción 1: Instalación manual

```bash
# Clonar repositorio
cd asiste-asistiendo

# Instalar dependencias del backend
cd backend
npm install

# Crear archivo .env
cp .env.example .env
# Editar .env con tus credenciales

# Iniciar backend
npm run dev

# En otra terminal, instalar frontend
cd ../frontend
npm install

# Iniciar frontend
npm run dev
```

### Opción 2: Docker

```bash
# Levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

## ⚙️ Configuración

### Variables de entorno (backend/.env)

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/facial-auth
JWT_SECRET=tu_secreto_super_seguro
JWT_EXPIRES=7d
FRONTEND_URL=http://localhost:5173
```

### Variables de entorno (frontend/.env)

```env
VITE_API_URL=http://localhost:3001/api
```

## 📖 Uso

1. **Registro**:
   - Accede a la aplicación
   - Selecciona "Registrarse"
   - Coloca tu rostro frente a la cámara
   - Ingresa tu nombre y email
   - ¡Listo!

2. **Login**:
   - Selecciona "Iniciar Sesión"
   - Mira a la cámara
   - El sistema reconocerá tu rostro

3. **Marcar asistencia**:
   - Una vez logueado, presiona "Marcar Asistencia"
   - Se registra automáticamente la fecha y hora

## 🔧 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/register | Registrar usuario |
| POST | /api/auth/login-face | Login facial |
| GET | /api/auth/verify | Verificar token |
| POST | /api/auth/logout | Cerrar sesión |
| GET | /api/attendance | Obtener historial |
| POST | /api/attendance/mark | Marcar asistencia |

## 🧠 ¿Cómo funciona el reconocimiento facial?

1. **Detección**: face-api.js detecta rostros en la imagen
2. **Landmarks**: Identifica 68 puntos de referencia del rostro
3. **Descriptor**: Genera un vector de 128 números únicos
4. **Comparación**: Calcula distancia euclidiana entre descriptores
5. **Umbral**: Si la distancia < 0.5, es la misma persona

## 🔄 Migración a modelo propio

La carpeta `ml-model/` está preparada para cuando quieras usar tu propio modelo:

1. Entrena tu modelo en `ml-model/train/`
2. Implementa la inferencia en `ml-model/inference/`
3. Crea una API FastAPI para servir el modelo
4. Actualiza el frontend para usar tu nueva API

## 📁 Estructura del proyecto

```
asiste-asistiendo/
├── frontend/               # React app
│   ├── public/
│   ├── src/
│   │   ├── components/    # Camera, FaceRecognition, Dashboard
│   │   ├── services/      # faceApi.js, auth.js
│   │   └── utils/
│   └── package.json
├── backend/               # Node.js API
│   ├── models/           # User schema
│   ├── routes/           # auth, face
│   ├── middleware/       # authMiddleware
│   └── server.js
├── ml-model/             # Futuro modelo propio
└── docker-compose.yml
```

## 🔒 Seguridad

- Los descriptores faciales son arrays de números, no imágenes
- Las contraseñas (opcionales) se hashean con bcrypt
- Tokens JWT con expiración configurable
- Rate limiting para prevenir ataques de fuerza bruta
- CORS configurado para dominios permitidos

## 📝 Licencia

MIT
