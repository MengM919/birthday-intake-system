# Birthday Renderer 2.0 Test Checklist

## Automated local regression completed

A mocked published order was rendered through the real browser code path with Chromium DevTools Protocol.

| Viewport / template | Result |
| --- | --- |
| 375 x 812 / `line_bloom_white` | Root reached `ready`; story remained hidden before CTA; no horizontal overflow (`375 / 375`). |
| 360 x 800 / `collage_pop_redblue` | CTA opened the story; gallery and wall mounted; no horizontal overflow (`360 / 360`). |
| 1440 x 900 / `pink_dark_gothic` | CTA opened the story; gallery and wall mounted; no horizontal overflow (`1425 / 1440`). |

Static checks passed with:

```powershell
node --check js/birthday-page.js
node --check js/birthday-gallery.js
node --check js/birthday-music.js
node --check js/birthday-share.js
node --check js/public-wall.js
node --check js/surprise-renderer.js
node --check config/birthday-template-registry.js
```

## Real published-page read regression

The new renderer was also opened locally against the production Supabase public read path. No order text, person data or photo URL was logged.

| Slug | Result |
| --- | --- |
| `4f453172f1cd47728479` | `ready`; screenshot mode opened the story; renderer shell, gallery, blessing wall and share zone mounted. |
| `adc842d98cad4932a9a4` | `ready`; screenshot mode opened the story; renderer shell, gallery, blessing wall and share zone mounted. |

Screenshot mode was verified with the first slug: `?screenshot=1` opened the story and hid the hero CTA, gallery controls and share controls.
## Visual evidence handling

The 375 x 812, 360 x 800 and 1440 x 900 checks were visually reviewed in a local browser. The screenshot artifacts are intentionally not committed because they may include real test cover or gallery photos. The three layouts remained visibly distinct in grayscale review through their hero composition, gallery structure and section boundaries, not color alone.
## Manual production check after deployment

Use a newly published T01, T02 and T06 order. Check each item on mobile and desktop:

- First screen has only the cover, title, sender, countdown and one opening CTA.
- Music does not play before the CTA and can be paused afterward.
- Gallery supports swipe, progress, fullscreen, arrow keys and Escape.
- Blessing wall can open, validate, submit and retry without showing raw HTML.
- Wish bottle clearly says it is device-local if it is not connected to server persistence.
- Future mailbox shows its lock/open state.
- Surprise box does not repeat immediately; Escape, close button and browser Back close it.
- `?screenshot=1` hides interactive controls and expands story content.
- `prefers-reduced-motion: reduce` keeps text visible while reducing motion.
- Invalid, unpublished and offline slugs show a recoverable state rather than a blank page.

## Known release boundary

Real browser performance and WeChat in-app share-card crawling must be checked after deployment. The local review validates layout and lifecycle but does not replace a real-device network test with the production Supabase project.