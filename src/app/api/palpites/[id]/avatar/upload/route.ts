import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const MAX_BYTES = 300 * 1024 // 300 KB
const BUCKET    = 'avatars'
const ALLOWED   = ['image/jpeg', 'image/png', 'image/webp']

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  // Check if bucket exists; create if not
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = (buckets ?? []).some((b: { id: string }) => b.id === BUCKET)
  if (!exists) {
    await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED,
    })
  }
}

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
    return NextResponse.json({ error: 'Tipo não permitido. Use JPG, PNG ou WEBP.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({
      error: `Arquivo muito grande (${Math.round(file.size / 1024)} KB). Máximo: 300 KB.`
    }, { status: 400 })
  }

  const admin  = createAdminClient()
  const folder = `palpite_${id}`

  // Ensure bucket exists (creates it if missing)
  await ensureBucket(admin)

  // Delete ALL previous files for this palpite (one photo per palpite rule)
  const { data: existing } = await admin.storage.from(BUCKET).list(folder)
  if (existing && existing.length > 0) {
    const paths = existing.map((f: { name: string }) => `${folder}/${f.name}`)
    await admin.storage.from(BUCKET).remove(paths)
  }

  // Upload new file
  const ext  = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${folder}/avatar.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Public URL with cache-bust
  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(path)
  const url = `${publicUrl}?t=${Date.now()}`

  return NextResponse.json({ url })
}
