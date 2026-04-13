# 🚀 EJECUTAR ÚLTIMA MILLA - GUÍA SIMPLE

## ⚡ Forma Más Fácil (SIN Docker)

### Abre 2 ventanas de CMD/PowerShell

**VENTANA 1 - Backend:**
```
Haz doble-click en:  run-backend.bat
O en PowerShell:     .\run-backend.bat
```

Verás: ✅ `[NestFactory] Application listening on port 3001`

---

**VENTANA 2 - Frontend:**
```
Haz doble-click en:  run-frontend.bat
O en PowerShell:     .\run-frontend.bat
```

Verás: ✅ `Ready in X.Xs` y `Local: http://localhost:3000`

---

## 📍 Accede a:

| URL | Qué es |
|-----|--------|
| http://localhost:3000 | Frontend principal |
| http://localhost:3000/cliente | Dashboard Cliente |
| http://localhost:3000/restaurante | Dashboard Restaurante |
| http://localhost:3000/repartidor | Dashboard Repartidor |

---

## ❌ Si no funciona

**Error: "npm: command not found"**
- Node.js no está instalado
- Descargalo de: https://nodejs.org (versión LTS)
- Reinicia la terminal después de instalar

**Error: "port 3001 already in use"**
- Puerto 3001 ya está usado
- Intenta matar el proceso: `netstat -ano | findstr :3001`
- O ejecuta el backend en otro puerto: `set PORT=3002`

**Error: "Cannot find module"**
- Corre primero: `npm install`
- En cada carpeta (backend y frontend)

---

## 🎯 Resumen

1. **Abre Terminal 1** → `run-backend.bat` → Verifica: "port 3001"
2. **Abre Terminal 2** → `run-frontend.bat` → Verifica: "port 3000"  
3. **Abre navegador** → http://localhost:3000
4. ✅ **Listo!**

---

Es todo. Solo eso. 🎉
