# Plan de Implementación: Sistema de Comentarios para Blog

## Objetivo
Agregar una sección de comentarios a cada publicación del blog donde los usuarios puedan comentar de forma anónima o con su nombre, siguiendo el mismo patrón que la sección de testimonios.

## Arquitectura Propuesta

### 1. Estructura de Datos en Firestore
**Colección**: `blogComments`

**Documento**:
- `postId` (string): ID del artículo del blog al que pertenece el comentario (índice)
- `nombre` (string, opcional): Nombre del comentarista (opcional, para comentarios no anónimos)
- `anonimo` (boolean): Si es true, se mostrará como anónimo o solo iniciales
- `texto` (string): Contenido del comentario
- `fecha` (timestamp): Fecha de creación
- `aprobado` (boolean): Estado de moderación (false por defecto, requiere aprobación de admin)

### 2. Reglas de Seguridad de Firestore
Agregar al archivo `firestore.rules`:

```
// ============================================================
// COMENTARIOS DE BLOG COLLECTION
// ============================================================
match /blogComments/{docId} {
  // Lectura pública: solo comentarios aprobados para el post específico
  allow read: if resource.data.aprobado == true;
  
  // Creación pública: cualquiera puede enviar un comentario
  allow create: if request.auth == null
    && request.resource.data.keys().hasAll(['postId', 'texto'])
    && request.resource.data.texto is string
    && request.resource.data.texto.size() >= 5
    && request.resource.data.texto.size() <= 1000
    && (request.resource.data.nombre == null || 
        request.resource.data.nombre is string &&
        request.resource.data.nombre.size() <= 100)
    && request.resource.data.aprobado == false;
  
  // Acceso total para administradores
  allow read, write, delete: if isAdmin();
}
```

### 3. Cambios en blog-post.html

#### Estructura HTML a agregar (después del CTA y antes del footer):
```html
<!-- COMENTARIOS -->
<section class="comments-section" id="commentsSection" style="display: none;">
  <div class="container">
    <h2 class="section-title">Comentarios</h2>
    <p class="section-subtitle">Comparte tu reflexión o experiencia relacionada con este artículo</p>
    
    <!-- Contador de comentarios -->
    <div class="comments-count" id="commentsCount">
      Cargando comentarios...
    </div>
    
    <!-- Lista de comentarios -->
    <div class="comments-grid" id="commentsGrid">
      <!-- Los comentarios se insertarán aquí dinámicamente -->
    </div>
    
    <!-- Formulario de nuevo comentario -->
    <div class="comments-form-wrapper" id="commentsFormWrapper">
      <h3 class="comments-form-title">Deja tu comentario</h3>
      <p class="comments-form-subtitle">Tu opinión puede ayudar a otros lectores</p>
      <form id="commentForm" class="comment-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="commentNombre">Nombre <span class="optional">(opcional)</span></label>
            <input type="text" id="commentNombre" name="nombre" maxlength="100" placeholder="Tu nombre o iniciales">
          </div>
          <div class="form-group checkbox-group">
            <input type="checkbox" id="commentAnonimo" name="anonimo" value="true">
            <label for="commentAnonimo">Publicar de forma anónima (solo se mostrarán tus iniciales si proporcionas nombre)</label>
          </div>
        </div>
        <div class="form-group">
          <label for="commentTexto">Tu comentario <span class="required">*</span></label>
          <textarea id="commentTexto" name="texto" rows="4" maxlength="1000" placeholder="Escribe tu reflexión o pregunta..." required></textarea>
          <div class="char-count"><span id="commentCharCount">0</span>/1000</div>
        </div>
        <button type="submit" class="btn btn-primary" id="submitComment">
          <span class="btn-text">Publicar comentario</span>
          <span class="btn-loading" style="display:none;"><svg class="spinner" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg> Publicando...</span>
        </button>
        <p class="form-note">Los comentarios se moderan antes de publicarse. No se muestran datos de contacto.</p>
        <div id="commentFormToast" class="form-toast" role="alert" aria-live="polite" style="display:none;"></div>
      </form>
    </div>
  </div>
</section>
```

### 4. Lógica JavaScript para blog-post.html

Agregar dentro del script principal de blog-post.html (después de cargar los posts relacionados):

```javascript
// --- COMENTARIOS ---
const commentsSection = document.getElementById('commentsSection');
const commentsGrid = document.getElementById('commentsGrid');
const commentsCount = document.getElementById('commentsCount');
const commentForm = document.getElementById('commentForm');
const commentToast = document.getElementById('commentFormToast');
const commentCharCount = document.getElementById('commentCharCount');
const commentTexto = document.getElementById('commentTexto');
const submitCommentBtn = document.getElementById('submitComment');

// Contador de caracteres
if (commentTexto && commentCharCount) {
  commentTexto.addEventListener('input', () => {
    commentCharCount.textContent = commentTexto.value.length;
  });
}

// Cargar comentarios aprobados para este post
async function loadComments() {
  if (!commentsGrid || !id) return;
  
  try {
    const { query, collection, where, orderBy, onSnapshot, limit } = await import(
      'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js'
    );
    
    const q = query(
      collection(db, 'blogComments'),
      where('postId', '==', id),
      where('aprobado', '==', true),
      orderBy('fecha', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Actualizar contador
      commentsCount.textContent = `${comments.length} ${comments.length === 1 ? 'comentario' : 'comentarios'}`;
      
      // Renderizar comentarios
      if (comments.length === 0) {
        commentsGrid.innerHTML = `
          <div class="empty-comments">
            <p>Aún no hay comentarios. Sé el primero en compartir tu reflexión.</p>
          </div>
        `;
      } else {
        commentsGrid.innerHTML = comments.map(comment => {
          const fecha = comment.fecha?.toDate ? formatDate(comment.fecha.toDate()) : formatDate(comment.fecha);
          const nombreDisplay = comment.anonimo
            ? (comment.nombre ? comment.nombre.charAt(0) + '.' : 'Anónimo')
            : (comment.nombre || 'Anónimo');
            
          return `
            <div class="comment-card">
              <div class="comment-header">
                <span class="comment-author">— ${nombreDisplay}</span>
                <time class="comment-date">${fecha}</time>
              </div>
              <p class="comment-text">${escapeHtml(comment.texto)}</p>
            </div>
          `;
        }).join('');
      }
    });
    
    // Guardar la función de unsubscription para limpieza si es necesario
    window.unsubscribeComments = unsubscribe;
  } catch (error) {
    console.error('Error cargando comentarios:', error);
    commentsCount.textContent = 'Error al cargar comentarios';
    commentsGrid.innerHTML = '<div class="error">Error al cargar comentarios. Intenta de nuevo más tarde.</div>';
  }
}

// Manejar envío de nuevo comentario
if (commentForm) {
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(commentForm);
    const data = {
      postId: id, // ID del artículo actual
      nombre: formData.get('nombre')?.trim() || null,
      anonimo: formData.get('anonimo') === 'true',
      texto: formData.get('texto')?.trim(),
      fecha: serverTimestamp(),
      aprobado: false // Requiere moderación
    };
    
    // Validación
    if (!data.texto || data.texto.length < 5) {
      showCommentToast('El comentario debe tener al menos 5 caracteres', 'error');
      return;
    }
    
    if (data.nombre && data.nombre.length > 100) {
      showCommentToast('El nombre no puede exceder 100 caracteres', 'error');
      return;
    }
    
    // Estado de envío
    submitCommentBtn.disabled = true;
    submitCommentBtn.querySelector('.btn-text').style.display = 'none';
    submitCommentBtn.querySelector('.btn-loading').style.display = 'inline-flex';
    
    try {
      await addDoc(collection(db, 'blogComments'), data);
      showCommentToast('¡Gracias! Tu comentario fue enviado para revisión. Se publicará tras ser aprobado.', 'success');
      commentForm.reset();
      commentCharCount.textContent = '0';
    } catch (error) {
      console.error('Error enviando comentario:', error);
      showCommentToast('Hubo un error al enviar. Intenta de nuevo más tarde.', 'error');
    } finally {
      submitCommentBtn.disabled = false;
      submitCommentBtn.querySelector('.btn-text').style.display = 'inline';
      submitCommentBtn.querySelector('.btn-loading').style.display = 'none';
    }
  });
}

function showCommentToast(message, type) {
  if (!commentToast) return;
  commentToast.textContent = message;
  commentToast.className = `form-toast ${type}`;
  commentToast.style.display = 'block';
  setTimeout(() => { commentToast.style.display = 'none'; }, 6000);
}

// Mostrar la sección de comentarios
function showCommentsSection() {
  if (commentsSection) {
    commentsSection.style.display = 'block';
  }
}

// Llamar a cargar comentarios después de cargar el artículo
// En la función loadArticle(), después de loadRelatedPosts():
// await loadComments();
// showCommentsSection();
```

### 5. Estilos CSS Propuestos

Agregar al final del bloque `<style>` en blog-post.html:

```css
/* COMENTARIOS SECTION */
.comments-section {
  padding: var(--space-3xl) 0 var(--space-2xl);
  border-top: 1px solid var(--card-border);
}

.comments-section .section-title {
  text-align: center;
}

.comments-section .section-subtitle {
  text-align: center;
  max-width: 600px;
  margin: 0 auto 24px;
}

.comments-count {
  text-align: center;
  margin-bottom: 24px;
  font-weight: 600;
  color: var(--text-dark);
}

.comments-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
  min-height: 80px; /* Para evitar salto de layout */
}

.comment-card {
  background: var(--white);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--card-border);
  transition: all 0.3s ease;
}

.comment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(111, 193, 255, 0.1);
  border-color: var(--celeste-mid);
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.comment-author {
  font-weight: 600;
  color: var(--text-dark);
}

.comment-date {
  font-size: 0.875rem;
  color: var(--text-dark);
  opacity: 0.7;
}

.comment-text {
  color: var(--text-dark);
  line-height: 1.6;
}

.empty-comments {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-dark);
  opacity: 0.7;
}

.empty-comments p {
  margin: 0;
}

/* Formulario de comentarios - reutiliza estilos del formulario de testimonios */
.comments-form-wrapper {
  background: var(--white);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid var(--card-border);
}

.comments-form-title {
  text-align: center;
  margin-bottom: 12px;
}

.comments-form-subtitle {
  text-align: center;
  color: var(--text-dark);
  opacity: 0.8;
  max-width: 500px;
  margin: 0 auto 24px;
}

/* Responsponsive */
@media (max-width: 768px) {
  .comments-section {
    padding: var(--space-2xl) 0 var(--space-xl);
  }
  
  .comment-card {
    padding: 16px;
  }
  
  .comment-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .comments-form-wrapper {
    padding: 16px;
  }
}
```

### 6. Integración en el flujo existente

En `blog-post.html`, dentro de la función `loadArticle()`, después de cargar los posts relacionados:

```javascript
// Después de:
// await loadRelatedPosts(db, data.categoria, id, rendered.relatedGrid, rendered.relatedSection);

// Agregar:
await loadComments();
showCommentsSection();
```

### 7. Consideraciones de Moderación

- Los comentarios se envían con `aprobado: false`
- Solo los administradores pueden cambiarlos a `true` mediante:
  - Interfaz de admin (requiere desarrollo adicional en admin.html)
  - Firebase Console directamente
  - Herramientas externas de administración
- Se puede agregar una vista de moderación en admin.html siguiendo el mismo patrón que testimonios si se desea

### 8. Ventajas de este Enfoque

1. **Consistencia**: Usa el mismo patrón que testimonios (que ya funciona)
2. **Escalabilidad**: Estructura simple y eficiente en Firestore
3. **Moderación integrada**: Evita spam y contenido inapropiado
4. **Anonimato opcional**: Respeta la privacidad de los usuarios
5. **Mantenimiento mínimo**: Reutiliza componentes y lógica existente
6. **Experiencia de usuario familiar**: Los usuarios ya conocen el sistema de testimonios

### 9. Próximos Pasos para Implementación

1. ✅ **Análisis completado** (este documento)
2. Agregar reglas de Firestore para `blogComments`
3. Modificar `blog-post.html`:
   - Agregar sección HTML de comentarios
   - Agregar lógica JavaScript para carga y envío
   - Agregar estilos CSS
4. Probar en entorno local
5. Hacer push a `main` para activar GitHub Actions
6. Verificar despliegue en github.io y dominio personalizado
7. (Opcional) Agregar interfaz de moderación en admin.html

### 10. Estimación de Tiempo

- **Desarrollo**: 2-3 horas
- **Testing**: 30-60 minutos
- **Total**: ~3 horas

Este enfoque garantiza que la característica se integre perfectamente con la arquitectura existente, mantenga la consistencia de UX y siga las mejores prácticas establecidas por la sección de testimonios.