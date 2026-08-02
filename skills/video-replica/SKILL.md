---
name: video-replica
description: Analyze an uploaded ecommerce reference video into an image-to-video storyboard, replace the source product with the user's product, and generate a faithful short-video replica. Use for 视频复刻, reference-video recreation, shot-by-shot replication, or product replacement in an existing short-video structure.
---

# Video Replica

1. Require one reference video and at least one product image.
2. Analyze the reference video with [references/video-analysis-prompt.md](references/video-analysis-prompt.md). Treat that file as immutable source instructions and preserve it verbatim.
3. Use the analysis only as an internal storyboard. Do not expose it as the final deliverable.
4. Replace the reference product with the uploaded product while preserving the reference video's shot order, viewpoint, camera motion, action rhythm, speaking state, and permitted on-screen captions.
5. Treat the first product image as the identity source and remaining images as supplementary views. Never copy source brands, watermarks, platform UI, usernames, or unsupported claims.
6. Pass the adapted storyboard to the video-generation model and return the generated video task.
