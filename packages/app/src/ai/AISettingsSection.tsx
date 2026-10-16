import { useDocument } from '@sutrata/editor'
import { ProviderSettings } from './ProviderSettings'

/**
 * "Intelligence & Voice" section of the editor's Settings dialog, contributed
 * through the editor's PanelRegistry (location 'settings'): provider, model,
 * and API key for the bring-your-own-key AIProvider.
 */
export function AISettingsSection({ openSetup }: { openSetup: () => void }) {
  const { setSettingsVisible } = useDocument()

  return (
    <>
      <ProviderSettings />

      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="cs-ai-btn-secondary"
          onClick={() => {
            setSettingsVisible(false)
            openSetup()
          }}
        >
          Open Setup Wizard
        </button>
      </div>
    </>
  )
}
