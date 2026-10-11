Removes advertisements from YouTube and tidies up the page around them.

Most ad blockers are a black box: you install one, ads mostly disappear, and
you never learn why. FD Reklam Engelleyici works the same way, but it ships
with a Diagnostics tool that tells you exactly which layer is doing the work
and whether anything is leaking through.

── How it blocks ads ──

Four layers, each independently verifiable:

• Network — blocks requests to advertising infrastructure before they leave
  the browser, using the Manifest V3 declarativeNetRequest API. No page
  slowdown, because the request never starts.

• Data pruning — removes ad fields (adPlacements, playerAds, adSlots and ad
  renderers) from the player response before the page's own JavaScript reads
  it. This is what removes pre-roll and mid-roll ads, since the player never
  learns an ad is scheduled.

• Cosmetic filtering — hides what is left: masthead banners, sidebar slots,
  companion panels, promoted results, "Try Premium" dialogs, Shorts shelves,
  comment sections and end-screen cards. Seven groups, each can be switched
  off individually.

• Player fallback — if a video ad ever gets through anyway, the player is
  watched: the skip button is clicked automatically, and unskippable ads are
  muted and fast-forwarded. Your playback rate and volume are restored
  afterwards.

── Diagnostics: see what's actually happening ──

This is the part most blockers don't have. Open Diagnostics and the extension
scans your current YouTube tab and reports, in plain language:

• Whether each blocking layer is active on this page
• Whether ad data was found and removed from the player response
• Whether YouTube's "ad blocker detected" notice was triggered
• Which advertising endpoints were blocked, and which got through
• An A/B test that disables and re-enables the network rules to prove each
  rule is actually firing, using a control address that must never be blocked

If YouTube changes something and ads start leaking, the tool tells you which
layer broke instead of leaving you guessing.

── Clean up the page ──

Seven independently switchable groups hide: advertisements, Premium upsells,
Shorts clutter on the home page, Shorts in the related list, comments,
player overlays and end-screen cards, and notification pop-ups.

You can also add your own rules: right-click any element and choose
"Block this element". The extension writes a CSS selector for it and stores
it as a permanent rule.

── Privacy ──

FD Reklam Engelleyici collects nothing and sends nothing. There is no
analytics, no telemetry, no remote configuration, and no server of ours. All
analysis runs on your device. Settings and counters are kept in
chrome.storage and never leave the machine.

The only network requests the extension makes are to the ad hosts it blocks,
and the pages you already visit.

── Honest limits ──

YouTube inserts some advertisements server-side, directly into the video
stream. No browser extension can block those. Most in-video ads are still
client-side and are blocked here, but not all of them, ever.

If YouTube shows you an "ad blocker detected" notice, you can optionally
enable the anti-detection option in Settings. It is **off by default** —
we would rather show you exactly what we do than hide it.
