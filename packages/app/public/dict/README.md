# Spellcheck Dictionary Assets

This directory holds `.dic` and `.aff` files for Hunspell-compatible spellchecking.

## Required Files

| Language | Code | Files |
|---|---|---|
| English (US) | en | en_US.dic, en_US.aff |
| Hindi | hi | hi_IN.dic, hi_IN.aff |
| Tamil | ta | ta_IN.dic, ta_IN.aff |
| Telugu | te | te_IN.dic, te_IN.aff |
| Kannada | kn | kn_IN.dic, kn_IN.aff |
| Malayalam | ml | ml_IN.dic, ml_IN.aff |
| Bengali | bn | bn_IN.dic, bn_IN.aff |
| Gujarati | gu | gu_IN.dic, gu_IN.aff |
| Gurmukhi/Punjabi | pa | pa_IN.dic, pa_IN.aff |
| Odia | or | or_IN.dic, or_IN.aff |

## Acquisition

### English
Download from LibreOffice: https://github.com/LibreOffice/dictionaries/tree/master/en

### Indic scripts
Available from:
- https://github.com/LibreOffice/dictionaries (search by language code)
- https://hunspell.github.io/

### Installation
Place each pair in this directory:
```
packages/app/public/dict/en_US.dic
packages/app/public/dict/en_US.aff
...
```

The app lazy-loads dictionaries on first use for each language.
