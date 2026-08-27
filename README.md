# Landing María Fernanda — Pensar Sentir Hacer

Sitio web profesional para **María Fernanda Arana**, psicóloga clínica especialista en Terapia de Aceptación y Compromiso (ACT). Landing page con blog dinámico, testimonios moderados y panel de administración.

> **Nota:** Esta documentación describe la arquitectura **real y vigente** del repositorio (código y configuración), no una arquitectura previa. Si algún archivo de la carpeta `docs/` contradice lo aquí descrito, la fuente de verdad es el código y la configuración del repositorio.

---

## 1. Arquitectura

| Capa | Servicio | Detalle |
|------|----------|---------|
| **Frontend** | **GitHub Pages** | HTML/CSS/JS estáticos servidos desde GitHub Pages |
| **Backend / BaaS** | **Firebase** | Firestore (base de datos) + Firebase Authentication (login admin) |
| **Imágenes** | **Cloudinary** | Almacenamiento y entrega de imágenes del blog (portadas y contenido) |
| **Dominio** | **Cloudflare + GitHub Pages** | Pendiente de configuración (ver sección Dominio) |

No se utiliza **Firebase Hosting**. El sitio público se sirve exclusivamente desde GitHub Pages.

**Propiedad de los servicios:**
- Firebase → **María Fernanda**
- Cloudinary → **María Fernanda**
- Dominio → será comprado a nombre de **María Fernanda**
- GitHub → repositorio original en **elbrujo325/landing-maria-fernanda**; María tendrá su propio **fork** como copia/propiedad del código (no se transfiere el repositorio original).

---

## 2. Estructura del proyecto

```
landing-maria-fernanda/
├── public/                          # Código servido por GitHub Pages (publish_dir)
│   ├── index.html                   # Landing principal (servicios, testimonios, form de reseña)
│   ├── blog.html                    # Listado de posts (filtros por categoría)
│   ├── blog-post.html               # Vista individual de post (+ relacionados + CTA)
│   ├── admin.html                   # Panel admin (login Google, moderar testimonios, gestionar posts)
│   ├── admin-editor.html            # Editor Quill (crear/editar posts, subir imágenes)
│   ├── assets/
│   │   ├── images/                  # Fotos optimizadas (WebP srcset + PNG)
│   │   └── logos/
│   └── src/js/
│       ├── firebase-config.js       # Config Firebase + Cloudinary (pública)
│       └── blog-renderer.js         # Render compartido de artículos (preview = publicado)
├── firebase.json                    # Config Firestore (rules + indexes). NO define Hosting.
├── firestore.rules                  # Security Rules de Firestore
├── firestore.indexes.json           # Índices compuestos de Firestore
├── .github/workflows/deploy-pages.yml  # Deploy automático a GitHub Pages
├── docs/                            # Documentación interna (revisar antes de entrega final)
└── README.md
```

---

## 3. Firebase

### 3.1 Proyecto

- **Project ID:** `pagina-web-8ab3b`
- **Servicios utilizados:** Firestore y Firebase Authentication.
- **Firebase Storage:** el proyecto **no** almacena imágenes en Storage; usa Cloudinary.

### 3.2 Configuración pública del frontend (`public/src/js/firebase-config.js`)

El archivo exporta la configuración del Firebase Web SDK (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`).

- Esta configuración es **pública por diseño**: el Firebase Web SDK la expone en el navegador de los visitantes.
- `apiKey`, `appId`, etc. **no son secretos** por sí mismos; la protección real está en las **Security Rules** de Firestore y en la configuración de Authentication.
- **Nunca** deben incluirse en el frontend o en el repositorio: claves de *service account*, keys privadas, tokens secretos ni credenciales administrativas (esto incluye el Admin SDK o la API Key del servidor de Cloudinary).

### 3.3 Colecciones Firestore

**`blogPosts`** — campos relevantes:

| Campo | Tipo | Notas |
|-------|------|-------|
| `titulo` | string | Título del post |
| `descripcionCorta` | string (opcional) | Excerpt / meta description |
| `categoria` | string | `ansiedad`, `depresion`, `pareja`, `familiar`, `autoestima`, `otros` |
| `plantilla` | string | `estandar`, `imagen-destacada`, `galeria` |
| `contenidoHtml` | string | Contenido en HTML (generado por Quill) |
| `imagenPortadaUrl` | string (opcional) | URL de Cloudinary |
| `publicado` | boolean | `true` = visible públicamente; `false` = borrador |
| `fecha` | timestamp | Fecha de creación |

**`testimonios`** — campos relevantes:

| Campo | Tipo | Notas |
|-------|------|-------|
| `nombre` | string | Nombre del autor (clave requerida por reglas) |
| `anonimo` | boolean (opcional) | Mostrar como anónimo |
| `texto` | string | Texto del testimonio |
| `estrellas` | int (1–5) | Calificación |
| `aprobado` | boolean | `true` = aprobado por admin |
| `rechazado` | boolean | `true` = rechazado |
| `fecha` | timestamp | Fecha de envío |
| `fechaAprobacion` | timestamp (opcional) | Fecha de aprobación |

### 3.4 Security Rules (`firestore.rules`)

La seguridad está íntegramente en las reglas de Firestore — **no** en el mero ocultamiento de `/admin.html`. Las páginas de admin sí comprueban autorización en el cliente, pero la barrera real es el servidor de reglas.

**Determinación de admin (`isAdmin()`):** es admin todo usuario autenticado cuyo `email` coincida con la lista configurada en las reglas:

```javascript
function isAdmin() {
  return request.auth != null
    && request.auth.token.email in [
      'pensarsentirhacer.pe@gmail.com',
      'paolosotil97@gmail.com'
    ];
}
```

Esta lista es **configuración técnica actual**, no algo que el usuario final deba editar manualmente.

**Testimonios (`/testimonios/{docId}`):**
- **Lectura pública:** solo testimonios aprobados (`aprobado == true`).
- **Creación:** reservada a usuarios **no autenticados** (`request.auth == null`), es decir, a los visitantes anónimos del sitio; siempre que:
  - incluya los campos `nombre`, `texto`, `estrellas`;
  - `estrellas` sea entero entre 1 y 5;
  - `aprobado` sea `false` (queda pendiente de moderación).
- **Admin (lectura/escritura/borrado total):** solo si `isAdmin()`.

**Posts (`/blogPosts/{docId}`):**
- **Lectura pública:** solo posts publicados (`publicado == true`).
- **Admin (lectura/escritura/borrado total):** solo si `isAdmin()` (incluye borradores).
- **Bloqueo explícito:** cualquier `create`, `update`, `delete` que no sea admin falla (`allow ... if false`).

### 3.5 Índices compuestos (`firestore.indexes.json`)

El repositorio define exactamente **tres** índices:

| Colección | Campos (orden) |
|-----------|----------------|
| `testimonios` | `aprobado` ASC, `fecha` DESC |
| `blogPosts` | `publicado` ASC, `fecha` DESC |
| `blogPosts` | `categoria` ASC, `publicado` ASC, `fecha` DESC |

### 3.6 `firebase.json`

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Contiene **únicamente** la configuración de Firestore. **No** hay sección `hosting`, por lo tanto no existe configuración de Firebase Hosting.

---

## 4. Cloudinary

- **Propiedad:** cuenta de **María Fernanda**.
- **Uso:** alojamiento de las imágenes del blog (imagen de portada e imágenes insertadas en el contenido).
- **Cómo se sube:** desde el editor, mediante petición `POST` unsigned a `https://api.cloudinary.com/v1_1/{cloudName}/image/upload` con `upload_preset` y `folder`.
- **Configuración pública existente** (`public/src/js/firebase-config.js`):
  - `cloudName`: `vzqynzsh`
  - `uploadPreset`: `blog-fernanda`
  - `folder`: `blog-fernanda`
- **Límite:** máximo 5 MB por imagen (validado en el editor).
- **Nota de seguridad:** este preset es *unsigned* (público). No se documenta aquí ninguna contraseña ni secreto de Cloudinary.

---

## 5. Blog

- **Colección Firestore:** `blogPosts`.
- **Consulta pública (listado):** `where('publicado', '==', true)` + `orderBy('fecha', 'desc')` + `limit(50)`.
- **Filtros:** por categoría (`ansiedad`, `depresion`, `pareja`, `familiar`, `autoestima`, `otros`) mediante botones en `blog.html`. El filtrado se hace en el cliente sobre los resultados cargados.
- **Búsqueda:** no implementada (no hay buscador de texto).
- **Paginación:** no implementada (se muestran los últimos 50 posts publicados).
- **Vista individual (`blog-post.html`):** obtiene el post por `id` desde la URL; solo lo muestra si `publicado == true`. Actualiza meta tags (título, descripción, Open Graph). Renderiza mediante el módulo compartido `blog-renderer.js` según la `plantilla`:
  - `estandar` — header + contenido;
  - `imagen-destacada` — hero full-width con overlay;
  - `galeria` — contenido con imágenes intercaladas.
- **Posts relacionados:** sí — carga hasta 3 posts de la misma `categoria`, excluyendo el actual.
- **CTA final:** botón de WhatsApp + enlace a ver más artículos.
- **Editor:** `admin-editor.html` con **Quill.js 1.3.7** (toolbar, módulo de redimensionado de imágenes `quill-image-resize-module`, limpieza). Vista previa con el mismo renderizador (paridad 100% preview = publicado).
- **Publicación/despublicación:** el campo booleano `publicado` controla visibilidad. Guardar borrador (`publicado = false`) o publicar (`publicado = true`).
- **Imágenes:** portada (`imagenPortadaUrl`) e imágenes en el contenido, subidas a Cloudinary.

---

## 6. Testimonios

**Visitante (usuario no autenticado):**
- Puede enviar un testimonio desde el formulario de la landing (`index.html`).
- Datos que envía: `nombre` (opcional, con opción `anonimo`), `texto` (obligatorio), `estrellas` (1–5, obligatorio).
- Validaciones: `texto` no vacío y `estrellas` entre 1 y 5 (cliente), más las validaciones de las reglas (servidor).
- Todo testimonio se guarda con `aprobado: false` (pendiente de moderación).

**Administrador:**
- Aprueba (`aprobado: true`, `rechazado: false`), rechaza (`aprobado: false`, `rechazado: true`), visualiza y elimina testimonios desde `admin.html`.

**Público (visitantes):**
- Solo ve testimonios con `aprobado == true`, ordenados por `fecha` descendente, con límite de 20, mezclados con los testimonios estáticos en la marquesina.

---

## 7. Panel administrativo

**Login (`admin.html`):**
- Autenticación con **Google** (Firebase Authentication vía `signInWithPopup` con `GoogleAuthProvider`). No usa email/contraseña.
- **Autorización:** tras el login, se verifica que el email del usuario esté en `ADMIN_EMAILS` (definido en `firebase-config.js`). En el servidor, la autorización real la impone `isAdmin()` en `firestore.rules`.
- Si el usuario no está autorizado, se cierra la sesión y se muestra error.

**Gestión de posts (panel):** listar todos (publicados y borradores), editar (redirige al editor), ver en vivo, eliminar, y crear nuevo.

**Gestión de testimonios (panel):** listar pendientes/aprobados/rechazados con estadísticas, ver detalle, aprobar, rechazar y eliminar.

**Editor (`admin-editor.html`):**
- Requiere usuario autenticado y autorizado (si no, redirige a `admin.html`).
- Edita título, descripción corta, categoría, plantilla y contenido con Quill.
- Subida de **imagen de portada** y de **imágenes de contenido** a Cloudinary.
- Guardar borrador / publicar / vista previa.

**Logout:** botón de salir en `admin.html` (`signOut`).

---

## 8. Despliegue

### 8.1 Frontend — GitHub Pages

El despliegue es **automático** mediante el workflow `.github/workflows/deploy-pages.yml`:

- Se ejecuta en cada `push` a la rama `main`.
- Usa `peaceiris/actions-gh-pages@v4` para publicar el contenido de la carpeta **`public/`** en la rama **`gh-pages`**.

La web se sirve desde la carpeta `public/` (confirmado por `publish_dir: public`).

### 8.2 Firebase — Firebase CLI

La CLI de Firebase solo gestiona los recursos definidos en `firebase.json`, que en este proyecto son únicamente **Firestore (rules e indexes)**:

```bash
# Desplegar reglas e índices de Firestore
firebase deploy --only firestore:rules,firestore:indexes --project pagina-web-8ab3b
```

> No existe un comando `firebase deploy` que publique la web pública: la web está en GitHub Pages, no en Firebase Hosting.

---

## 9. Dominio (pendiente)

El dominio aún **no está configurado**. El flujo planificado una vez se compre el dominio a nombre de María Fernanda:

```
Cloudflare  →  DNS  →  GitHub Pages  →  Custom Domain  →  HTTPS
```

1. Comprar el dominio a nombre de María Fernanda.
2. Configurar el DNS en Cloudflare apuntando a GitHub Pages.
3. Agregar el *custom domain* en el fork de GitHub Pages.
4. Hacer cumplir HTTPS.
5. **Importante:** agregar el dominio final como **Authorized Domain** en Firebase Authentication (si el flujo de login lo requiere); de lo contrario, el popup de login de Google fallará en el nuevo dominio.

---

## 10. Rellenar el admin

Para lograr que una cuenta tenga acceso al panel, debe ocurrir todo lo siguiente:

1. El usuario debe existir en Firebase Authentication.
2. Su email debe aparecer en la lista `isAdmin()` de `firestore.rules` (y, en el cliente, en `ADMIN_EMAILS`).

Dado que la lista de admins está en las reglas, cualquier alta de un nuevo administrador implica actualizar las reglas y redesplegarlas.

---

## 11. Proceso de entrega al cliente

1. **María** crea (o usa) su cuenta de GitHub.
2. **María** hace un **fork** del repositorio original `elbrujo325/landing-maria-fernanda`. Su fork es su copia/propiedad del código.
3. Se configura **GitHub Pages** en el fork de María (a partir de la carpeta `public/`).
4. Se compra/configura el **dominio** a nombre de María.
5. Se configura el **DNS en Cloudflare**.
6. Se conecta el **dominio a GitHub Pages** (custom domain + HTTPS).
7. Se configura el **dominio autorizado en Firebase Authentication** (si el login lo requiere).
8. Se **prueban** todas las funcionalidades (landing, blog, testimonios, admin, imágenes).
9. **María valida y acepta** la entrega.
10. **Paolo retira su acceso de Firebase** (su email se elimina de `isAdmin()` y de `ADMIN_EMAILS`, y se retira su membresía del proyecto Firebase).

**Propiedad final:**
- GitHub → María Fernanda (mediante su fork)
- Firebase → María Fernanda
- Cloudinary → María Fernanda
- Dominio → María Fernanda

### Rol del desarrollador (Paolo)

Paolo es colaborador técnico de Firebase **durante el desarrollo**: configuración, despliegue de reglas e índices, debugging, pruebas y mantenimiento. Al terminar configuración, pruebas, entrega y recibir aprobación de la clienta, **retirará su acceso**. Si más adelante existe un contrato de mantenimiento, el acceso podrá volver a concederse.

---

## 12. Checklist de entrega

**GitHub**
- [ ] Fork realizado por María
- [ ] GitHub Pages funcionando en el fork

**Dominio**
- [ ] Dominio comprado a nombre de María
- [ ] DNS configurado (Cloudflare)
- [ ] HTTPS funcionando

**Firebase**
- [ ] Authentication funcionando
- [ ] Dominio autorizado (si el login lo requiere)
- [ ] Firestore funcionando
- [ ] Reglas verificadas
- [ ] Índices verificados

**Cloudinary**
- [ ] Subida de imágenes funcionando

**Web pública**
- [ ] Landing
- [ ] Navegación
- [ ] Blog
- [ ] Posts individuales
- [ ] Testimonios
- [ ] Formulario de testimonio
- [ ] WhatsApp
- [ ] Responsive

**Admin**
- [ ] Login
- [ ] Crear post
- [ ] Editar post
- [ ] Publicar
- [ ] Despublicar
- [ ] Subida de imágenes
- [ ] Moderar testimonios (aprobar/rechazar)
- [ ] Logout

**Seguridad**
- [ ] El visitante no puede modificar posts
- [ ] El visitante no puede modificar testimonios existentes
- [ ] Los borradores no son públicos
- [ ] Las operaciones administrativas requieren autorización

**Cierre**
- [ ] Cliente acepta la entrega
- [ ] Paolo retira su acceso de Firebase

---

## 13. Mantenimiento

- **Contenido:** posts y testimonios se gestionan desde el panel admin (no requiere tocar código).
- **Moderación:** los testimonios enviados quedan en estado pendiente hasta que se aprueban.
- **Reglas e índices:** ante nuevos tipos de consulta, actualizar `firestore.rules` y/o `firestore.indexes.json` y redesplegar con `firebase deploy --only firestore:rules,firestore:indexes`.
- **Nuevo administrador:** requiere alta en Firebase Authentication + actualizar la lista de admins en reglas y en `firebase-config.js`.

---

## 14. Nota sobre `docs/`

La carpeta `docs/` contiene documentación de etapas previas del proyecto (por ejemplo, `DOCUMENTACION_TECNICA.tex/.pdf`) con referencias a una arquitectura **anterior** (Firebase Hosting, `firebase deploy`, dominio `.web.app`, ID de proyecto distinto). Esa documentación **no** se ha modificado en esta tarea. **Antes de la entrega final se debe revisar y reconciliar `docs/`** para que no queden referencias a una arquitectura que ya no se usa.

---

## 15. Autor

**Henry Paolo Alfaro Sotil** — creador del proyecto.

- GitHub: [@elbrujo325](https://github.com/elbrujo325)
- LinkedIn: [linkedin.com/in/henry-paolo-alfaro-sotil](https://linkedin.com/in/henry-paolo-alfaro-sotil)
- Email: paolosotil97@gmail.com
  Proyecto entregado y administrado por María Fernanda.
