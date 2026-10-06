import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost, logout as requestLogout, type PageResult } from './services/api'
import './clients.css'
import useTransientNotice from './hooks/useTransientNotice'
import ModuleIcon from './components/ModuleIcon'

type Customer = {
  id: number
  nome: string
  telefone: string
  email: string
  documento: string
  endereco: string
  criado_em: string
  ativo: boolean
}

type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type Props = { onLogout: () => void }
type ModalKind = 'create' | 'detail' | null
const pageSize = 20

function readUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function Clients({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const canCreate = ['GERENTE', 'ATENDENTE'].includes(user?.perfil || '')
  const [records, setRecords] = useState<Customer[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { notice, showNotice: setNotice, dismissNotice, isLeaving } = useTransientNotice()
  const [modal, setModal] = useState<ModalKind>(null)
  const [selected, setSelected] = useState<Customer | null>(null)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadClients = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (query.trim()) params.set('q', query.trim())
    if (activeFilter !== '') params.set('ativo', activeFilter)
    try {
      const result = await apiGet<PageResult<Customer> | Customer[]>(`/api/clientes/?${params}`)
      const pageRecords = Array.isArray(result) ? result : result.results || []
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? result.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os clientes.')
      setRecords([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, query, activeFilter, onLogout])

  useEffect(() => { void loadClients() }, [loadClients])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setModalError('')
    const formData = new FormData(event.currentTarget)
    const data = Object.fromEntries(formData.entries())
    for (const field of ['email', 'documento', 'endereco']) {
      if (typeof data[field] === 'string' && !data[field].trim()) data[field] = ''
    }
    try {
      await apiPost('/api/clientes/', data)
      setModal(null)
      setNotice('Cliente cadastrado com sucesso.')
      setPage(1)
      if (page === 1) await loadClients()
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar o cliente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    try { await requestLogout() } catch { /* A sessão local também deve ser encerrada. */ }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-brand"><span className="brand-mark">SF</span><span className="sidebar-brand-name">ServiceFlow<small>gestão de serviços</small></span></div>
        <div className="nav-section-label">Operação</div>
        <nav className="sidebar-nav">
          <a className="nav-link" href="/dashboard/"><span className="nav-glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg></span><span className="nav-link-label">Visão geral</span></a>
          <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
          <a className="nav-link active" href="/clientes/" aria-current="page"><ModuleIcon name="clients" /><span className="nav-link-label">Clientes</span></a>
          <a className="nav-link" href="/equipamentos/"><ModuleIcon name="equipment" /><span className="nav-link-label">Equipamentos</span></a>
          <a className="nav-link" href="/orcamentos/"><ModuleIcon name="budgets" /><span className="nav-link-label">Orçamentos</span></a>
          <a className="nav-link" href="/financeiro/"><ModuleIcon name="finance" /><span className="nav-link-label">Financeiro</span></a>
          <a className="nav-link" href="/relatorios/"><ModuleIcon name="reports" /><span className="nav-link-label">Relatórios</span></a>
          {user?.perfil === 'GERENTE' && <a className="nav-link" href="/usuarios/"><ModuleIcon name="users" /><span className="nav-link-label">Usuários</span></a>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Clientes</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>

        <main className="clients-content">
          {notice && <div className={`clients-notice notice-toast${isLeaving ? ' is-leaving' : ''}`} role="status">{notice}<button type="button" onClick={dismissNotice} aria-label="Fechar aviso">×</button></div>}
          <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Clientes</h1><p className="page-description">Mantenha os contatos e o histórico dos clientes organizados.</p></div>{canCreate && <div className="page-heading-actions"><button className="button button-primary" type="button" onClick={() => { setModalError(''); setModal('create') }}>＋ Novo cliente</button></div>}</div>

          <div className="clients-toolbar">
            <form className="clients-filter-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryInput) }}>
              <label className="sr-only" htmlFor="client-search">Buscar clientes</label><input id="client-search" className="clients-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por nome, telefone ou documento" />
              <button className="button button-secondary" type="submit">Buscar</button>
              <label className="sr-only" htmlFor="client-status">Filtrar clientes</label><select id="client-status" className="clients-select" value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1) }}><option value="">Todos os clientes</option><option value="1">Ativos</option><option value="0">Inativos</option></select>
            </form>
            <button className="button button-secondary refresh-button" type="button" onClick={() => void loadClients()} disabled={loading} aria-label="Atualizar lista">↻ <span>Atualizar</span></button>
          </div>

          {error && <div className="clients-error" role="alert">{error}<button type="button" onClick={() => void loadClients()}>Tentar novamente</button></div>}
          <section className="panel clients-panel" aria-label="Lista de clientes">
            {loading ? <div className="clients-loading"><span className="spinner" role="status" aria-label="Carregando clientes" /></div> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Contato</th><th>Documento</th><th>Status</th><th>Cadastrado em</th><th aria-label="Ações" /></tr></thead><tbody>{records.map((client) => <tr key={client.id}><td className="primary-cell">{client.nome}<div className="muted-cell client-email">{client.email || 'Sem e-mail'}</div></td><td>{client.telefone}</td><td className="muted-cell">{client.documento || '—'}</td><td><span className={`status status-${client.ativo ? 'success' : 'danger'}`}>{client.ativo ? 'Ativo' : 'Inativo'}</span></td><td className="muted-cell">{formatDateTime(client.criado_em)}</td><td className="right"><button className="client-open-button" type="button" onClick={() => { setSelected(client); setModal('detail') }} aria-label={`Ver ${client.nome}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir os clientes.' : 'Nenhum cliente encontrado.'}</p>{canCreate && !error && <button className="button button-secondary button-sm" type="button" onClick={() => setModal('create')}>＋ Novo cliente</button>}</div>}
            {!loading && count > 0 && <div className="clients-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</button><span className="page-count">Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </main>
      </div>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="clients-modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
        <header className="clients-modal-header"><div><h2 id="client-modal-title">{modal === 'create' ? 'Novo cliente' : selected?.nome || 'Dados do cliente'}</h2><p>{modal === 'create' ? 'Cadastre os dados principais para abrir ordens com segurança.' : 'Dados cadastrados para este cliente.'}</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar">×</button></header>
        {modalError && <div className="modal-error" role="alert">{modalError}</div>}
        {modal === 'create' && <form className="clients-modal-body" onSubmit={handleCreate}><div className="clients-form-grid">
          <label>Nome <span>*</span><input name="nome" maxLength={150} required autoFocus /></label>
          <label>Telefone <span>*</span><input name="telefone" maxLength={30} required /></label>
          <label>E-mail<input name="email" type="email" maxLength={254} /></label>
          <label>Documento<input name="documento" maxLength={30} /></label>
          <label className="full">Endereço<input name="endereco" /></label>
        </div><footer className="clients-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar cliente'}</button></footer></form>}
        {modal === 'detail' && selected && <div className="clients-modal-body"><div className="client-detail-grid"><div><span>Telefone</span><strong>{selected.telefone || '—'}</strong></div><div><span>E-mail</span><strong>{selected.email || '—'}</strong></div><div><span>Documento</span><strong>{selected.documento || '—'}</strong></div><div><span>Status</span><strong><span className={`status status-${selected.ativo ? 'success' : 'danger'}`}>{selected.ativo ? 'Ativo' : 'Inativo'}</span></strong></div><div className="full"><span>Endereço</span><strong>{selected.endereco || '—'}</strong></div><div className="full"><span>Cadastrado em</span><strong>{formatDateTime(selected.criado_em)}</strong></div></div><footer className="clients-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Fechar</button></footer></div>}
      </section></div>}
    </div>
  )
}

export default Clients
