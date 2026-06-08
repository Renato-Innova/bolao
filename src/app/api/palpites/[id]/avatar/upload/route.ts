import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

const MAX_BYTES = 300 * 1024 // 300 KB
const BUCKET    = 'avatars'
const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check — user must own this palpite
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  // Verify ownership
  const { data: palpite } = await supabase
    .from('palpites')
    .select('id')
    .eq('id', parseInt(id, 10))
    .eq('usuario_id', user.id)
    .single()
  if (!palpite) return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })

  // Parse multipart form
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({
      error: `Arquivo muito grande (${Math.round(file.size / 1024)} KB). Máximo: 300 KB.`
    }, { status: 400 })
  }

  // Upload to Supabase Storage using admin client (bypasses RLS on storage)
  const admin = createAdminClient()
  const ext   = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path  = `palpite_${id}/${user.id}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true, // overwrite previous upload for this palpite
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)

  // Bust cache by appending timestamp
  const url = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ url })
}
