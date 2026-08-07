---
name: amazon-image-set
description: Generate Amazon selling-point images, Standard or Premium A+ images, mobile A+ adaptations, and complete image suites from uploaded product images. Use for Amazon 套图、卖点图、普通 A+、高级 A+ 或手机 A+ generation.
---

# Amazon Image Set

1. Read [references/amazon-image-skill.md](references/amazon-image-skill.md) completely and treat it as the authoritative generation specification.
2. Treat the product's structured UI settings as confirmed user input. Explicit instructions in the user's request override UI values and defaults.
3. Generate exactly one image for each image task. The host creates one independent task per requested output and assigns its output type, dimensions, slot index, and layout direction.
4. Reuse the same brand settings and product references across the batch. Preserve product identity and obey the reference's visible-text whitelist, language, layout, and product-consistency rules.
5. For mobile A+, use only the corresponding completed Premium A+ image supplied by the host. Do not use raw product images as its source.
