import { useState } from 'react'
import { getAIConfig, saveAIConfig, deleteApiKey, ModelConfig, ProviderConfig } from './ai-client'
import './ai-settings.css'

interface Props {
  onGoToKeys: () => void
}

const formatModels = (models?: ModelConfig[]) =>
  (models ?? []).map(m => (m.name === m.id ? m.id : `${m.id}:${m.name}`)).join(', ')

const parseModels = (text: string): ModelConfig[] =>
  text.split(',').map(m => {
    const parts = m.trim().split(':')
    const id = parts[0]?.trim() || ''
    return { id, name: parts[1]?.trim() || id }
  }).filter(m => m.id)

/**
 * Custom OpenAI-compatible endpoints: list, add, edit and delete. Writes go
 * straight to the stored AI config, built on the latest stored value.
 */
export function CustomEndpoints({ onGoToKeys }: Props) {
  const [endpoints, setEndpoints] = useState<ProviderConfig[]>(() => getAIConfig().customProviders)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const resetForm = () => {
    setEditingId(null)
    setId('')
    setName('')
    setBaseUrl('')
    setModels('')
    setError('')
  }

  const startEdit = (p: ProviderConfig) => {
    setEditingId(p.id)
    setId(p.id)
    setName(p.name)
    setBaseUrl(p.baseUrl)
    setModels(formatModels(p.models))
    setConfirmDeleteId(null)
    setError('')
    setNotice('')
  }

  const handleSave = () => {
    if (!id.trim() || !name.trim() || !baseUrl.trim()) {
      setError('Fill out the provider ID, display name and base URL.')
      return
    }
    const list = parseModels(models)
    const next: ProviderConfig = {
      id: id.trim().toLowerCase(),
      name: name.trim(),
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      ...(list.length ? { models: list } : {}),
    }
    const current = getAIConfig()
    const customProviders = [...current.customProviders]
    const index = customProviders.findIndex(p => p.id === next.id)
    if (index >= 0) customProviders[index] = next
    else customProviders.push(next)
    saveAIConfig({ ...current, customProviders })
    setEndpoints(customProviders)
    setNotice(editingId
      ? `Saved changes to "${next.name}".`
      : `Added "${next.name}". Set its key, if it needs one, in the API Keys tab.`)
    resetForm()
  }

  const handleDelete = async (providerId: string) => {
    const current = getAIConfig()
    const removed = current.customProviders.find(p => p.id === providerId)
    const customProviders = current.customProviders.filter(p => p.id !== providerId)
    const modelByProvider = { ...current.modelByProvider }
    delete modelByProvider[providerId]
    const extraBodyByModel = { ...current.extraBodyByModel }
    delete extraBodyByModel[providerId]
    saveAIConfig({
      ...current,
      customProviders,
      modelByProvider,
      extraBodyByModel,
      activeProvider: current.activeProvider === providerId ? 'anthropic' : current.activeProvider,
    })
    await deleteApiKey(providerId)
    setEndpoints(customProviders)
    setConfirmDeleteId(null)
    if (editingId === providerId) resetForm()
    setNotice(`Deleted "${removed?.name ?? providerId}".`)
  }

  const editing = editingId !== null

  return (
    <div className="cs-onboarding-section">
      <p className="cs-onboarding-desc">
        Connect to local OpenAI-compatible endpoints such as Ollama, vLLM, or LM Studio.
        An API key is optional for these, and models are listed from the endpoint when it supports it.
      </p>
      {!window.desktopAPI && (
        <p className="cs-onboarding-desc" style={{ fontSize: '12px' }}>
          In the browser, the server must allow this page's origin ({window.location.origin}) —
          for Ollama, start it with <code>OLLAMA_ORIGINS={window.location.origin}</code>.
          The desktop app doesn't need this.
        </p>
      )}

      {endpoints.length > 0 && (
        <ul className="cs-ai-endpoint-list" aria-label="Your custom endpoints">
          {endpoints.map(p => (
            <li key={p.id} className={`cs-ai-endpoint${editingId === p.id ? ' is-editing' : ''}`}>
              <div className="cs-ai-endpoint-info">
                <span className="cs-ai-endpoint-name">{p.name}</span>
                <span className="cs-ai-endpoint-url">{p.baseUrl}</span>
              </div>
              {confirmDeleteId === p.id ? (
                <div className="cs-ai-endpoint-actions" role="group" aria-label={`Confirm deleting ${p.name}`}>
                  <span className="cs-ai-endpoint-confirm">Delete this endpoint and its key?</span>
                  <button type="button" className="cs-ai-btn-danger" onClick={() => void handleDelete(p.id)}>
                    Delete
                  </button>
                  <button type="button" className="cs-ai-btn-ghost" onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="cs-ai-endpoint-actions">
                  <button
                    type="button"
                    className="cs-ai-btn-ghost"
                    onClick={() => startEdit(p)}
                    aria-label={`Edit ${p.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="cs-ai-btn-ghost"
                    onClick={() => { setConfirmDeleteId(p.id); setNotice('') }}
                    aria-label={`Delete ${p.name}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="cs-onboarding-h3">{editing ? 'Edit endpoint' : 'Add an endpoint'}</h3>
      <div className="cs-ai-form">
        <div className="cs-ai-field">
          <label className="cs-ai-label" htmlFor="cs-ob-custom-id">Provider ID (e.g. ollama)</label>
          <input
            id="cs-ob-custom-id"
            type="text"
            className="cs-ai-input"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="ollama"
            disabled={editing}
          />
        </div>
        <div className="cs-ai-field">
          <label className="cs-ai-label" htmlFor="cs-ob-custom-name">Display name</label>
          <input
            id="cs-ob-custom-name"
            type="text"
            className="cs-ai-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Local Ollama"
          />
        </div>
        <div className="cs-ai-field">
          <label className="cs-ai-label" htmlFor="cs-ob-custom-url">Base URL</label>
          <input
            id="cs-ob-custom-url"
            type="text"
            className="cs-ai-input"
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
          />
        </div>
        <div className="cs-ai-field">
          <label className="cs-ai-label" htmlFor="cs-ob-custom-models">Models (optional)</label>
          <input
            id="cs-ob-custom-models"
            type="text"
            className="cs-ai-input"
            value={models}
            onChange={e => setModels(e.target.value)}
            placeholder="llama3:Llama 3, mistral:Mistral 7B"
            aria-describedby="cs-ob-custom-models-hint"
          />
          <span id="cs-ob-custom-models-hint" className="cs-ai-hint">
            id:name pairs, comma-separated. Used only if the endpoint can't list its models.
          </span>
        </div>
      </div>

      <div aria-live="polite">
        {error && <p className="cs-ai-status is-error" role="alert" style={{ margin: '12px 0 0' }}>{error}</p>}
        {notice && !error && <p className="cs-ai-status is-ok" style={{ margin: '12px 0 0' }}>✓ {notice}</p>}
      </div>

      <div className="cs-dialog-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <button type="button" className="cs-ai-btn-ghost" onClick={onGoToKeys}>
          Go to API Keys
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {editing && (
            <button type="button" className="cs-ai-btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
          <button type="button" className="cs-voice-btn-primary" onClick={handleSave}>
            {editing ? 'Save Changes' : 'Register Endpoint'}
          </button>
        </div>
      </div>
    </div>
  )
}
