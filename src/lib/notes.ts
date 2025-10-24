import supabase from './supabaseClient'

export type DbNote = {
  id: string
  title: string
  body: string
  color: 'yellow' | 'pink' | 'mint' | 'lav' | 'blue'
  category: string
  author: string
  created_at: string
  note_date?: string | null
  likes?: number | null
  pinned?: boolean | null
}

export type NewNote = {
  id?: string
  title: string
  body: string
  color: DbNote['color']
  category: string
  author: string
  created_at?: string
  note_date?: string | null
  likes?: number
  pinned?: boolean
}

export async function listNotes(userId?: string) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  const all = (data || []) as DbNote[]
  let likedIds: string[] = []
  if (userId && all.length) {
    const ids = all.map((n) => n.id)
    const { data: likesData, error: likesErr } = await supabase
      .from('note_likes')
      .select('note_id')
      .in('note_id', ids)
      .eq('user_id', userId)
    if (!likesErr && likesData) likedIds = likesData.map((r: any) => r.note_id)
  }
  const pinned = all.filter((n) => n.pinned)
  const feed = all.filter((n) => !n.pinned)
  return { pinned, feed, likedIds }
}

export async function createNote(input: NewNote): Promise<DbNote> {
  const payload = {
    ...input,
    created_at: input.created_at || new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('notes')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data as DbNote
}

export async function updateLikes(id: string, likes: number): Promise<DbNote> {
  const { data, error } = await supabase
    .from('notes')
    .update({ likes })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as DbNote
}

export async function likeNote(noteId: string, userId: string): Promise<number> {
  const { error: upErr } = await supabase
    .from('note_likes')
    .upsert({ note_id: noteId, user_id: userId }, { onConflict: 'note_id,user_id' })
  if (upErr) throw upErr
  const { count, error: cntErr } = await supabase
    .from('note_likes')
    .select('*', { count: 'exact', head: true })
    .eq('note_id', noteId)
  if (cntErr) throw cntErr
  const total = count || 0
  await updateLikes(noteId, total)
  return total
}

export async function unlikeNote(noteId: string, userId: string): Promise<number> {
  const { error: delErr } = await supabase
    .from('note_likes')
    .delete()
    .eq('note_id', noteId)
    .eq('user_id', userId)
  if (delErr) throw delErr
  const { count, error: cntErr } = await supabase
    .from('note_likes')
    .select('*', { count: 'exact', head: true })
    .eq('note_id', noteId)
  if (cntErr) throw cntErr
  const total = count || 0
  await updateLikes(noteId, total)
  return total
}
