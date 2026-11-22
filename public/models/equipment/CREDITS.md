# Equipment and building model credits

All files in this folder are built from **Poly Haven** models, released under **CC0 1.0 Universal**
(public domain; no attribution required, credit given as a courtesy). License: https://polyhaven.com/license

| File | Poly Haven asset | Author | Changes |
|---|---|---|---|
| `reservoir_tote.glb` | [plastic_container](https://polyhaven.com/a/plastic_container) | PierreB3D | Textures 512 px JPEG |
| `inline_fan.glb` | [modular_airduct_circular_01](https://polyhaven.com/a/modular_airduct_circular_01) | Riley Queen | Only the `fan`, `single` and `smooth_single` pieces kept, each moved to the origin; textures 512 px |
| `light_fluorescent.glb` | [mounted_fluorescent_lights](https://polyhaven.com/a/mounted_fluorescent_lights) | Ulan Cabanilla | Only strip variant `d` kept; textures 512 px |
| `light_pendant.glb` | [hanging_industrial_lamp](https://polyhaven.com/a/hanging_industrial_lamp) | Kuutti Siitonen | Glass transmission replaced with plain transparency; emissive-strength extension removed; textures 512 px |
| `caged_light.glb` | [caged_hanging_light](https://polyhaven.com/a/caged_hanging_light) | Ulan Cabanilla | Textures 512 px |
| `breaker_panel.glb` | [power_box_01](https://polyhaven.com/a/power_box_01) | Rico Cilliers, Yann Kervran | Textures 512 px |
| `rollershutter_door.glb` | [rollershutter_door](https://polyhaven.com/a/rollershutter_door) | MP | Plain shutter only (graffiti variant dropped); specular/IOR extensions removed; textures 512 px |

In every file the ARM texture (AO, roughness, metalness) is used for both occlusion and metal/roughness, and
attributes other than position, normal and the first UV set are dropped. Geometry is unchanged.

Rebuild with `npm run build:equipment` after downloading each asset's **1K glTF** into
`assets-src/polyhaven/<asset>/` (git-ignored), keeping Poly Haven's folder layout (`<asset>_1k.gltf`, `.bin`,
`textures/`). The script is Windows-only: it resizes textures with PowerShell.
