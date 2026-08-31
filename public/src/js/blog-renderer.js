/**
 * Blog Renderer — Módulo compartido para renderizado unificado de artículos
 * Usado por: admin-editor.html (preview) y blog-post.html (vista real)
 *
 * Garantiza paridad 100% entre preview y publicado.
 *
 * @module blog-renderer
 */

// ============================================
// CONFIGURACIÓN Y CONSTANTES
// ============================================

export const categoryLabels = {
  ansiedad: 'Ansiedad',
  depresion: 'Depresión',
  pareja: 'Relaciones de pareja',
  familiar: 'Relaciones familiares',
  autoestima: 'Autoestima',
  otros: 'Otros'
};

export const templateNames = {
  estandar: 'Estándar',
  'imagen-destacada': 'Imagen destacada',
  galeria: 'Galería + texto'
};

// ============================================
// HELPERS UTILITARIOS
// ============================================

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Formatea fecha manejando: Date, Firestore Timestamp, objeto {seconds, nanoseconds}, string, number
 * Devuelve 'Fecha no disponible' si no es parseable.
 */
export function formatDate(date) {
  if (!date) return 'Fecha no disponible';

  let d;
  if (date instanceof Date) {
    d = date;
  } else if (date && typeof date.toDate === 'function') {
    // Firestore Timestamp (v9+ SDK)
    d = date.toDate();
  } else if (date && typeof date.seconds === 'number') {
    // Objeto tipo Timestamp serializado ({seconds, nanoseconds})
    d = new Date(date.seconds * 1000);
  } else if (typeof date === 'string' || typeof date === 'number') {
    d = new Date(date);
  } else {
    return 'Fecha no disponible';
  }

  if (isNaN(d.getTime())) return 'Fecha no disponible';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function getExcerpt(data, maxLength = 180) {
  if (data.descripcionCorta?.trim()) {
    return escapeHtml(data.descripcionCorta.trim());
  }
  return escapeHtml(stripHtml(data.contenidoHtml || '').substring(0, maxLength));
}

export function getCoverUrl(data) {
  return data.imagenPortadaUrl || '';
}

export function getTemplate(data) {
  return data.plantilla || 'estandar';
}

// ============================================
// BUILDERS DE COMPONENTES
// ============================================

/**
 * Construye el badge de categoría
 */
function buildCategoryBadge(category) {
  const label = categoryLabels[category] || category;
  return `<span class="article-category">${escapeHtml(label)}</span>`;
}

/**
 * Construye la línea de meta (autor + fecha)
 */
function buildMeta(fecha) {
  const fechaTexto = formatDate(fecha);
  return `
    <div class="article-meta">
      <div class="author">
        <span class="author-avatar">
          <img src="assets/images/foto-fernanda-72.webp"
               srcset="assets/images/foto-fernanda-72.webp 72w,
                       assets/images/foto-fernanda-108.webp 108w,
                       assets/images/foto-fernanda-144.webp 144w"
               sizes="32px"
               alt="María Fernanda Arana"
               loading="lazy">
        </span>
        <span class="author-name">María Fernanda Arana</span>
      </div>
      <time>${fechaTexto}</time>
    </div>
  `;
}

/**
 * Construye el header estándar (para plantillas 'estandar' y 'galeria')
 * Genera HTML compatible con CSS de blog-post.html (.article-cover figure > img)
 */
export function buildStandardHeader(data, options = {}) {
  const { showDescription = true } = options;
  const coverUrl = getCoverUrl(data);
  const excerpt = getExcerpt(data);

  let html = '';

  // Imagen de portada (si existe) - estructura compatible con blog-post.html CSS
  if (coverUrl) {
    html += `<figure class="article-cover">
      <img src="${coverUrl}" alt="${escapeHtml(data.titulo)}" loading="eager">
    </figure>`;
  }

  // Header del artículo
  html += `
    <header class="article-header">
      ${buildCategoryBadge(data.categoria)}
      <h1 class="article-title">${escapeHtml(data.titulo)}</h1>
      ${buildMeta(data.fecha)}
    </header>
  `;

  // Descripción/excerpt
  if (showDescription && excerpt) {
    html += `<p class="article-description">${excerpt}</p>`;
  }

  return html;
}

/**
 * Construye el hero para plantilla 'imagen-destacada'
 * Imagen full-width con overlay de título/meta/description
 */
export function buildHero(data, options = {}) {
  const coverUrl = getCoverUrl(data);
  if (!coverUrl) {
    // Fallback a header estándar si no hay imagen
    return buildStandardHeader(data, options);
  }

  const excerpt = getExcerpt(data);
  const hasDescription = excerpt && excerpt.trim().length > 0;

  return `
    <figure class="article-featured-cover">
      <img src="${coverUrl}" alt="${escapeHtml(data.titulo)}" loading="eager">
      <div class="article-featured-overlay">
        ${buildCategoryBadge(data.categoria)}
        <h1 class="article-title">${escapeHtml(data.titulo)}</h1>
        ${buildMeta(data.fecha)}
        ${hasDescription ? `<p class="article-description" style="color: rgba(255,255,255,0.9); margin-top: 16px; max-width: 720px; font-size: 1rem; line-height: 1.7;">${excerpt}</p>` : ''}
      </div>
    </figure>
  `;
}

/**
 * Construye el layout de galería (plantilla 'galeria')
 * Intercala imágenes cada ~350 palabras o usa marcadores <!-- gallery-img-N -->
 */
export function buildGalleryLayout(data, options = {}) {
  const contentHtml = data.contenidoHtml || '';
  const coverUrl = getCoverUrl(data);

  // Extraer imágenes del contenido HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = contentHtml;
  const images = Array.from(tempDiv.querySelectorAll('img')).map(img => ({
    src: img.src,
    alt: img.alt || '',
    // Remover la imagen del contenido para evitar duplicados
    originalHtml: img.outerHTML
  }));

  // Remover imágenes del contenido para que no se dupliquen
  let cleanContent = contentHtml;
  images.forEach(img => {
    cleanContent = cleanContent.replace(img.originalHtml, '');
  });

  // Si no hay imágenes en el contenido pero hay portada, usar portada como primera imagen
  let galleryImages = images;
  if (images.length === 0 && coverUrl) {
    galleryImages = [{ src: coverUrl, alt: data.titulo, originalHtml: '' }];
  }

  // Dividir contenido en párrafos para intercalar imágenes
  const tempContent = document.createElement('div');
  tempContent.innerHTML = cleanContent;
  const paragraphs = Array.from(tempContent.querySelectorAll('p, h2, h3, blockquote, ul, ol'));

  // Si hay marcadores explícitos de galería, usarlos
  const markerRegex = /<!--\s*gallery-img-(\d+)\s*-->/g;
  let markers = [];
  let match;
  while ((match = markerRegex.exec(contentHtml)) !== null) {
    markers.push({ index: parseInt(match[1]), position: match.index });
  }

  let html = '';

  // Imagen de portada principal (si es diferente a las de galería)
  if (coverUrl && images.length > 0) {
    const coverIsInGallery = images.some(img => img.src === coverUrl);
    if (!coverIsInGallery) {
      html += `<figure class="article-cover gallery-main-cover">
        <img src="${coverUrl}" alt="${escapeHtml(data.titulo)}" loading="eager">
      </figure>`;
    }
  } else if (coverUrl && galleryImages.length > 0) {
    html += `<figure class="article-cover gallery-main-cover">
      <img src="${coverUrl}" alt="${escapeHtml(data.titulo)}" loading="eager">
    </figure>`;
  }

  // Header
  html += `
    <header class="article-header">
      ${buildCategoryBadge(data.categoria)}
      <h1 class="article-title">${escapeHtml(data.titulo)}</h1>
      ${buildMeta(data.fecha)}
    </header>
  `;

  // Excerpt/descripción
  const excerpt = getExcerpt(data);
  if (excerpt) {
    html += `<p class="article-description">${excerpt}</p>`;
  }

  // Contenido con imágenes intercaladas
  html += '<div class="article-content gallery-content">';

  if (markers.length > 0 && galleryImages.length > 0) {
    // Usar marcadores explícitos
    let lastIndex = 0;
    markers.forEach((marker, i) => {
      const beforeHtml = cleanContent.substring(lastIndex, marker.position);
      html += beforeHtml;

      const imgIndex = (marker.index - 1) % galleryImages.length;
      const img = galleryImages[imgIndex];
      html += `<figure class="gallery-inline-image">
        <img src="${img.src}" alt="${escapeHtml(img.alt || data.titulo)}" loading="lazy">
        ${img.alt ? `<figcaption>${escapeHtml(img.alt)}</figcaption>` : ''}
      </figure>`;

      lastIndex = marker.position + marker[0].length;
    });
    html += cleanContent.substring(lastIndex);
  } else if (galleryImages.length > 0 && paragraphs.length > 1) {
    // Intercalar automáticamente: 1 imagen cada ~350 palabras o cada N párrafos
    const wordsPerImage = 350;
    let wordCount = 0;
    let imageIndex = 0;

    paragraphs.forEach((p, i) => {
      html += p.outerHTML;
      const text = p.textContent || '';
      wordCount += text.split(/\s+/).filter(w => w.length > 0).length;

      // Insertar imagen después de este párrafo si toca
      const shouldInsert = wordCount >= wordsPerImage * (imageIndex + 1) &&
                           imageIndex < galleryImages.length &&
                           i < paragraphs.length - 1; // No insertar al final

      if (shouldInsert) {
        const img = galleryImages[imageIndex];
        html += `<figure class="gallery-inline-image">
          <img src="${img.src}" alt="${escapeHtml(img.alt || data.titulo)}" loading="lazy">
          ${img.alt ? `<figcaption>${escapeHtml(img.alt)}</figcaption>` : ''}
        </figure>`;
        imageIndex++;
      }
    });
  } else {
    // Sin imágenes para intercalar, renderizar contenido normal
    html += cleanContent;
  }

  html += '</div>';

  return html;
}

/**
 * Normaliza y aplica estilos a contenido Quill
 * Asegura que .ql-align-*, .ql-indent-*, etc. funcionen en el blog publicado
 */
export function applyQuillStyles(container) {
  if (!container) return;

  // Inyectar estilos Quill si no existen (para casos donde no se cargue quill.snow.css)
  if (!document.getElementById('quill-styles-injected')) {
    const style = document.createElement('style');
    style.id = 'quill-styles-injected';
    style.textContent = `
      /* Quill alignment classes */
      .ql-align-center { text-align: center; }
      .ql-align-right { text-align: right; }
      .ql-align-justify { text-align: justify; }

      /* Quill indent classes */
      .ql-indent-1 { padding-left: 3em; }
      .ql-indent-2 { padding-left: 6em; }
      .ql-indent-3 { padding-left: 9em; }
      .ql-indent-4 { padding-left: 12em; }
      .ql-indent-5 { padding-left: 15em; }
      .ql-indent-6 { padding-left: 18em; }
      .ql-indent-7 { padding-left: 21em; }
      .ql-indent-8 { padding-left: 24em; }
      .ql-indent-9 { padding-left: 27em; }

      /* Quill direction classes */
      .ql-direction-rtl { direction: rtl; }

      /* Quill code block */
      .ql-syntax { background: var(--text-dark); color: var(--cream); padding: 16px; border-radius: 8px; overflow-x: auto; }
      .ql-editor .hljs { background: none; color: inherit; }

      /* Quill video */
      .ql-video { display: block; max-width: 100%; }

      /* Quill formula */
      .ql-formula { display: inline-block; }
    `;
    document.head.appendChild(style);
  }

  // Normalizar clases en el contenedor
  const editorContent = container.querySelector('.article-content, .gallery-content');
  if (editorContent) {
    // Asegurar que párrafos vacíos no colapsen
    editorContent.querySelectorAll('p').forEach(p => {
      if (!p.textContent.trim() && !p.querySelector('img, iframe, video')) {
        p.style.minHeight = '1.5em';
      }
    });

    // Mejorar imágenes sueltas en contenido (no portada, no galería)
    editorContent.querySelectorAll('img:not([class*="gallery"]):not(.article-cover img):not(.article-featured-cover img)').forEach(img => {
      if (!img.closest('figure')) {
        img.style.borderRadius = '12px';
        img.style.margin = '24px auto';
        img.style.maxWidth = '100%';
        img.style.boxShadow = '0 8px 24px rgba(111, 193, 255, 0.15)';
        img.style.display = 'block';
      }
    });

    // Video responsive
    editorContent.querySelectorAll('iframe, video').forEach(el => {
      if (!el.closest('.ql-video')) {
        el.style.maxWidth = '100%';
        el.style.borderRadius = '12px';
        el.style.margin = '24px auto';
        el.style.display = 'block';
      }
    });
  }
}

// ============================================
// ESTILOS CSS INYECTADOS PARA GALERÍA (responsive)
// ============================================

function injectGalleryStyles() {
  if (document.getElementById('gallery-grid-styles')) return;

  const style = document.createElement('style');
  style.id = 'gallery-grid-styles';
  style.textContent = `
    /* Gallery grid responsive styles - compatible con blog-post.html */
    @media (min-width: 768px) {
      .gallery-content .gallery-inline-image {
        display: inline-block;
        width: calc(50% - 16px);
        margin: 16px 8px;
        vertical-align: top;
      }
      .gallery-content .gallery-main-cover {
        margin-bottom: 32px;
      }
      .gallery-content .gallery-inline-image img {
        width: 100%;
        height: auto;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(111, 193, 255, 0.15);
      }
      .gallery-content .gallery-inline-image figcaption {
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--text-dark);
        opacity: 0.7;
        font-style: italic;
        text-align: center;
      }
    }
    @media (max-width: 767px) {
      .gallery-content .gallery-inline-image {
        display: block;
        width: 100%;
        margin: 24px auto;
      }
      .gallery-content .gallery-inline-image img {
        width: 100%;
        height: auto;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(111, 193, 255, 0.15);
      }
      .gallery-content .gallery-inline-image figcaption {
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--text-dark);
        opacity: 0.7;
        font-style: italic;
        text-align: center;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Configura estilos adicionales para imágenes de galería (legacy, mantener injectGalleryStyles)
 */
function setupGalleryImages(container) {
  injectGalleryStyles();
  const galleryImages = container.querySelectorAll('.gallery-inline-image');
  galleryImages.forEach(fig => {
    fig.style.margin = '32px auto';
    fig.style.maxWidth = '100%';
    fig.style.textAlign = 'center';

    const img = fig.querySelector('img');
    if (img) {
      img.style.borderRadius = '12px';
      img.style.boxShadow = '0 8px 24px rgba(111, 193, 255, 0.15)';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
    }

    const caption = fig.querySelector('figcaption');
    if (caption) {
      caption.style.marginTop = '8px';
      caption.style.fontSize = '0.85rem';
      caption.style.color = 'var(--text-dark)';
      caption.style.opacity = '0.7';
      caption.style.fontStyle = 'italic';
    }
  });
}

// ============================================
// FUNCIÓN PRINCIPAL: renderArticle
// ============================================

/**
 * Renderiza un artículo completo en el contenedor dado
 *
 * @param {Object} data - Datos del artículo desde Firestore
 * @param {HTMLElement} container - Elemento contenedor donde renderizar
 * @param {Object} options - Opciones de renderizado
 * @param {string} options.mode - 'preview' | 'full' (afecta CTA, related posts, etc.)
 * @param {boolean} options.showCTA - Mostrar sección CTA (default: true en full, false en preview)
 * @param {boolean} options.showRelated - Mostrar posts relacionados (default: true en full, false en preview)
 * @param {Function} options.onRelatedPostsLoaded - Callback cuando se cargan related posts (solo full)
 */
export function renderArticle(data, container, options = {}) {
  const {
    mode = 'full',
    showCTA = mode === 'full',
    showRelated = mode === 'full',
    onRelatedPostsLoaded = null
  } = options;

  if (!container) {
    console.error('blog-renderer: container no proporcionado');
    return;
  }

  if (!data) {
    console.error('blog-renderer: data no proporcionado');
    container.innerHTML = '<div class="not-found">Artículo no encontrado</div>';
    return;
  }

  const template = getTemplate(data);
  const coverUrl = getCoverUrl(data);

  // Construir HTML según plantilla
  let html = '';

  // Hero/Header según plantilla
  switch (template) {
    case 'imagen-destacada':
      html += buildHero(data, options);
      break;

    case 'galeria':
      html += buildGalleryLayout(data, options);
      break;

    case 'estandar':
    default:
      html += buildStandardHeader(data, options);
      break;
  }

  // Contenido principal
  if (template === 'galeria') {
    // buildGalleryLayout ya incluye el contenido
  } else {
    html += `<div class="article-content">${data.contenidoHtml || ''}</div>`;
  }

  // Tags
  if (data.categoria) {
    html += `
      <div class="article-tags">
        <span class="tag">${escapeHtml(categoryLabels[data.categoria] || data.categoria)}</span>
      </div>
    `;
  }

  // CTA Section (solo en vista completa)
  if (showCTA) {
    html += `
      <section class="article-cta" aria-labelledby="ctaTitle">
        <h3 id="ctaTitle">¿Te resonó este artículo?</h3>
        <p>La terapia te da herramientas para aplicar esto en tu vida. Agenda tu primera sesión.</p>
        <div class="article-cta-actions">
          <a href="https://wa.me/51939855573" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M20.52 3.48A11.914 11.914 0 0 0 12 0C5.373 0 0 5.373 0 12c0 1.783.44 3.482 1.227 5.006L0 24l5.894-1.664A11.942 11.942 0 0 0 12 24c6.627 0 12-5.373 12-12 0-1.958-.487-3.813-1.48-5.442zM8 12.5c0 .827.673 1.5 1.5 1.5H10v4.5c0 .827.673 1.5 1.5 1.5s1.5-.673 1.5-1.5V14h2.5c.827 0 1.5-.673 1.5-1.5s-.673-1.5-1.5-1.5H13V9c0-.827-.673-1.5-1.5-1.5s-1.5.673-1.5 1.5v2.5H9.5c-.827 0-1.5.673-1.5 1.5z"/></svg>
            Escribir por WhatsApp
          </a>
          <a href="blog.html" class="btn btn-secondary">Ver otros artículos</a>
        </div>
      </section>
    `;
  }

  // Related Posts placeholder (solo en vista completa, se llena dinámicamente)
  if (showRelated) {
    html += `
      <section class="related-section" id="relatedSection" style="display: none;" aria-labelledby="relatedTitle">
        <h2 class="related-title" id="relatedTitle">Más artículos</h2>
        <div class="related-grid" id="relatedGrid"></div>
      </section>
    `;
  }

  // Inyectar HTML
  container.innerHTML = html;

  // Aplicar estilos Quill (alineaciones, indent, etc.)
  applyQuillStyles(container);

  // Configurar gallery inline images si es plantilla galería
  if (template === 'galeria') {
    setupGalleryImages(container);
  }

  // Retornar elementos clave para manipulación posterior (related posts, etc.)
  return {
    relatedSection: container.querySelector('#relatedSection'),
    relatedGrid: container.querySelector('#relatedGrid'),
    articleContent: container.querySelector('.article-content, .gallery-content')
  };
}

// ============================================
// FUNCIÓN PARA CARGAR POSTS RELACIONADOS (solo blog-post.html)
// ============================================

/**
 * Carga posts relacionados de la misma categoría
 * Se usa solo en blog-post.html (mode: 'full')
 *
 * @param {Object} db - Instancia de Firestore
 * @param {string} category - Categoría del post actual
 * @param {string} excludeId - ID del post actual (excluir)
 * @param {HTMLElement} relatedGrid - Contenedor grid
 * @param {HTMLElement} relatedSection - Sección contenedora
 * @param {number} limit - Límite de posts (default: 3)
 */
export async function loadRelatedPosts(db, category, excludeId, relatedGrid, relatedSection, limit = 3) {
  if (!category || !relatedGrid || !relatedSection) return;

  try {
    const { query, collection, where, orderBy, limit: limitFn, getDocs } = await import(
      'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js'
    );

    const q = query(
      collection(db, 'blogPosts'),
      where('categoria', '==', category),
      where('publicado', '==', true),
      orderBy('fecha', 'desc'),
      limitFn(limit + 1) // +1 para filtrar el actual
    );

    const snapshot = await getDocs(q);
    const posts = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.id !== excludeId)
      .slice(0, limit);

    if (posts.length === 0) return;

    relatedGrid.innerHTML = posts.map(post => {
      const cover = post.imagenPortadaUrl;
      const fecha = post.fecha?.toDate ? formatDate(post.fecha.toDate()) : formatDate(post.fecha);
      return `
        <article class="related-card">
          ${cover ? `<img src="${cover}" alt="${escapeHtml(post.titulo)}" class="related-cover" loading="lazy">` : `<div class="related-cover" style="background: linear-gradient(135deg, var(--celeste-light), var(--celeste-mid));"></div>`}
          <div class="related-content">
            <a href="blog-post.html?id=${post.id}" class="related-title-link">${escapeHtml(post.titulo)}</a>
            <div class="related-meta">${fecha}</div>
          </div>
        </article>
      `;
    }).join('');

    relatedSection.style.display = 'block';
  } catch (error) {
    console.error('Error loading related posts:', error);
  }
}

// ============================================
// EXPORT DEFAULT PARA COMPATIBILIDAD
// ============================================

export default {
  renderArticle,
  loadRelatedPosts,
  buildStandardHeader,
  buildHero,
  buildGalleryLayout,
  applyQuillStyles,
  escapeHtml,
  stripHtml,
  formatDate,
  getExcerpt,
  categoryLabels,
  templateNames
};