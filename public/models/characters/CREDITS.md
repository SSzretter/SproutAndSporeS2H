# Character model credits

All files in this folder are built from **Quaternius** assets, released under
**CC0 1.0 Universal** (public domain; no attribution required, credit given as a courtesy).
License: https://creativecommons.org/publicdomain/zero/1.0/ · https://quaternius.com

| File | Source pack (Standard / free edition) | Changes |
|---|---|---|
| `quaternius_male.glb` | Universal Base Characters: `Superhero_Male_FullBody`, hairstyles `Hair_SimpleParted`, `Hair_Buzzed`, `Hair_Beard` (rigged to Head bone) | Merged onto one skeleton; extra UV/colour attributes, normal and roughness maps removed; base colour textures resized (skin 1024 JPEG, hair 512 greyscale JPEG, brows 256 greyscale JPEG) |
| `quaternius_female.glb` | Universal Base Characters: `Superhero_Female_FullBody`, hairstyles `Hair_Long`, `Hair_Buns`, `Hair_BuzzedFemale` | Same as above |
| `quaternius_anims.glb` | Universal Animation Library and Universal Animation Library 2 (`UAL1_Standard.glb`, `UAL2_Standard.glb`) | 17 clips kept; mannequin mesh removed; only bone rotations and pelvis translation kept; unchanging tracks reduced to one key |

Packs: https://quaternius.itch.io/universal-base-characters ·
https://quaternius.itch.io/universal-animation-library ·
https://quaternius.itch.io/universal-animation-library-2

Rebuild with `node scripts/build-characters.mjs` after unpacking the three `[Standard]` zips into
`assets-src/quaternius/x/` (`ubc/`, `ual1/`, `ual2/`). That folder is git-ignored. Clothing, hats and held tools
are drawn by the project's own code; no third-party clothing assets are used.
