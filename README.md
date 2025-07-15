# WooCommerce Dynamic Pricing AJAX

Un plugin moderno para WooCommerce que muestra dinámicamente los precios con descuento en tiempo real cuando el usuario cambia la cantidad del producto, sin necesidad de recargar la página.

![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)
![WordPress](https://img.shields.io/badge/WordPress-5.0+-green.svg)
![WooCommerce](https://img.shields.io/badge/WooCommerce-5.0+-purple.svg)
![License](https://img.shields.io/badge/license-GPL--2.0+-red.svg)

[🛠️ Descargar el plugin completo y configuración del plugin
](https://www.woland.es/plugin-woocommerce-de-precios-dinamicos-con-ajax-gratis-instalacion-profesional/)

<img width="691" height="429" alt="screenshot-2" src="https://github.com/user-attachments/assets/ab75c53a-2555-49e0-a1f4-e81816e6ffe7" />


## ✨ Características

- **Precios dinámicos en tiempo real**: Actualización automática de precios al cambiar la cantidad
- **Interfaz moderna y elegante**: Widget con diseño profesional y responsive
- **Sistema de progreso visual**: Barra de progreso hacia el siguiente descuento
- **Optimizado para rendimiento**: Sistema de caché con TTL y debouncing
- **Compatible con temas populares**: Diseñado para trabajar con Impreza y otros temas
- **Accesibilidad mejorada**: Soporte para lectores de pantalla y navegación por teclado
- **Responsive**: Adaptado para móviles, tablets y escritorio
- **Sin dependencias externas**: Solo requiere WooCommerce y WooCommerce Dynamic Pricing

## 📋 Requisitos

- WordPress 5.0 o superior
- WooCommerce 5.0 o superior
- **WooCommerce Dynamic Pricing** (plugin requerido)
- PHP 7.4 o superior


## 🎯 Uso

Una vez activado el plugin:

1. **Configura tus reglas de pricing dinámico** en WooCommerce Dynamic Pricing
2. El plugin **se activará automáticamente** en las páginas de producto que tengan reglas de pricing configuradas
3. Los usuarios verán el **widget de precios dinámico** debajo del precio original
4. Al cambiar la cantidad, los precios se actualizarán **automáticamente via AJAX**

### Widget de precios incluye:

- **Precio original** (tachado cuando hay descuento)
- **Precio con descuento** (cuando aplica)
- **Total de la compra**
- **Porcentaje y cantidad de ahorro**
- **Barra de progreso** hacia el siguiente descuento
- **Badge de cantidad** con animaciones

## ⚙️ Configuración

El plugin funciona sin configuración adicional, pero puedes personalizar algunos aspectos:

### Filtros disponibles

```php
// Cambiar el delay del debounce (por defecto 300ms)
add_filter('wc_dynamic_pricing_debounce_delay', function($delay) {
    return 500; // 500ms
});

// Habilitar/deshabilitar caché
add_filter('wc_dynamic_pricing_enable_cache', function($enabled) {
    return false; // Deshabilitar caché
});
```

### Variables CSS personalizables

```css
:root {
    --wc-dp-primary-color: #6aac46;
    --wc-dp-secondary-color: #5a9a36;
    --wc-dp-accent-color: #4a8a26;
    --wc-dp-background: rgba(255, 255, 255, 0.95);
    --wc-dp-border-radius: 0.3rem;
    --wc-dp-transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}
```

## 🏗️ Estructura de archivos

```
woocommerce-dynamic-pricing-ajax/
├── woocommerce-dynamic-pricing-ajax.php  # Archivo principal del plugin
├── assets/
│   ├── css/
│   │   └── dynamic-pricing-ajax.css      # Estilos del widget
│   └── js/
│       └── dynamic-pricing-ajax.js       # Lógica AJAX y animaciones
└── README.md
```

## 🔧 Características técnicas

### Optimizaciones de rendimiento

- **Sistema de caché** con TTL de 5 minutos
- **Debouncing** para evitar requests excesivos
- **Cancelación automática** de requests anteriores
- **Lazy loading** solo en páginas de producto
- **Caché interno** para metadatos de productos

### Compatibilidad

- ✅ **Productos simples**
- ✅ **Productos variables** (con detección de cambios de variación)
- ✅ **Modo RTL** (Right-to-Left)
- ✅ **Alto contraste**
- ✅ **Reduced motion**
- ✅ **Responsive design**

### Accesibilidad

- Soporte para lectores de pantalla
- Navegación por teclado
- Contraste adecuado
- Textos alternativos
- Estados de focus visibles

## 🎨 Personalización

### Personalizar estilos

El plugin usa variables CSS que puedes sobrescribir en el CSS de tu tema:

```css
/* Cambiar colores principales */
:root {
    --wc-dp-primary-color: #tu-color-primario;
    --wc-dp-secondary-color: #tu-color-secundario;
}

/* Ocultar elementos específicos */
.wc-dynamic-pricing-progress-section {
    display: none;
}

/* Personalizar el widget para tu tema */
.mi-tema .wc-dynamic-pricing-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Personalizar textos

```php
// Cambiar textos del widget
add_filter('wc_dynamic_pricing_texts', function($texts) {
    $texts['unit_price'] = 'Precio por unidad';
    $texts['discounted_price'] = 'Precio con descuento';
    $texts['total_purchase'] = 'Total de la compra';
    return $texts;
});
```

## 🐛 Debug y desarrollo

### Modo debug

Para habilitar el modo debug, agrega este elemento al HTML de tu página de producto:

```html
<div id="wc-dynamic-pricing-debug"></div>
```

### Funciones de debug disponibles

```javascript
// En la consola del navegador
wcDynamicPricingDebug.getCache();      // Ver caché actual
wcDynamicPricingDebug.clearCache();    // Limpiar caché
wcDynamicPricingDebug.getCacheStats(); // Estadísticas de caché
```

## 🔍 Troubleshooting

### El widget no aparece

1. Verificar que WooCommerce Dynamic Pricing esté activo
2. Confirmar que el producto tiene reglas de pricing configuradas
3. Revisar la consola del navegador por errores JavaScript

### Los precios no se actualizan

1. Verificar que las reglas de pricing estén configuradas correctamente
2. Limpiar caché del plugin y del sitio
3. Revisar que no haya conflictos con otros plugins

### Problemas de rendimiento

1. Verificar que el caché esté habilitado
2. Ajustar el delay de debounce
3. Revisar el log de errores por problemas de base de datos

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Para contribuir:

1. Fork este repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

### Estándares de código

- Seguir los estándares de WordPress Coding Standards
- Documentar todas las funciones
- Incluir tests cuando sea posible
- Mantener compatibilidad con versiones anteriores

## 📝 Changelog

### v1.1.0 (Actual)
- ✨ Nuevo diseño modernizado del widget
- ⚡ Sistema de caché optimizado con TTL
- 🎯 Debouncing inteligente para mejor rendimiento
- 📱 Diseño responsive mejorado
- ♿ Accesibilidad mejorada
- 🎨 Soporte para temas personalizados
- 🐛 Corrección de bugs menores

### v1.0.0
- 🚀 Lanzamiento inicial
- 💰 Visualización básica de precios dinámicos
- 🔄 Funcionalidad AJAX base

## 📄 Licencia

Este plugin está licenciado bajo GPL v2 o posterior.

## 🙋‍♂️ Soporte

- **Issues**: [GitHub Issues](https://github.com/jorgerey89/woocommerce-dynamic-pricing-ajax/issues)
- **Documentación**: [Wiki del proyecto](https://github.com/jorgerey89/woocommerce-dynamic-pricing-ajax/wiki)
- **Contacto**: [soporte@woland.es](mailto:soporte@woland.es)

## 🌟 ¿Te gusta el plugin?

Si este plugin te ha sido útil, considera:

- ⭐ Darle una estrella en GitHub
- 🐛 Reportar bugs que encuentres
- 🚀 Sugerir nuevas características
- 📢 Compartirlo con otros desarrolladores

---

**Desarrollado con ❤️ para la comunidad de WordPress**
