# Fix for Astro Landing Page Issues

## Problems Identified

1. **THREE is not defined** - Three.js library is not loaded before being used
2. **Tailwind CSS CORS error** - Incorrect CDN URL or loading method
3. **Missing favicon.ico** - 404 error for favicon

## Solutions

### 1. Fix Three.js Loading

In your `index.astro` file, make sure Three.js is loaded BEFORE any script that uses it:

```astro
---
// index.astro
---
<html>
<head>
    <!-- Load Three.js FIRST -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    
    <!-- Your other head content -->
</head>
<body>
    <!-- Your content -->
    
    <script>
        // Move initThreeJS to run after DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            initThreeJS();
        });
        
        function initThreeJS() {
            // Line 371 - THREE will now be defined
            const scene = new THREE.Scene();
            // ... rest of your Three.js code
        }
    </script>
</body>
</html>
```

### 2. Fix Tailwind CSS Loading

Remove the trailing slash from the Tailwind CDN URL:

```html
<!-- WRONG - has trailing slash -->
<script src="https://cdn.tailwindcss.com/"></script>

<!-- CORRECT - no trailing slash -->
<script src="https://cdn.tailwindcss.com"></script>
```

### 3. Better Solution - Install Dependencies Properly

For a production Astro site, install these as proper dependencies:

```bash
# Navigate to your Astro project directory
cd apps/finagent-landing  # or wherever your Astro project is

# Install Tailwind CSS
npm install -D tailwindcss @astrojs/tailwind
npx astro add tailwind

# Install Three.js
npm install three @types/three

# Create tailwind.config.js if it doesn't exist
npx tailwindcss init
```

Then in your Astro config (`astro.config.mjs`):

```js
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()]
});
```

### 4. Use Three.js as an ES Module

In your Astro component:

```astro
---
// index.astro
---
<html>
<head>
    <meta charset="UTF-8">
    <title>Your Site</title>
</head>
<body>
    <!-- Your content -->
    
    <script type="module">
        import * as THREE from 'https://unpkg.com/three@0.150.0/build/three.module.js';
        
        function initThreeJS() {
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(
                75, 
                window.innerWidth / window.innerHeight, 
                0.1, 
                1000
            );
            const renderer = new THREE.WebGLRenderer();
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);
            
            // Add your Three.js scene setup here
            
            function animate() {
                requestAnimationFrame(animate);
                renderer.render(scene, camera);
            }
            animate();
        }
        
        // Initialize when DOM is ready
        initThreeJS();
    </script>
</body>
</html>
```

### 5. Add Missing Favicon

Create a `public/favicon.ico` file in your Astro project root, or add this to your HTML head:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

## Quick Fix Script

Run this in your Astro project directory:

```bash
#!/bin/bash

# Install dependencies
npm install -D tailwindcss @astrojs/tailwind
npm install three

# Add Tailwind integration
npx astro add tailwind

# Create a simple favicon if it doesn't exist
if [ ! -f "public/favicon.ico" ]; then
    mkdir -p public
    # Create a simple SVG favicon
    echo '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#4F46E5"/></svg>' > public/favicon.svg
fi

echo "✅ Dependencies installed and configured!"
```

## Testing

After applying these fixes:

1. Restart your Astro dev server
2. Check the browser console - errors should be gone
3. Verify Tailwind styles are applied
4. Verify Three.js scene renders properly