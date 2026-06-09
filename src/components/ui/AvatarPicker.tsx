'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { CAMISA_OPTIONS, EMOJI_OPTIONS, PalpiteAvatar } from './PalpiteAvatar'

const MAX_BYTES = 300 * 1024 // 300 KB

interface AvatarPickerProps {
  nome: string
  palpiteId: number
  currentType?: string | null
  currentValue?: string | null
  onSave: (type: string, value: string) => void
  onClose: () => void
  saving?: boolean
}

export function AvatarPicker({ nome, palpiteId, currentType, currentValue, onSave, onClose, saving }: AvatarPickerProps) {
  const [tab, setTab] = useState<'camisa' | 'emoji' | 'foto'>(
    currentType === 'emoji' ? 'emoji' : currentType === 'upload' ? 'foto' : 'camisa'
  )
  const [selType, setSelType]   = useState(currentType ?? 'initials')
  const [selValue, setSelValue] = useState(currentValue ?? '')

  // Upload state
  const [uploadPreview, setUploadPreview] = useState<string | null>(
    currentType === 'upload' ? (currentValue ?? null) : null
  )
  const [uploadFile, setUploadFile]       = useState<File | null>(null)
  const [uploadError, setUploadError]     = useState<string | null>(null)
  const [uploading, setUploading]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function select(type: string, value: string) {
    setSelType(type)
    setSelValue(value)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Apenas imagens são aceitas (JPG, PNG, WEBP).')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError(`Imagem muito grande. Máximo permitido: 300 KB (seu arquivo: ${Math.round(file.size / 1024)} KB).`)
      return
    }

    setUploadFile(file)
    const reader = new FileReader()
    reader.onload = ev => setUploadPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Pre-select this tab so the preview updates
    setSelType('upload')
    setSelValue('pending')
  }

  async function handleUploadAndSave() {
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await fetch(`/api/palpites/${palpiteId}/avatar/upload`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) {
        setUploadError(json.error ?? 'Erro ao fazer upload.')
        return
      }
      onSave('upload', json.url)
    } catch {
      setUploadError('Erro de rede. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  // When saving non-upload types, call onSave directly; upload has its own flow
  function handleSave() {
    if (tab === 'foto') {
      handleUploadAndSave()
    } else {
      onSave(selType, selValue)
    }
  }

  const isBusy = saving || uploading

  // Preview value: for upload tab show the local preview
  const previewType  = tab === 'foto' ? (uploadPreview ? 'upload' : selType) : selType
  const previewValue = tab === 'foto' ? (uploadPreview ?? selValue) : selValue

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 0', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.6,
    background: active ? 'rgba(74,144,217,0.18)' : 'transparent',
    border: 'none', borderBottom: active ? '2px solid #4A90D9' : '2px solid transparent',
    color: active ? '#7BB8F0' : 'rgba(255,255,255,0.4)',
    cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.15s',
  })

  const canSave = !isBusy && (
    tab === 'foto' ? !!uploadFile : !!selValue
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#0D1E3D', border: '1px solid rgba(74,144,217,0.3)',
        borderRadius: 14, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Escolher avatar</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
        </div>

        {/* Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 10px' }}>
          <PalpiteAvatar nome={nome} avatarType={previewType} avatarValue={previewValue} size={64} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(74,144,217,0.15)', margin: '0 20px' }}>
          <button style={tabStyle(tab === 'camisa')} onClick={() => setTab('camisa')}>⚽ Camisetas</button>
          <button style={tabStyle(tab === 'emoji')}  onClick={() => setTab('emoji')}>😄 Emojis</button>
          <button style={tabStyle(tab === 'foto')}   onClick={() => setTab('foto')}>📷 Foto</button>
        </div>

        {/* Content */}
        <div style={{ padding: '14px 20px', maxHeight: 260, overflowY: 'auto' }}>

          {tab === 'camisa' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {CAMISA_OPTIONS.map(opt => {
                const active = selType === 'camisa' && selValue === opt.value
                return (
                  <button key={opt.value} onClick={() => select('camisa', opt.value)}
                    style={{
                      background: active ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? '#4A90D9' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8, padding: '8px 4px 6px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s',
                    }}>
                    <Image src={`/avatar/Camiseta_${opt.value}.png`} alt={opt.label}
                      width={44} height={44} style={{ objectFit: 'contain' }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: active ? '#7BB8F0' : 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'emoji' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {EMOJI_OPTIONS.map(emoji => {
                const active = selType === 'emoji' && selValue === emoji
                return (
                  <button key={emoji} onClick={() => select('emoji', emoji)}
                    style={{
                      background: active ? 'rgba(74,144,217,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${active ? '#4A90D9' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 8, padding: '10px 0', cursor: 'pointer',
                      fontSize: 24, textAlign: 'center',
                      transition: 'all 0.15s',
                    }}>
                    {emoji}
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'foto' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              {/* Upload area */}
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '20px 0',
                  background: 'rgba(74,144,217,0.06)',
                  border: '2px dashed rgba(74,144,217,0.35)',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'border-color 0.15s',
                }}>
                {uploadPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={uploadPreview} alt="preview"
                    style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10 }} />
                ) : (
                  <span style={{ fontSize: 32 }}>📷</span>
                )}
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  {uploadPreview ? 'Trocar imagem' : 'Clique para escolher uma foto'}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  JPG · PNG · WEBP · máx. 300 KB
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {uploadError && (
                <div style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.3)',
                  fontSize: 12, color: '#ff8080', lineHeight: 1.4,
                }}>
                  {uploadError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid rgba(74,144,217,0.1)' }}>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '9px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{
              background: !canSave ? 'rgba(74,144,217,0.2)' : 'linear-gradient(90deg,#4A90D9,#1a5ca8)',
              border: 'none', color: 'white', padding: '9px 22px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: !canSave ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter,sans-serif',
            }}>
            {uploading ? 'Enviando…' : saving ? 'Salvando…' : 'Salvar avatar'}
          </button>
        </div>
      </div>
    </div>
  )
}
