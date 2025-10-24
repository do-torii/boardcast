import supabase from './supabaseClient'

function ymd(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export async function recordDailyCheckin(userId: string): Promise<number> {
  const today = ymd()
  await supabase
    .from('checkins')
    .upsert({ user_id: userId, date: today }, { onConflict: 'user_id,date' })
  // Return current streak after upsert
  return getCurrentStreak(userId)
}

export async function getCurrentStreak(userId: string, windowDays = 60): Promise<number> {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - windowDays)
  const { data, error } = await supabase
    .from('checkins')
    .select('date')
    .eq('user_id', userId)
    .gte('date', ymd(start))
    .lte('date', ymd(today))
    .order('date', { ascending: false })
  if (error) throw error
  const set = new Set((data || []).map((r: any) => r.date))
  let streak = 0
  const cursor = new Date(today)
  while (true) {
    const key = ymd(cursor)
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

