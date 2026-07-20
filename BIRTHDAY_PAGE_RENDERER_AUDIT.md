# Birthday Page Renderer 2.0 Audit

Audit date: 2026-07-20
Status: completed for the public birthday-page renderer. The customer intake, merchant console, Supabase data and private Storage paths are intentionally outside this refactor.

## One rendering chain

```text
birthday.html
  -> bootstrapBirthdayPage()
  -> parseSlugAndEnvironment()
  -> loadBirthdayPage()
  -> fetchPublishedPage()
  -> normalizeBirthdayPageData()
  -> resolveTemplateSnapshot()
  -> renderBirthdayPageShell()
  -> mountFeatureModules()
  -> reportReadyOrError()
  -> user taps the opening CTA
```

- `birthday.html` loads configuration before the one renderer entry point.
- `js/birthday-page.js` owns the single bootstrap, one Edge Function call, the normalized page model, the template resolver and all root-DOM rendering.
- A request token prevents an older request from replacing newer output. A 14-second timeout becomes a recoverable network state.
- `cleanupMountedFeatures()` removes listeners, timers, mounted modules, audio and active overlays before a retry or a new mount.
- `generated_pages.config_snapshot` remains the primary data source. Existing snapshots are never re-written by the frontend.

## States

The root supports `loading`, `ready`, `empty`, `not-found`, `unpublished`, `network-error` and `render-error`. A failed page has a retry button instead of a blank screen.

## Template architecture

- Business layer: normalized recipient, sender, content, photo and module data.
- Composition layer: `config/birthday-template-registry.js` resolves hero, gallery, divider, footer and module variants.
- Visual layer: palette, typography, decor and motion settings are exposed through the resolved template manifest and CSS variables.

The first renderer-2.0 templates are `line_bloom_white` (`T01`), `collage_pop_redblue` (`T02`) and `pink_dark_gothic` (`T06`). Their hero order, gallery treatment and story materials differ. The remaining templates safely use the shared renderer with their existing palette and configuration until they receive their own versioned composition.

## Asset readiness

This release adds no unlicensed network imagery. The cover and gallery always come from the order snapshot; the current line, tape, frame, light and paper treatments are CSS/DOM renderer materials rather than downloaded stock art.

The three 2.0 compositions are structurally ready, but the following optional commercial asset packs are still deliberately marked as future work rather than being presented as final illustrated assets:

- `line_bloom_white`: a licensed hand-drawn bloom and ribbon set.
- `collage_pop_redblue`: a licensed paper, tape and stamp material set.
- `pink_dark_gothic`: a licensed rose, veil and film-grain material set.

These additions belong in the template asset registry and versioned manifests, never in customer uploads or scattered remote URLs.
## Module lifecycle

- Gallery: `js/birthday-gallery.js`, mount/cleanup, touch swipe, progress, fullscreen, keyboard and pinch zoom.
- Music: `js/birthday-music.js`, user gesture only, visibility pause and cleanup.
- Blessing wall: `js/public-wall.js`, escaped input, request tokens, retry and cleanup.
- Wish bottle: renderer-owned dialog with explicit device-local persistence copy.
- Surprise box: `js/surprise-renderer.js`, active-scene cleanup, Escape, Android browser-back and reduced-motion handling.
- Share: `js/birthday-share.js`, Web Share, copy fallback and WeChat instruction.

## Compatibility and release rule

A new order receives the current template manifest when it is published by `publish-order`. An old published page continues to render from the version stored in its own snapshot. To intentionally give an old test order the new design, approve and publish it again; do not edit its snapshot directly.