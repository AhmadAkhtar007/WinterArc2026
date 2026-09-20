import { useRef } from 'react'
import type { AppRepository } from '../data/appRepository'
import { createPreviewRepository } from '../data/previewRepository'
import { createSupabaseRepository } from '../data/supabaseRepository'
import { isSupabaseConfigured, supabase } from '../data/supabaseClient'
import { AuthPage } from '../auth/AuthPage'
import { useSession } from '../auth/useSession'
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
  const repository = useRef(supabase ? createSupabaseRepository(supabase) : null)
  if (loading) return <main className="loading-screen"><BrandMark /><p>Securing your session</p><span className="loading-line" /></main>
  if (!session || !supabase) return <AuthPage onSignIn={async (email, password) => {
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw new Error('The email or password is incorrect.')
  }} />
  return <AppShell repository={repository.current!} />
}
