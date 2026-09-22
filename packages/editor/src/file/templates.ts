export type TemplateType = 'feature' | 'tv-pilot' | 'short' | 'web-series' | 'stage-play'

const BASE_FEATURE = `---
title: Untitled Feature
author:
page: A4
---

# ACT ONE

## INT. LOCATION - DAY {#sc1}
=

`

const BASE_TV_PILOT = `---
title: Untitled Pilot
author:
page: A4
series:
episode: 1
---

## COLD OPEN

## INT. LOCATION - DAY {#sc1}
=

`

const BASE_SHORT = `---
title: Untitled Short
author:
page: A4
---

## INT. LOCATION - DAY {#sc1}
=

`

const BASE_WEB_SERIES = `---
title: Untitled Web Series
author:
page: A4
series:
episode: 1
---

## INT. LOCATION - DAY {#sc1}
=

`

const BASE_STAGE_PLAY = `---
title: Untitled Play
author:
page: A4
---

# ACT ONE

## Scene 1 {#sc1}

`

export const TEMPLATES: Record<TemplateType, string> = {
  'feature': BASE_FEATURE,
  'tv-pilot': BASE_TV_PILOT,
  'short': BASE_SHORT,
  'web-series': BASE_WEB_SERIES,
  'stage-play': BASE_STAGE_PLAY,
}
