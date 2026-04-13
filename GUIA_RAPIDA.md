# 🚀 Guía Rápida - Última Milla

## Paso 1: Levanta la infraestructura (Kafka + Redis)

```bash
cd c:\Users\USER\Downloads\ultima-milla-backend\ultima-milla-backend
docker-compose up -d
```

Espera 3-5 segundos a que levanten completamente.

---

## Paso 2: Levanta el Backend (en OTRA terminal)

```bash
cd c:\Users\USER\Downloads\ultima-milla-backend\ultima-milla-backend
npm install
PORT=3001 npm run start:dev
```

Verifica que veas: `[NestFactory] Application listening on port 3001`

---

## Paso 3: Levanta el Frontend (en OTRA terminal)

```bash
cd c:\Users\USER\Downloads\ultima-milla-backend\frontend
npm run dev
```

Verifica que veas: `Ready in X.Xs`

---

## URLs de Acceso

- **Frontend**: http://localhost:3000
  - Cliente: http://localhost:3000/cliente
  - Restaurante: http://localhost:3000/restaurante
  - Repartidor: http://localhost:3000/repartidor

- **Backend API**: http://localhost:3001
- **Kafka UI**: http://localhost:8080
- **Redis Commander**: http://localhost:8081

---

## ⚙️ Variables de Entorno

### Backend: `.env` (en carpeta `ultima-milla-backend`)

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

### Frontend: `.env.local` (en carpeta `frontend`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

---

## ✅ Verificación

Si todo funciona correctamente:
- ✅ Frontend carga en http://localhost:3000
- ✅ Dashboard Cliente muestra lista de pedidos (desde backend)
- ✅ Map carga en iframe de Google Maps
- ✅ No hay errores en console del navegador

## 🐛 Si hay errores

1. **ERROR: Can't connect to backend**
   - Verifica que backend esté corriendo en puerto 3001
   - Revisa `.env.local` tenga `NEXT_PUBLIC_API_URL=http://localhost:3001`

2. **ERROR: WebSocket connection failed**
   - Backend debe estar corriendo
   - Socket.IO está en namespace `/tracking`

3. **ERROR: 404 en /pedidos**
   - Backend no está corriendo
   - Puerto es incorrecto

---

## 📋 Resumen de Carpetas

```
ultimamilla-backend/
├── dockerfile-compose.yml      ← Infraestructura (Kafka, Redis)
├── .env                        ← Variables backend
├── src/
│   ├── main.ts                ← Punto entrada backend
│   ├── app.module.ts
│   └── modules/
│       ├── pedidos/           ← API /pedidos
│       ├── tracking/          ← WebSocket /tracking
│       └── ...
│
└── frontend/
    ├── .env.local             ← Variables frontend
    ├── src/
    │   └── app/
    │       ├── page.tsx       ← Inicio (/)
    │       ├── cliente/       ← (/cliente)
    │       ├── restaurante/   ← (/restaurante)
    │       └── repartidor/    ← (/repartidor)
    └── package.json
```
