# Moon textures

Credit: NASA's Scientific Visualization Studio.

Source: [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/).

- `lroc-albedo.webp`: 2025 LROC color map, converted from `lroc_color_2k.jpg` (2048 × 1024) to grayscale WebP. Used on mobile and by the navigation moon.
- `lroc-albedo-4k.webp`: grayscale WebP from the 2025 `lroc_color_16bit_srgb_4k.tif` (4096 × 2048). Used by the desktop homepage moon.
- `lola-height.jpg`: original LOLA elevation preview `ldem_3_8bit.jpg` (1024 × 512), used by the navigation moon.
- `lola-normal-4k.webp` / `lola-normal-2k.webp`: OpenGL tangent-space normal maps derived from `ldem_16_uint.tif` (5760 × 2880). Central differences use the lunar radius of 1737.4 km, latitude-corrected east/west spacing, and the source's half-meter elevation units. Relief is amplified 1.8× for display, then resized and encoded as WebP. Normal maps use linear color; albedo maps use sRGB.

These maps are used for display, not scientific measurement.
