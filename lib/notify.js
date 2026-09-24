import { supabase } from './supabaseClient'

export async function notify(userId, key, params = {}) {
  await supabase.from('notifications').insert({ user_id: userId, msg_key: key, msg_params: params })
}