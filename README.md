# Ink & Quills 📚✒️

Aplicación web de catálogo de libros con arquitectura de microservicios.

## 0. Software necesario

Para ejecutar este proyecto necesitas instalar:

- **Docker Desktop** (incluye Docker y Docker Compose)
  - Descargar de: https://www.docker.com/products/docker-desktop
  - Versión mínima: Docker 20.x, Docker Compose 2.x

- **Navegador web moderno**
  - Chrome, Firefox, Edge o Safari

## 1. Servicios que hay que arrancar

El proyecto consta de 5 servicios que se arrancan automáticamente con Docker Compose:

1. **PostgreSQL** (Base de datos para usuarios y favoritos)
2. **MongoDB** (Base de datos caché para libros)
3. **Users Service** (Microservicio de autenticación y favoritos - Node.js)
4. **Books Service** (Microservicio de búsqueda de libros - Python)
5. **Gateway** (API Gateway - Node.js)

## 2. Dependencias que hay que instalar

**No es necesario instalar dependencias manualmente.**

Docker se encarga de instalar todas las dependencias dentro de cada contenedor:

- **Gateway**: `express`, `http-proxy-middleware`, `cors`, `swagger-ui-express`, `yamljs`
- **Users Service**: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `cors`, `helmet`
- **Books Service**: `flask`, `flask-cors`, `pymongo`, `requests`, `python-dotenv`

## 3. Cómo arrancar la parte servidora

### Paso 1: Clonar o abrir el proyecto

```bash
cd "c:\Users\Sara\Desktop\Web de datos"
```

### Paso 2: Levantar todos los servicios con Docker Compose

```bash
docker-compose up --build
```

Este comando:
- Construye las imágenes de Docker
- Descarga las imágenes base necesarias
- Inicia PostgreSQL y MongoDB
- Inicia los 3 microservicios (users, books, gateway)
- Configura la red entre contenedores

**Tiempo de inicio**: 30-60 segundos la primera vez

### Verificar que todo está funcionando

Los servicios estarán disponibles en:

- **API Gateway**: http://localhost:8080
- **Documentación API (Swagger)**: http://localhost:8080/docs
- **Health Check Gateway**: http://localhost:8080/health
- **Users Service**: http://localhost:3001 (interno)
- **Books Service**: http://localhost:5000 (interno)

### Ver logs de los servicios

```bash
docker logs ink_gateway
docker logs ink_users
docker logs ink_books
```

### Detener los servicios

```bash
docker-compose down
```

## 4. Cómo acceder a la parte cliente

### Opción 1: Abrir directamente el archivo HTML

1. Navega a la carpeta `frontend`
2. Abre el archivo `index.html` en tu navegador:
   - Doble clic en `index.html`, o
   - Desde el navegador: `Archivo > Abrir archivo` → selecciona `index.html`

### Opción 2: Usar un servidor local (recomendado)

Con Visual Studio Code:
1. Instala la extensión "Live Server"
2. Click derecho en `index.html` → "Open with Live Server"

Con Python:
```bash
cd frontend
python -m http.server 3000
```
Luego abre: http://localhost:3000

Con Node.js:
```bash
cd frontend
npx serve .
```

### Usar la aplicación

1. La aplicación se abrirá en la página de inicio
2. Puedes buscar libros sin necesidad de login
3. Para usar favoritos, debes registrarte o hacer login
4. Accede a la documentación de la API en: http://localhost:8080/docs

## Puertos utilizados

| Servicio | Puerto |
|----------|--------|
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
docker-compose down -v
docker-compose up --build
```

**El frontend no se conecta al backend:**
- Verifica que el gateway esté corriendo: http://localhost:8080/health
- Revisa la consola del navegador (F12) para ver errores CORS
