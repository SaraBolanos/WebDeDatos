# Ink & Quills 📚✒️

Aplicación web de catálogo de libros con arquitectura de microservicios.

## 🚀 Inicio Rápido

### Requisitos previos

- **Docker Desktop** (incluye Docker y Docker Compose)
  - Descargar de: https://www.docker.com/products/docker-desktop
  - Versión mínima: Docker 20.x, Docker Compose 2.x

### Levantar la aplicación completa

```bash
docker compose up --build
```

Este comando levanta automáticamente:
- ✅ Frontend en http://localhost:3000
- ✅ API Gateway en http://localhost:8080
- ✅ Bases de datos (PostgreSQL y MongoDB)
- ✅ Todos los microservicios

**¡Eso es todo!** No necesitas instalar Python, Node.js, ni ninguna otra dependencia.

### Acceder a la aplicación

1. **Frontend**: http://localhost:3000
2. **API Gateway**: http://localhost:8080
3. **Documentación API (Swagger)**: http://localhost:8080/docs

### Detener la aplicación

```bash
docker compose down
```

---

## 📦 Arquitectura

El proyecto consta de 6 servicios en contenedores Docker:

1. **Frontend** (Nginx) - Interfaz de usuario en http://localhost:3000
2. **Gateway** (Node.js) - API Gateway en http://localhost:8080
3. **Users Service** (Node.js) - Autenticación y favoritos
4. **Books Service** (Python/Flask) - Búsqueda de libros
5. **PostgreSQL** - Base de datos para usuarios y favoritos
6. **MongoDB** - Base de datos caché para libros

## 0. Software necesario

Para ejecutar este proyecto necesitas instalar:

- **Docker Desktop** (incluye Docker y Docker Compose)
  - Descargar de: https://www.docker.com/products/docker-desktop
  - Versión mínima: Docker 20.x, Docker Compose 2.x

- **Navegador web moderno**
  - Chrome, Firefox, Edge o Safari

## 1. Servicios que hay que arrancar

El proyecto consta de 6 servicios que se arrancan automáticamente con Docker Compose:

1. **Frontend** (Servidor web Nginx para la interfaz de usuario)
2. **PostgreSQL** (Base de datos para usuarios y favoritos)
3. **MongoDB** (Base de datos caché para libros)
4. **Users Service** (Microservicio de autenticación y favoritos - Node.js)
5. **Books Service** (Microservicio de búsqueda de libros - Python)
6. **Gateway** (API Gateway - Node.js)

## 2. Dependencias que hay que instalar

**No es necesario instalar dependencias manualmente.**

Docker se encarga de instalar todas las dependencias dentro de cada contenedor:

- **Frontend**: Servidor Nginx (Alpine Linux)
- **Gateway**: `express`, `http-proxy-middleware`, `cors`, `swagger-ui-express`, `yamljs`
- **Users Service**: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`
- **Books Service**: `flask`, `flask-cors`, `pymongo`, `requests`, `python-dotenv`

## 3. Cómo arrancar la aplicación

### Paso 1: Clonar o abrir el proyecto

```bash
cd "c:\Users\Sara\Desktop\WebDeDatosGIT\WebDeDatos"
```

### Paso 2: Levantar todos los servicios con Docker Compose

```bash
docker compose up --build
```

Este comando:
- Construye las imágenes de Docker
- Descarga las imágenes base necesarias
- Inicia PostgreSQL y MongoDB
- Inicia los 3 microservicios (users, books, gateway)
- Inicia el servidor web del frontend (Nginx)
- Configura la red entre contenedores

**Tiempo de inicio**: 30-60 segundos la primera vez

### Verificar que todo está funcionando

Los servicios estarán disponibles en:

- **Frontend**: http://localhost:3000 ⭐ (Abre este en tu navegador)
- **API Gateway**: http://localhost:8080
- **Documentación API (Swagger)**: http://localhost:8080/docs
- **Health Check Gateway**: http://localhost:8080/health
- **Users Service**: http://localhost:3001 (interno)
- **Books Service**: http://localhost:5000 (interno)

### Ver logs de los servicios

```bash
docker logs ink_frontend
docker logs ink_gateway
docker logs ink_users
docker logs ink_books
```

### Detener los servicios

```bash
docker compose down
```

## 4. Usar la aplicación

1. Abre tu navegador en **http://localhost:3000**
2. Puedes buscar libros sin necesidad de login
3. Para usar favoritos, debes registrarte o hacer login
4. Accede a la documentación de la API en: http://localhost:8080/docs

## Puertos utilizados

| Servicio | Puerto |
|----------|--------|
| Frontend | 3000 |
| Gateway | 8080 |
| Users Service | 3001 |
| Books Service | 5000 |
| PostgreSQL | 5432 |
| MongoDB | 27017 |

## Solución de problemas

**Error: "port is already allocated"**
- Otro servicio está usando el puerto
- Detén otros servicios o cambia los puertos en `docker-compose.yml`

**Los servicios no inician:**
```bash
docker compose down -v
docker compose up --build
```

**El frontend no se conecta al backend:**
- Verifica que el gateway esté corriendo: http://localhost:8080/health
- Revisa la consola del navegador (F12) para ver errores CORS
- Asegúrate de que todos los contenedores estén corriendo: `docker ps`
