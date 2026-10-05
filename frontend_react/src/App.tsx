import { useState, type FormEvent } from 'react'
import Dashboard from './Dashboard'
import Clients from './Clients'
import Budgets from './Budgets'
import Equipment from './Equipment'
import Finance from './Finance'
import Orders from './Orders'
import { login } from './services/api'
import './login.css'

function LoginPage() {
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await login({ login: loginName, password })
      localStorage.setItem('serviceflow.user', JSON.stringify(user))
      window.location.assign('/dashboard/')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível entrar. Verifique suas credenciais e tente novamente.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-layout" aria-label="Acesso ao ServiceFlow">
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">SF</span>
              <span>ServiceFlow</span>
            </div>
            <h1>O trabalho flui melhor quando tudo está no lugar.</h1>
            <p>
              Uma visão clara das ordens, clientes e resultados da sua operação
              de serviços.
            </p>
          </div>
          <div className="login-brand-footer">
            Gestão de serviços · ambiente interno
          </div>
        </div>

        <div className="login-form-wrap">
          <form className="login-form" onSubmit={handleSubmit}>
            <p className="eyebrow">Acesso seguro</p>
            <h2>Entrar na sua conta</h2>
            <p className="form-intro">
              Use suas credenciais para acompanhar a operação.
            </p>

            {error && <div className="login-message error" role="alert">{error}</div>}
            <div className="field login-field">
              <label htmlFor="login">Login <span>*</span></label>
              <input
                id="login"
                name="login"
                autoComplete="username"
                value={loginName}
                onChange={(event) => setLoginName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="field login-field login-password-field">
              <label htmlFor="password">Senha <span>*</span></label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}

function App() {
  const route = window.location.pathname
  let hasStoredUser = false

  try {
    hasStoredUser = Boolean(localStorage.getItem('serviceflow.user'))
  } catch {
    hasStoredUser = false
  }

  if (hasStoredUser && route.startsWith('/dashboard')) {
    return <Dashboard onLogout={() => window.location.assign('/')} />
  }
  if (hasStoredUser && route.startsWith('/ordens')) {
    return <Orders onLogout={() => window.location.assign('/')} />
  }
  if (hasStoredUser && route.startsWith('/clientes')) {
    return <Clients onLogout={() => window.location.assign('/')} />
  }
  if (hasStoredUser && route.startsWith('/equipamentos')) {
    return <Equipment onLogout={() => window.location.assign('/')} />
  }
  if (hasStoredUser && route.startsWith('/orcamentos')) {
    return <Budgets onLogout={() => window.location.assign('/')} />
  }
  if (hasStoredUser && route.startsWith('/financeiro')) {
    return <Finance onLogout={() => window.location.assign('/')} />
  }

  return <LoginPage />
}

export default App
