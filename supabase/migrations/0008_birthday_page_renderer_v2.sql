-- Birthday page renderer 2.0: immutable layout manifests for the first three mature templates.
-- Run after 0007. Existing generated_pages.config_snapshot rows are intentionally untouched.

with renderer_manifest(template_key, manifest) as (
  values
    (
      'line_bloom_white',
      jsonb_build_object(
        'templateId', 'line_bloom_white',
        'legacyId', 'T01',
        'version', '2.0.0',
        'layout', jsonb_build_object(
          'heroVariant', 'line-bloom',
          'contentFlow', 'memory-blessing-wish-surprise-share',
          'galleryVariant', 'line-grid',
          'sectionDivider', 'drawn-line',
          'footerVariant', 'garden-note'
        ),
        'visual', jsonb_build_object('texture', 'white-paper', 'iconSet', 'drawn-bloom', 'motionPreset', 'quick-gentle', 'decorDensity', 'light'),
        'copy', jsonb_build_object('openCta', U&'\62C6\5F00\7ED9\4F60\7684\751F\65E5\60CA\559C', 'storyLead', U&'\4ECA\5929\7684\82B1\3001\7EBF\6761\548C\5C0F\5C0F\5FC3\610F\FF0C\90FD\5728\4E3A\4F60\7559\51FA\4F4D\7F6E\3002'),
        'moduleVariants', jsonb_build_object('gallery', 'line-grid', 'messageWall', 'notes-on-paper', 'wishBottle', 'glass-bottle', 'futureMailbox', 'folded-letter', 'surpriseBox', 'garden-gift')
      )
    ),
    (
      'collage_pop_redblue',
      jsonb_build_object(
        'templateId', 'collage_pop_redblue',
        'legacyId', 'T02',
        'version', '2.0.0',
        'layout', jsonb_build_object(
          'heroVariant', 'collage-poster',
          'contentFlow', 'memory-blessing-wish-surprise-share',
          'galleryVariant', 'collage-wall',
          'sectionDivider', 'torn-paper',
          'footerVariant', 'ticket-signoff'
        ),
        'visual', jsonb_build_object('texture', 'grid-paper', 'iconSet', 'paper-cut', 'motionPreset', 'paper-slide', 'decorDensity', 'medium'),
        'copy', jsonb_build_object('openCta', U&'\62C6\5F00\4ECA\5929\7684\5927\60CA\559C', 'storyLead', U&'\628A\597D\5FC3\60C5\8D34\6EE1\8FD9\4E00\9875\FF0C\4ECA\5929\5C31\8981\4E3A\4F60\70ED\70ED\95F9\95F9\3002'),
        'moduleVariants', jsonb_build_object('gallery', 'collage-wall', 'messageWall', 'postcard-board', 'wishBottle', 'label-jar', 'futureMailbox', 'red-envelope', 'surpriseBox', 'poster-gift')
      )
    ),
    (
      'pink_dark_gothic',
      jsonb_build_object(
        'templateId', 'pink_dark_gothic',
        'legacyId', 'T06',
        'version', '2.0.0',
        'layout', jsonb_build_object(
          'heroVariant', 'cinematic-portrait',
          'contentFlow', 'memory-blessing-wish-surprise-share',
          'galleryVariant', 'film-strip',
          'sectionDivider', 'rose-fade',
          'footerVariant', 'sealed-letter'
        ),
        'visual', jsonb_build_object('texture', 'midnight-grain', 'iconSet', 'romantic-line', 'motionPreset', 'slow-cinematic', 'decorDensity', 'restrained'),
        'copy', jsonb_build_object('openCta', U&'\6253\5F00\4ECA\665A\53EA\5C5E\4E8E\4F60\7684\504F\7231', 'storyLead', U&'\628A\706F\5149\8C03\6697\4E00\70B9\FF0C\4ECA\665A\7684\6E29\67D4\90FD\5199\7ED9\4F60\3002'),
        'moduleVariants', jsonb_build_object('gallery', 'film-strip', 'messageWall', 'sealed-notes', 'wishBottle', 'night-bottle', 'futureMailbox', 'wax-letter', 'surpriseBox', 'night-gift-stage')
      )
    )
), target_templates as (
  select t.id, t.template_key, r.manifest
  from public.templates t
  join renderer_manifest r on r.template_key = t.template_key
)
update public.template_versions tv
set is_current = false,
    updated_at = now()
from target_templates target
where tv.template_id = target.id
  and tv.is_current = true;

with renderer_manifest(template_key, manifest) as (
  values
    ('line_bloom_white', jsonb_build_object('templateId', 'line_bloom_white', 'legacyId', 'T01', 'version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'line-bloom', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'line-grid', 'sectionDivider', 'drawn-line', 'footerVariant', 'garden-note'), 'visual', jsonb_build_object('texture', 'white-paper', 'iconSet', 'drawn-bloom', 'motionPreset', 'quick-gentle', 'decorDensity', 'light'), 'copy', jsonb_build_object('openCta', U&'\62C6\5F00\7ED9\4F60\7684\751F\65E5\60CA\559C', 'storyLead', U&'\4ECA\5929\7684\82B1\3001\7EBF\6761\548C\5C0F\5C0F\5FC3\610F\FF0C\90FD\5728\4E3A\4F60\7559\51FA\4F4D\7F6E\3002'), 'moduleVariants', jsonb_build_object('gallery', 'line-grid', 'messageWall', 'notes-on-paper', 'wishBottle', 'glass-bottle', 'futureMailbox', 'folded-letter', 'surpriseBox', 'garden-gift'))),
    ('collage_pop_redblue', jsonb_build_object('templateId', 'collage_pop_redblue', 'legacyId', 'T02', 'version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'collage-poster', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'collage-wall', 'sectionDivider', 'torn-paper', 'footerVariant', 'ticket-signoff'), 'visual', jsonb_build_object('texture', 'grid-paper', 'iconSet', 'paper-cut', 'motionPreset', 'paper-slide', 'decorDensity', 'medium'), 'copy', jsonb_build_object('openCta', U&'\62C6\5F00\4ECA\5929\7684\5927\60CA\559C', 'storyLead', U&'\628A\597D\5FC3\60C5\8D34\6EE1\8FD9\4E00\9875\FF0C\4ECA\5929\5C31\8981\4E3A\4F60\70ED\70ED\95F9\95F9\3002'), 'moduleVariants', jsonb_build_object('gallery', 'collage-wall', 'messageWall', 'postcard-board', 'wishBottle', 'label-jar', 'futureMailbox', 'red-envelope', 'surpriseBox', 'poster-gift'))),
    ('pink_dark_gothic', jsonb_build_object('templateId', 'pink_dark_gothic', 'legacyId', 'T06', 'version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'cinematic-portrait', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'film-strip', 'sectionDivider', 'rose-fade', 'footerVariant', 'sealed-letter'), 'visual', jsonb_build_object('texture', 'midnight-grain', 'iconSet', 'romantic-line', 'motionPreset', 'slow-cinematic', 'decorDensity', 'restrained'), 'copy', jsonb_build_object('openCta', U&'\6253\5F00\4ECA\665A\53EA\5C5E\4E8E\4F60\7684\504F\7231', 'storyLead', U&'\628A\706F\5149\8C03\6697\4E00\70B9\FF0C\4ECA\665A\7684\6E29\67D4\90FD\5199\7ED9\4F60\3002'), 'moduleVariants', jsonb_build_object('gallery', 'film-strip', 'messageWall', 'sealed-notes', 'wishBottle', 'night-bottle', 'futureMailbox', 'wax-letter', 'surpriseBox', 'night-gift-stage')))
), target_templates as (
  select t.id, r.manifest
  from public.templates t
  join renderer_manifest r on r.template_key = t.template_key
)
insert into public.template_versions (template_id, version, status, manifest, is_current)
select id, '2.0.0', 'active', manifest, true
from target_templates
on conflict (template_id, version) do update set
  status = excluded.status,
  manifest = excluded.manifest,
  is_current = excluded.is_current,
  updated_at = now();

with renderer_manifest(template_key, manifest) as (
  values
    ('line_bloom_white', jsonb_build_object('version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'line-bloom', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'line-grid', 'sectionDivider', 'drawn-line', 'footerVariant', 'garden-note'), 'visual', jsonb_build_object('texture', 'white-paper', 'iconSet', 'drawn-bloom', 'motionPreset', 'quick-gentle', 'decorDensity', 'light'), 'copy', jsonb_build_object('openCta', U&'\62C6\5F00\7ED9\4F60\7684\751F\65E5\60CA\559C', 'storyLead', U&'\4ECA\5929\7684\82B1\3001\7EBF\6761\548C\5C0F\5C0F\5FC3\610F\FF0C\90FD\5728\4E3A\4F60\7559\51FA\4F4D\7F6E\3002'), 'moduleVariants', jsonb_build_object('gallery', 'line-grid', 'messageWall', 'notes-on-paper', 'wishBottle', 'glass-bottle', 'futureMailbox', 'folded-letter', 'surpriseBox', 'garden-gift'))),
    ('collage_pop_redblue', jsonb_build_object('version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'collage-poster', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'collage-wall', 'sectionDivider', 'torn-paper', 'footerVariant', 'ticket-signoff'), 'visual', jsonb_build_object('texture', 'grid-paper', 'iconSet', 'paper-cut', 'motionPreset', 'paper-slide', 'decorDensity', 'medium'), 'copy', jsonb_build_object('openCta', U&'\62C6\5F00\4ECA\5929\7684\5927\60CA\559C', 'storyLead', U&'\628A\597D\5FC3\60C5\8D34\6EE1\8FD9\4E00\9875\FF0C\4ECA\5929\5C31\8981\4E3A\4F60\70ED\70ED\95F9\95F9\3002'), 'moduleVariants', jsonb_build_object('gallery', 'collage-wall', 'messageWall', 'postcard-board', 'wishBottle', 'label-jar', 'futureMailbox', 'red-envelope', 'surpriseBox', 'poster-gift'))),
    ('pink_dark_gothic', jsonb_build_object('version', '2.0.0', 'layout', jsonb_build_object('heroVariant', 'cinematic-portrait', 'contentFlow', 'memory-blessing-wish-surprise-share', 'galleryVariant', 'film-strip', 'sectionDivider', 'rose-fade', 'footerVariant', 'sealed-letter'), 'visual', jsonb_build_object('texture', 'midnight-grain', 'iconSet', 'romantic-line', 'motionPreset', 'slow-cinematic', 'decorDensity', 'restrained'), 'copy', jsonb_build_object('openCta', U&'\6253\5F00\4ECA\665A\53EA\5C5E\4E8E\4F60\7684\504F\7231', 'storyLead', U&'\628A\706F\5149\8C03\6697\4E00\70B9\FF0C\4ECA\665A\7684\6E29\67D4\90FD\5199\7ED9\4F60\3002'), 'moduleVariants', jsonb_build_object('gallery', 'film-strip', 'messageWall', 'sealed-notes', 'wishBottle', 'night-bottle', 'futureMailbox', 'wax-letter', 'surpriseBox', 'night-gift-stage')))
)
update public.templates t
set template_version = '2.0.0',
    template_manifest = coalesce(t.template_manifest, '{}'::jsonb) || r.manifest,
    updated_at = now()
from renderer_manifest r
where t.template_key = r.template_key;

-- Existing generated page snapshots remain untouched. Re-publish an approved order
-- only when you intentionally want it to use its selected renderer 2.0 manifest.