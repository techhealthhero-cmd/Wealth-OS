# Wealth OS artwork library

This folder stores editable source files, references, and generated artwork
before they are approved for use in the app. Files here are not served by
Next.js.

## Folders

- `drafts/` — work in progress and generated candidates.
- `masters/` — approved, highest-quality editable/source files.
- `references/` — visual references that are safe to keep with the project.

When an image is ready for the product, export an optimized copy to
`public/artwork/` and use it from the app as `/artwork/<filename>`.

Use descriptive kebab-case names, for example:

```text
net-worth-empty-state-v1.webp
money-year-cover-dark.png
```

Prefer WebP for opaque raster artwork, PNG when transparency is required, and
SVG React components in `src/components/illustrations/` for themeable interface
illustrations. Do not store secrets, private financial data, or licensed
references without usage rights here.
