import { describe, it, expect } from 'vitest'
import en from '../../src/locales/en.json'
import hi from '../../src/locales/hi.json'
import ta from '../../src/locales/ta.json'
import te from '../../src/locales/te.json'
import ml from '../../src/locales/ml.json'
import kn from '../../src/locales/kn.json'
import bn from '../../src/locales/bn.json'
import gu from '../../src/locales/gu.json'
import mr from '../../src/locales/mr.json'
import pa from '../../src/locales/pa.json'
import or from '../../src/locales/or.json'
import si from '../../src/locales/si.json'

const LOCALES: Record<string, Record<string, string>> = { hi, ta, te, ml, kn, bn, gu, mr, pa, or, si }
const EN_KEYS = Object.keys(en)

describe('locale parity', () => {
  for (const [lang, strings] of Object.entries(LOCALES)) {
    it(`${lang}.json has all keys from en.json`, () => {
      const missingKeys = EN_KEYS.filter(key => !(key in strings))
      expect(missingKeys).toEqual([])
    })
  }
})
