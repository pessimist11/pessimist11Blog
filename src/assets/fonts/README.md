# Signature font

Caveat by The Caveat Project Authors, licensed under SIL Open Font License 1.1.

Source: https://github.com/google/fonts/tree/main/ofl/caveat

`caveat-signature.woff2` is a variable-weight subset for the homepage wordmark
“Pessimist” (including `1` for the site name). The license is in `Caveat-OFL.txt`.

The wordmark font is bundled through the homepage styles. Body fonts (Noto Serif SC and EB Garamond) are maintained separately by `scripts/build-fonts.mjs`, which generates ignored `public/fonts/` files from installed Fontsource packages. Re-run development or production builds after adding text so the body-font subsets include new characters.
