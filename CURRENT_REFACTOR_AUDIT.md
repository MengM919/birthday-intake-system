# Six-Step Commercial Refactor Audit

Audit date: 2026-07-17

## Current structure

The repository currently has a single `index.html` and a large `app.js` for both the customer intake and the merchant console. The customer journey is still eight steps. `birthday.html` is separate, but its public message wall and wish bottle currently persist only in the visitor's browser storage.

## Confirmed gaps

- `config/plans.js` has two packages but uses unlimited galleries (`galleryLimit: -1`) and does not match the required database plan codes or 12 / 30 photo limits.
- The database seed in `0001_initial_schema.sql` still contains four legacy plans: `basic_99`, `heart_169`, `surprise_249`, and `all_love_399`.
- `app.js` maps `P01` through `P04` to the four legacy database codes. It blocks both plan and template clicks whenever `cloudState.orderId` exists, which prevents a claimed customer from changing a template before submission.
- The page markup has Steps 1 through 8. The progress pills and `nextStep` logic also assume eight steps.
- The customer page includes merchant login, testing order creation, filtering, export, and order details. This violates the required customer/admin separation.
- `app.js` still binds `copyJson` and exposes a JSON output container. The customer submit button is not the required user-facing action.
- Module rendering is implicit and has old language, including a misleading birthday blind-box description. The internal compatibility key is `surpriseBox`, which must remain, but its visible name needs to be `惊喜盲盒`.
- Photo validation lists HEIC / HEIF MIME types but does not convert them, has no crop/focal data, no featured image handling, no touch sorting, and no per-item retry model.
- Existing `order_files` does not contain `is_featured`, `featured_sort_order`, `focal_x`, `focal_y`, or `crop_data`.
- Current `friend_messages` is customer-private, status defaults to `pending`, and has no safe public read/write Edge Function. The published birthday page uses `localStorage` for walls and wishes rather than shared data.
- `dailyLuck` is a placeholder. No cache table or `daily-luck` Edge Function exists.
- `get-published-page` returns signed private photos but does not return featured ordering or public wall data.
- Existing create and submit functions use the old plan model and have no six-step validation contract.

## Security observations

- Existing tables and private Storage bucket use RLS, which must be retained.
- Server functions currently use the service role only inside Edge Functions, which is correct. No service role key is present in frontend configuration.
- New public message-wall writes must not be granted directly to anonymous browser clients; they need an Edge Function with sanitization and rate limiting.

## Migration risks

- Do not delete old plans because existing orders may reference them. The migration will deactivate them and introduce `basic_166` and `upgrade_288` as the active commercial plans.
- Existing claimed orders can remain readable, but new customer pages should resolve both old and new codes during the transition.
- Changing `friend_messages` in place risks existing policy names and constraints. A dedicated `blessing_wall_messages` table will be added for the public birthday-page wall.
- Some older source files contain text encoding corruption from prior edits. New customer, admin, config, and Edge Function files will be written with ASCII-safe Unicode escapes or HTML entities to prevent visible question marks.

## Refactor order

1. Add two-plan and public-wall migrations, then update frontend configuration.
2. Split the customer and merchant pages; replace the customer journey with six validated steps.
3. Add secure order-state helpers, photo metadata support, and explicit module renderers.
4. Add public-wall and daily-luck Edge Functions, including documented secrets and caching.
5. Add a real standalone `admin.html` and admin script.
6. Update the published birthday page to consume featured images, real public wall data, and real daily-luck results.
7. Run static syntax and subpath checks, then commit and push only project changes.
