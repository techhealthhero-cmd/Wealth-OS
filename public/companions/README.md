# Companion avatars

Image library for the planned AI companion system (spirits + wizards).
All avatars here are wired up via src/lib/companions/catalog.ts (the
companion system); e.g. the Shadow Spirit uses `spirits/hooded-mist.png`.

- `spirits/` — ภูติ: companions earned through financial progress.
- `wizards/` — จอมเวท: specialist companions.

Conventions: round avatar, transparent outside the circle, 256×256 PNG,
lowercase kebab-case filename describing the look (e.g. `leaf.png`).
Upload new art under a NEW filename instead of overwriting one already in
use, so phones don't keep showing the cached old image.
