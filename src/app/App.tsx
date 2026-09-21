import { useRef, useState } from 'react'
import type { AppRepository } from '../data/appRepository'
import { createPreviewRepository } from '../data/previewRepository'
import { createSupabaseRepository } from '../data/supabaseRepository'
import { isSupabaseConfigured, supabase } from '../data/supabaseClient'
import { AuthPage } from '../auth/AuthPage'
import { useSession } from '../auth/useSession'
import { normalizePlayerCode } from '../auth/playerIdentity'
import { BrandMark } from '../components/BrandMark'
import { AppShell } from './AppShell'

interface AppProps { repository?: AppRepository }

export function App({ repository }: AppProps) {
  if (repository) return <AppShell repository={repository} />
  if (!isSupabaseConfigured || !supabase) return <PreviewApp />
  return <ConnectedApp />
}

function PreviewApp() {
  const repository = useRef(createPreviewRepository())
  return <AppShell repository={repository.current} />
}

function ConnectedApp() {
  const { session, loading } = useSession()
  const [creatingIdentity, setCreatingIdentity] = useState(false)
  const [assignedPlayerCode, setAssignedPlayerCode] = useState('')
  const repository = useRef(supabase ? createSupabaseRepository(supabase) : null)
  if (loading) return <main className="loading-screen"><BrandMark /><p>Securing your session</p><span className="loading-line" /></main>
  if (!session || !supabase || creatingIdentity) return <AuthPage assignedPlayerCode={assignedPlayerCode} onEnter={() => setCreatingIdentity(false)} onCreateIdentity={async (displayName, password) => {
    setCreatingIdentity(true)
    const email = `${crypto.randomUUID()}@players.winterarc.invalid`
    const { data, error } = await supabase!.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
    if (error || !data.user || !data.session) {
      setCreatingIdentity(false)
      throw new Error(error?.message ?? 'Identity creation is not enabled yet.')
    }
    const { data: profile, error: profileError } = await supabase!.from('profiles').select('player_code').eq('id', data.user.id).single()
    if (profileError || !profile) {
      setCreatingIdentity(false)
      throw new Error('Your Player ID could not be loaded.')
    }
    await supabase!.auth.refreshSession()
    setAssignedPlayerCode(profile.player_code as string)
    return profile.player_code as string
  }} onSignIn={async (playerCode, password) => {
    const normalized = normalizePlayerCode(playerCode)
    const { data: email, error: lookupError } = await supabase!.rpc('resolve_player_login', { target_player_code: normalized })
    if (lookupError || !email) throw new Error('The Player ID or password is incorrect.')
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw new Error('The Player ID or password is incorrect.')
  }} />
  return <AppShell repository={repository.current!} />
}
