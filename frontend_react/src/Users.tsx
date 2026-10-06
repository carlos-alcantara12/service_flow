import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost, logout as requestLogout, type PageResult } from './services/api'
import './dashboard.css'
import './users.css'
import useTransientNotice from './hooks/useTransientNotice'

type UserRecord = {
  id: number
  nome: string
  login: string
  email?: string | null
  perfil: string
  perfil_display?: string
  ativo: boolean
  date_joined: string
}
type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type UserForm = { nome: string; login: string; email: string; perfil: string; password: string }
type Props = { onLogout: () => void }
const pageSize = 20
const profiles = [['ATENDENTE', 'Atendente'], ['TECNICO', 'Técnico'], ['GERENTE', 'Gerente']]

function readUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}
function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
function roleTone(role: string) {
  if (role === 'GERENTE') return 'info'
  if (role === 'TECNICO') return 'success'
  return 'neutral'
}

function Users({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const [records, setRecords] = useState<UserRecord[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [profile, setProfile] = useState('')
  const [active, setActive] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [selected, setSelected] = useState<UserRecord | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const { notice, showNotice: setNotice, dismissNotice, isLeaving } = useTransientNotice()
  const [menuOpen, setMenuOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    setForbidden(false)
    const params = new URLSearchParams({ page: String(page) })
    if (search.trim()) params.set('q', search.trim())
    if (profile) params.set('perfil', profile)
    if (active) params.set('ativo', active)
    try {
      const result = await apiGet<PageResult<UserRecord> | UserRecord[]>(`/api/usuarios/?${params}`)
      const pageRecords = Array.isArray(result) ? result : result.results || []
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? pageRecords.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      if (requestError instanceof ApiError && requestError.status === 403) {
        setForbidden(true)
        setRecords([])
        setCount(0)
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os usuários.')
        setRecords([])
        setCount(0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, profile, active, onLogout])

  useEffect(() => { void loadUsers() }, [loadUsers])

  async function handleLogout() {
    try { await requestLogout() } catch { /* Encerra também o estado local se a API estiver indisponível. */ }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload: UserForm = {
      nome: String(data.get('nome') || '').trim(),
      login: String(data.get('login') || '').trim(),
      email: String(data.get('email') || '').trim(),
      perfil: String(data.get('perfil') || 'ATENDENTE'),
      password: String(data.get('password') || ''),
    }
    setSaving(true)
    setFormError('')
    try {
      await apiPost<UserRecord>('/api/usuarios/', payload)
      setCreateOpen(false)
      setNotice('Usuário cadastrado com sucesso.')
      setSearchInput('')
      setSearch('')
      setProfile('')
      setActive('')
      setPage(1)
      if (page === 1 && !search && !profile && !active) void loadUsers()
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        if (requestError.status === 401) {
          localStorage.removeItem('serviceflow.user')
          onLogout()
        } else {
          setFormError('Seu perfil não tem permissão para cadastrar usuários.')
        }
      } else {
        setFormError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar o usuário.')
      }
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return <div className="app-shell">
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Navegação principal">
      <div className="sidebar-brand"><span className="brand-mark">SF</span><span className="sidebar-brand-name">ServiceFlow<small>gestão de serviços</small></span></div>
      <div className="nav-section-label">Operação</div>
      <nav className="sidebar-nav">
        <a className="nav-link" href="/dashboard/"><span className="nav-glyph">▦</span><span className="nav-link-label">Visão geral</span></a>
        <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
        <a className="nav-link" href="/clientes/"><span className="nav-glyph">♙</span><span className="nav-link-label">Clientes</span></a>
        <a className="nav-link" href="/equipamentos/"><span className="nav-glyph">▣</span><span className="nav-link-label">Equipamentos</span></a>
        <a className="nav-link" href="/orcamentos/"><span className="nav-glyph">▤</span><span className="nav-link-label">Orçamentos</span></a>
        <a className="nav-link" href="/financeiro/"><span className="nav-glyph">◈</span><span className="nav-link-label">Financeiro</span></a>
        <a className="nav-link" href="/relatorios/"><span className="nav-glyph">▥</span><span className="nav-link-label">Relatórios</span></a>
        {user?.perfil === 'GERENTE' && <a className="nav-link active" href="/usuarios/" aria-current="page"><span className="nav-glyph">⚙</span><span className="nav-link-label">Usuários</span></a>}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Usuários</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>
      <main className="users-content">
        {notice && <div className={`users-notice notice-toast${isLeaving ? ' is-leaving' : ''}`} role="status">{notice}<button type="button" onClick={dismissNotice} aria-label="Fechar aviso">×</button></div>}
        <div className="users-heading"><div><p className="eyebrow">Administração</p><h1 className="page-title">Usuários</h1><p className="page-description">Gerencie quem pode acessar e operar o sistema.</p></div><button className="button button-primary" type="button" onClick={() => { setFormError(''); setCreateOpen(true) }}>＋ Novo usuário</button></div>
        {forbidden ? <section className="users-access-denied" role="alert"><strong>Acesso restrito</strong><p>A gestão de usuários está disponível somente para gerentes.</p></section> : <>
          <form className="users-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput) }}>
            <label className="sr-only" htmlFor="users-search">Buscar pelo nome</label><input id="users-search" className="users-search" placeholder="Buscar por nome…" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            <label className="sr-only" htmlFor="users-profile">Filtrar perfil</label><select id="users-profile" className="users-select" value={profile} onChange={(event) => { setProfile(event.target.value); setPage(1) }}><option value="">Todos os perfis</option>{profiles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="sr-only" htmlFor="users-active">Filtrar status</label><select id="users-active" className="users-select" value={active} onChange={(event) => { setActive(event.target.value); setPage(1) }}><option value="">Todos os status</option><option value="1">Ativos</option><option value="0">Inativos</option></select>
            <button className="button button-secondary" type="submit">Buscar</button><button className="button button-secondary" type="button" onClick={() => void loadUsers()} disabled={loading}>↻ Atualizar</button>
          </form>
          {error && <div className="users-error" role="alert">{error}<button type="button" onClick={() => void loadUsers()}>Tentar novamente</button></div>}
          <section className="panel users-panel" aria-label="Lista de usuários">
            {loading ? <div className="users-loading"><span className="spinner" role="status" aria-label="Carregando usuários" /></div> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Usuário</th><th>Login</th><th>Perfil</th><th>Status</th><th>Entrada</th><th aria-label="Detalhes" /></tr></thead><tbody>{records.map((item) => <tr className="users-row" key={item.id} onClick={() => setSelected(item)}><td className="primary-cell">{item.nome}<div className="muted-cell users-email">{item.email || 'Sem e-mail'}</div></td><td>{item.login}</td><td><span className={`status status-${roleTone(item.perfil)}`}>{item.perfil_display || item.perfil}</span></td><td><span className={`status status-${item.ativo ? 'success' : 'danger'}`}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td><td className="muted-cell">{formatDateTime(item.date_joined)}</td><td className="right"><button className="users-detail-button" type="button" onClick={(event) => { event.stopPropagation(); setSelected(item) }} aria-label={`Ver usuário ${item.nome}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir os usuários.' : 'Nenhum usuário encontrado.'}</p></div>}
            {!loading && count > 0 && <div className="users-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Anterior</button><span>Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </>}
      </main>
    </div>
    {selected && <div className="users-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="users-modal" role="dialog" aria-modal="true" aria-labelledby="user-detail-title"><header className="users-modal-header"><div><p className="eyebrow">Dados do usuário</p><h2 id="user-detail-title">{selected.nome}</h2></div><button className="users-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></header><div className="users-details"><div><span>Login</span><strong>{selected.login}</strong></div><div><span>E-mail</span><strong>{selected.email || 'Sem e-mail'}</strong></div><div><span>Perfil</span><strong>{selected.perfil_display || selected.perfil}</strong></div><div><span>Status</span><strong>{selected.ativo ? 'Ativo' : 'Inativo'}</strong></div><div><span>Entrada</span><strong>{formatDateTime(selected.date_joined)}</strong></div></div><footer className="users-modal-footer"><button className="button button-secondary" type="button" onClick={() => setSelected(null)}>Fechar</button></footer></section></div>}
    {createOpen && <div className="users-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCreateOpen(false) }}><section className="users-modal" role="dialog" aria-modal="true" aria-labelledby="user-create-title"><header className="users-modal-header"><div><p className="eyebrow">Administração</p><h2 id="user-create-title">Novo usuário</h2><p>Defina o perfil e o acesso inicial da pessoa na operação.</p></div><button className="users-close" type="button" onClick={() => !saving && setCreateOpen(false)} aria-label="Fechar">×</button></header><form onSubmit={createUser}><div className="users-form-grid">{formError && <div className="users-form-error" role="alert">{formError}</div>}<label>Nome <span>*</span><input name="nome" required maxLength={150} autoComplete="name" /></label><label>Login <span>*</span><input name="login" required maxLength={150} autoComplete="username" /></label><label>E-mail<input name="email" type="email" autoComplete="email" /></label><label>Perfil <span>*</span><select name="perfil" required defaultValue="ATENDENTE">{profiles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="users-password-field">Senha inicial <span>*</span><input name="password" type="password" minLength={8} required autoComplete="new-password" /><small>Mínimo de 8 caracteres; a API também aplica as regras de segurança configuradas.</small></label></div><footer className="users-modal-footer"><button className="button button-secondary" type="button" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar usuário'}</button></footer></form></section></div>}
  </div>
}

export default Users
