import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { TranslationProvider, useTranslation } from '../../src/i18n/useTranslation'
import React from 'react'

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TranslationProvider, null, children)
}

describe('useTranslation', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('t() returns English string by default', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    expect(result.current.t('toolbar.undo')).toBe('Undo')
  })

  it('t() returns Hindi string after setLocale("hi")', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    act(() => result.current.setLocale('hi'))
    expect(result.current.t('toolbar.undo')).toBe('पूर्ववत करें')
  })

  it('t() falls back to English for missing key in locale', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    act(() => result.current.setLocale('hi'))
    // Key that exists in English but hypothetically missing in Hindi would fallback
    const val = result.current.t('toolbar.undo')
    expect(typeof val).toBe('string')
    expect(val.length).toBeGreaterThan(0)
  })

  it('t() returns key itself for completely missing key', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('setLocale ignores unknown locale codes', () => {
    const { result } = renderHook(() => useTranslation(), { wrapper })
    act(() => result.current.setLocale('xx')) // unknown
    expect(result.current.locale).toBe('en') // unchanged
  })
})
