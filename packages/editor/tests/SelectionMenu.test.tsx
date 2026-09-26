import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { SelectionMenu } from '../src/editor/SelectionMenu';
import { DocumentProvider } from '../src/context/DocumentContext';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { TranslationProvider } from '../src/i18n/useTranslation';
import { stubAIProvider } from './helpers/stub-providers';

describe('SelectionMenu floating toolbar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when there is no selection', () => {
    render(
      <TranslationProvider>
        <DocumentProvider>
          <LanguageProvider>
            <SelectionMenu />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    );

    expect(screen.queryByText('Format')).toBeNull();
  });

  it('renders menu when selection is present inside editor', () => {
    const editorDiv = document.createElement('div');
    editorDiv.className = 'ProseMirror';

    const mockSelection = {
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'some unformatted text',
      getRangeAt: () => ({
        commonAncestorContainer: editorDiv,
        getBoundingClientRect: () => ({
          left: 100,
          width: 200,
          top: 150,
          height: 20,
        }),
      }),
    };

    vi.spyOn(window, 'getSelection').mockImplementation(() => mockSelection as any);

    render(
      <TranslationProvider>
        <DocumentProvider aiProvider={stubAIProvider({ complete: vi.fn(() => new Promise<string>(() => {})) })}>
          <LanguageProvider>
            <SelectionMenu />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    );

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Cut')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();

    // Clicking Format should open the confirm dialog
    fireEvent.click(screen.getByText('Format'));
    expect(screen.getByText('Formatting into Sutra screenplay format...')).toBeInTheDocument();
  });

  it('hides the AI Format action without an AI provider', () => {
    const editorDiv = document.createElement('div');
    editorDiv.className = 'ProseMirror';
    vi.spyOn(window, 'getSelection').mockImplementation(() => ({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'some text',
      getRangeAt: () => ({
        commonAncestorContainer: editorDiv,
        getBoundingClientRect: () => ({ left: 0, width: 10, top: 0, height: 10 }),
      }),
    }) as any);
    render(
      <TranslationProvider>
        <DocumentProvider>
          <LanguageProvider>
            <SelectionMenu />
          </LanguageProvider>
        </DocumentProvider>
      </TranslationProvider>
    );
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.queryByText('Format')).toBeNull();
  });
});
