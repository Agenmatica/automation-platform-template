import { supabaseClient } from './supabase'

// Compartido entre el hook de UI (useIsSuperadmin) y el
// accessControlProvider (providers/accessControlProvider.ts) — misma
// consulta, dos consumidores distintos.
export async function checkIsSuperadmin(userId: string): Promise<boolean> {
  const { data } = await supabaseClient
    .from('superadmins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  return Boolean(data)
}
