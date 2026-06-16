---
name: friendlybet-world-cup-story-images
description: Create or refresh FriendlyBet Story of the World Cup image assets and app overlays. Use when generating new 9:16 World Cup story artwork, replacing story-assets PNGs, writing image-generation prompts, checking real player shirt numbers, placing Hebrew/English story captions, or validating that story text does not cover player faces or get cropped in WhatsApp previews.
---

# FriendlyBet World Cup Story Images

## Goal

Create premium share-story assets for FriendlyBet that look like the approved World Cup meme-card concept and survive dashboard, export, and WhatsApp preview constraints.

## Required Visual Concept

- Format: vertical 9:16 PNG, current asset size `941x1672`, saved under `story-assets/`.
- Style: premium sports meme card, stadium lights, crowd, confetti or match atmosphere, dramatic but clean.
- Composition: two key players, full upper body or three-quarter body, heads high in frame but below the baked white title.
- Title: baked into the image, big white condensed uppercase, slight dark stroke/shadow, top area only.
- Subtitle: baked small white score line below the title, for example `USA 4-1 Paraguay`.
- App overlay: only the black caption/banter panel is rendered by the app. Do not render a second yellow result headline.
- Branding: small FriendlyBet mark near the lower edge is acceptable. Do not let branding compete with story text.

## Non-Negotiable Rules

- Never cover player faces with generated artwork text, CSS overlays, canvas text, buttons, or caption panels.
- Keep app-rendered caption panels in the lower-middle safe band: top around `62%`, height around `14.5%`.
- Do not push essential caption text below `65%`; WhatsApp previews may crop it.
- Do not place caption panels above roughly `57%` unless every story image is visually checked and player heads remain clear.
- Hebrew/RTL captions must be `dir="rtl"` and `text-align: right`.
- English/LTR captions must be `dir="ltr"` and `text-align: left`.
- CSS selectors must target actual direction values, such as `.wc-story-caption-panel[dir="rtl"]`, not language codes like `[dir="he"]`.
- If the baked white title/subtitle already contains the result, do not add another result headline in yellow or any other color.
- Do not use the old `.wc-story-copy`, `.wc-story-headline`, or `.wc-story-headline-panel` classes.

## Shirt Numbers

- Every visible player must wear the real shirt number for that national team in the relevant World Cup match/tournament context.
- Verify numbers before prompting or editing. Prefer official FIFA match lineups, official national-team roster pages, or another reliable primary source.
- Put the number in the image-generation prompt as part of the kit itself: "printed naturally into the jersey fabric".
- Do not add numbers afterward as stickers, patches, floating labels, or flat overlays.
- If an official World Cup number is not available, stop and flag the uncertainty instead of inventing a number.

## Prompt Pattern

Use a prompt with explicit composition, title, score, players, and shirt numbers:

```text
Create a vertical 9:16 premium sports meme-card image for FriendlyBet.
Scene: [TEAM A] vs [TEAM B], [result].
Top baked title in large white condensed uppercase: "[TITLE]".
Small white subtitle under it: "[SCORE LINE]".
Two football players in realistic national kits:
- [Player A], [team], shirt number #[number], number printed naturally into the jersey fabric.
- [Player B], [team], shirt number #[number], number printed naturally into the jersey fabric.
Players' heads high in frame but clearly below the top title.
Leave the lower-middle band around 60-77% visually clean enough for a black caption panel.
No Hebrew text, no yellow result headline, no stickers, no fake number patches, no text over faces.
Premium stadium lights, crowd, confetti, sharp editorial sports poster look.
```

## App Overlay Rules

Dashboard cards and exported share images must match:

- `app.js`: `_WC_STORY_LAYOUT.captionY` should stay around `0.62`.
- `styles.css`: `.wc-story-caption-panel { top: 62%; min-height: 14.5%; }`.
- Canvas export should use `dir === 'rtl'` to choose right alignment.
- Dashboard HTML should wrap caption text in `.wc-story-caption-text` for reliable full-width alignment.
- The image asset itself carries the white result title; app code only renders the caption/banter text.

## Story Banter Voice

- Use a personal, dramatic, shareable tone. Be less clever/abstract and more direct about the people in the pool.
- Prefer lines that name participants and make the prediction feel like their personal moment.
- Be specific about the pick type: say `picked Spain to win the World Cup`, `picked Spain to top Group H`, or `picked Tunisia to top the group`; do not blur everything into generic "believed in the team" wording.
- Prefer the most viral concrete angle first when several pick tables are available: tournament-winner picks, then exact group-position picks, then other available specific picks.
- For 4+ matching pickers, keep as many names as the caption can reasonably hold, then add the remainder: `Yossi, Haim, Moshe and 3 others` / `יוסי, חיים, משה ועוד 3 משתתפים`.
- Write count templates with `{names}`, not only `{count}`, so large pools still feel personal.
- Approved tone examples:
  - `Everyone stand up and clap for {names}. {team} first in the group, and suddenly they look like geniuses 👏`
  - `Oh, the shame. {names} picked {team} first, and after this result they are already preparing the defense speech 🎤😬`
  - `That was awkward... {names} picked {team} to go far. After this performance, the form can be torn up or framed as a souvenir 🧾`
  - `{names} went with {team}. Genius? After this result, maybe 🔥`
- Hebrew should follow the same spirit:
  - `כולם לעמוד ולמחוא כפיים ל{names}. {team} בראש הבית, ומסתבר שהם ראו את העתיד 👏`
  - `אוי הבושה. {names} שמו את {team} ראשונה בבית וכבר מכינים נאום הגנה 🎤😬`
  - `זה היה מביך... {names} בחרו את {team}. אחרי היכולת הזאת, אפשר לקרוע את הטופס 🧾`
- Emojis are allowed when they sharpen the emotion, usually 1-2 per caption. Do not let emojis replace the joke.
- Avoid vague team-only banter like `anyone who picked them` or `the group got loud` when pool-specific data can be queried. If no matching pickers exist in the pool, use a match-only fallback with no fake personalization.
- Current story data may include `pool_focuses` ordered from most-specific to fallback. The client should try each focus until it finds real pickers, then render the first matching named caption.

## Validation Checklist

Before shipping:

- Create a contact sheet of all story images with the caption safe-zone rectangle overlaid.
- Visually confirm no caption safe-zone rectangle crosses any player face.
- Check the caption is not so low that WhatsApp preview crops it.
- Run `node scripts\test-world-cup-stories.js`.
- Search for forbidden regressions:

```powershell
rg -n "wc-story-headline|wc-story-copy|_wcDrawCenteredText\(ctx, copy\.headline|headlineY|top: 53\.5%|\[dir=\"he\"\]" app.js styles.css scripts\test-world-cup-stories.js
```

- Verify the release strings are bumped together in `config.js`, `service-worker.js`, and `index.html`.
- Update `CHANGELOG.md` with the story-image and cache/version changes.

## Approved Reference Traits

Use the existing approved assets as the local style reference when present:

- `story-assets/australia-wins-turkey.png`
- `story-assets/scotland-wins-haiti.png`
- `story-assets/brazil-morocco-draw.png`
- `story-assets/qatar-switzerland-draw-base.png`
- `story-assets/usa-wins-paraguay.png`

The key traits to preserve are baked white top headline, compact score subtitle, dramatic sports realism, real integrated jersey numbers, high player heads, and clean lower-middle space for the app caption.
