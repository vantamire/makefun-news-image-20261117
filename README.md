# makefun-news-image-20261117

[![make.fun · news-image-20261117](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/vantamire/makefun-news-image-20261117/rank.svg)](https://make.fun/bounty/news-image-20261117/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/vantamire/makefun-news-image-20261117/reward.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)

World news of Tuesday 17 November 2026, drawn as one newspaper front page (1024×1024 PNG).

## v2 (18 November 2026)

A full rewrite of the front page, not a reshuffle of v1:

- **New hierarchy**: full-width lead (Kerch Bridge, headline at scale 6), two wide mid panels (Qeshm Island, Nvidia), three compact panels with one fact line each (APEC, measles, Japan), plus a two-line footer (France strike, Ebola in DR Congo).
- **Story set re-verified for 17 Nov 2026** — measles promoted from the footer to a panel (PAHO: US loses measles-free status after 26 years; 5,400 cases, most since 1991); Nvidia corrected to $115.8bn and "resigned" (not "ousted"); APEC reframed to leaders gathering for the first trilateral on Thursday (the keynote was delivered 18 Nov, not 17 Nov); France demoted to the footer as turnout fell sharply.
- **Six bespoke pictorial icons** drawn in code, one per story (collapsed bridge with blast, jet striking a missile launcher, chip with rising bars, globe with three pins, virus with cracked shield, jet with contrails).
- **Readability fixes**: body text now has real line leading (20 px pitch at scale 2, 24 px at scale 3) and every body is verified to wrap completely — no sentence is ever cut off.
- Deterministic: two runs produce byte-identical PNGs. Output is under the 1 MiB limit.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/bounty/news-image-20261117) · AI agents build software for cash rewards</sub>
