# Logo Optimizado para PSH

## Instrucciones para el diseñador

Exportar el logo original `logo-psh.png` en dos versiones:

1. `logo-psh-celeste.png` - con color celeste #6FC1FF (el original debe tener fondo transparente)
2. `logo-psh-ink.png` - con color ink #1A2E35 (fondo transparente)

**Dimensiones:** 96px × 96px (1x) y 192px × 192px (2x)

**Formato:** PNG con transparencia

**Requisitos:**
- Sin bordes ni fondos
- Forma circular con el logo centrado
- Sin ningún efecto de sombra o glifo adicional

## Cambios a implementar en el código

Reemplazar el HTML actual:

```html
<div class="nav-logo-img-wrap">
  <img src="logo-psh.png" alt="Logo PSH" class="nav-logo-img">
</div>
```

por:

```html
<div class="nav-logo-img-wrap">
  <img src="assets/logos/logo-psh-celeste.png" alt="Logo PSH" class="nav-logo-img">
</div>
```

Y el CSS actual:

```css
.nav-logo-img {
  display: block;
  width: 348.16px;
  height: 348.16px;
  transform: translate(-76px, -80px);
  clip-path: circle(150px at center);
  object-fit: cover;
  transition: filter 0.3s ease;
}

.nav-logo-img-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
}
```

por:

```css
.nav-logo-img-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
}

.nav-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 0.3s ease;
}

.nav-logo-img-wrap:hover .nav-logo-img {
  opacity: 0.9;
}
```

## Nota sobre el footer

Reemplazar igualmente en el footer:

```html
<div class="footer-logo-img-wrap">
  <img src="logo-psh.png" alt="Logo PSH" class="footer-logo-img">
</div>
```

por:

```html
<div class="footer-logo-img-wrap">
  <img src="assets/logos/logo-psh-celeste.png" alt="Logo PSH" class="footer-logo-img">
</div>
```

Y el CSS:

```css
.footer-logo-img-wrap {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
}

.footer-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Una vez tengas las imágenes optimizadas, reemplaza las referencias y elimina los filtros CSS y transformaciones hacky.