import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, apiGet, apiPost, logout as requestLogout, type PageResult } from './services/api'
import './equipment.css'

type EquipmentRecord = {
  id: number
  cliente: number
  cliente_nome: string
  categoria: string
  marca: string
  modelo: string
  numero_serie: string
  criado_em: string
}
type Customer = { id: number; nome: string; ativo?: boolean }
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

function Equipment({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const canCreate = ['GERENTE', 'ATENDENTE'].includes(user?.perfil || '')
  const [records, setRecords] = useState<EquipmentRecord[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<ModalKind>(null)
  const [selected, setSelected] = useState<EquipmentRecord | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadEquipment = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (query.trim()) params.set('q', query.trim())
    try {
      const result = await apiGet<PageResult<EquipmentRecord> | EquipmentRecord[]>(`/api/equipamentos/?${params}`)
      const pageRecords = Array.isArray(result) ? result : result.results || []
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? result.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os equipamentos.')
      setRecords([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, query, onLogout])

  useEffect(() => { void loadEquipment() }, [loadEquipment])

  async function openCreate() {
    setModal('create')
    setModalError('')
    setSaving(false)
    try {
      const result = await apiGet<PageResult<Customer> | Customer[]>('/api/clientes/?ativo=1')
      setCustomers((Array.isArray(result) ? result : result.results || []).filter((item) => item.ativo !== false))
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os clientes.')
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setModalError('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    if (typeof data.numero_serie === 'string' && !data.numero_serie.trim()) data.numero_serie = ''
    try {
      await apiPost('/api/equipamentos/', data)
      setModal(null)
      setNotice('Equipamento cadastrado com sucesso.')
      setPage(1)
      if (page === 1) await loadEquipment()
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível cadastrar o equipamento.')
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
          <a className="nav-link" href="/dashboard/"><span className="nav-glyph">▦</span><span className="nav-link-label">Visão geral</span></a>
          <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
          <a className="nav-link" href="/clientes/"><span className="nav-glyph">♙</span><span className="nav-link-label">Clientes</span></a>
          <a className="nav-link active" href="/equipamentos/" aria-current="page"><span className="nav-glyph">▣</span><span className="nav-link-label">Equipamentos</span></a>
          <a className="nav-link" href="/orcamentos/"><span className="nav-glyph">▤</span><span className="nav-link-label">Orçamentos</span></a>
          <a className="nav-link" href="/financeiro/"><span className="nav-glyph">◈</span><span className="nav-link-label">Financeiro</span></a>
          <button className="nav-link nav-link-disabled" type="button" onClick={() => setNotice('Relatórios: módulo ainda em migração para React.')}><span className="nav-glyph">·</span><span className="nav-link-label">Relatórios</span></button>
          {user?.perfil === 'GERENTE' && <button className="nav-link nav-link-disabled" type="button" onClick={() => setNotice('Usuários: módulo ainda em migração para React.')}><span className="nav-glyph">·</span><span className="nav-link-label">Usuários</span></button>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Equipamentos</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>

        <main className="equipment-content">
          {notice && <div className="equipment-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
          <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Equipamentos</h1><p className="page-description">Consulte os equipamentos vinculados aos clientes e suas ordens.</p></div>{canCreate && <div className="page-heading-actions"><button className="button button-primary" type="button" onClick={() => void openCreate()}>＋ Novo equipamento</button></div>}</div>

          <div className="equipment-toolbar"><form className="equipment-filter-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryInput) }}><label className="sr-only" htmlFor="equipment-search">Buscar equipamentos</label><input id="equipment-search" className="equipment-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por categoria, marca, modelo ou série" /><button className="button button-secondary" type="submit">Buscar</button></form><button className="button button-secondary refresh-button" type="button" onClick={() => void loadEquipment()} disabled={loading} aria-label="Atualizar lista">↻ <span>Atualizar</span></button></div>

          {error && <div className="equipment-error" role="alert">{error}<button type="button" onClick={() => void loadEquipment()}>Tentar novamente</button></div>}
          <section className="panel equipment-panel" aria-label="Lista de equipamentos">
            {loading ? <div className="equipment-loading"><span className="spinner" role="status" aria-label="Carregando equipamentos" /></div> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Equipamento</th><th>Cliente</th><th>Número de série</th><th>Cadastrado em</th><th aria-label="Ações" /></tr></thead><tbody>{records.map((item) => <tr key={item.id}><td className="primary-cell">{item.categoria} · {item.marca} {item.modelo}</td><td>{item.cliente_nome}</td><td className="muted-cell">{item.numero_serie || '—'}</td><td className="muted-cell">{formatDateTime(item.criado_em)}</td><td className="right"><button className="equipment-open-button" type="button" onClick={() => { setSelected(item); setModal('detail') }} aria-label={`Ver equipamento ${item.marca} ${item.modelo}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir os equipamentos.' : 'Nenhum equipamento encontrado.'}</p>{canCreate && !error && <button className="button button-secondary button-sm" type="button" onClick={() => void openCreate()}>＋ Novo equipamento</button>}</div>}
            {!loading && count > 0 && <div className="equipment-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</button><span className="page-count">Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </main>
      </div>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className="equipment-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-modal-title">
        <header className="equipment-modal-header"><div><h2 id="equipment-modal-title">{modal === 'create' ? 'Novo equipamento' : `${selected?.marca || ''} ${selected?.modelo || ''}`}</h2><p>{modal === 'create' ? 'Vincule o equipamento ao cliente correto para manter o histórico completo.' : 'Dados cadastrados para este equipamento.'}</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar">×</button></header>
        {modalError && <div className="modal-error" role="alert">{modalError}</div>}
        {modal === 'create' && <form className="equipment-modal-body" onSubmit={handleCreate}><div className="equipment-form-grid">
          <label className="full">Cliente <span>*</span><select name="cliente" required defaultValue=""><option value="" disabled>Selecione um cliente ativo</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label>Categoria <span>*</span><input name="categoria" maxLength={100} required /></label>
          <label>Marca <span>*</span><input name="marca" maxLength={100} required /></label>
          <label>Modelo <span>*</span><input name="modelo" maxLength={100} required /></label>
          <label>Número de série<input name="numero_serie" maxLength={100} /></label>
        </div><footer className="equipment-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || !customers.length}>{saving ? 'Salvando…' : 'Salvar equipamento'}</button></footer></form>}
        {modal === 'detail' && selected && <div className="equipment-modal-body"><div className="equipment-detail-grid"><div><span>Categoria</span><strong>{selected.categoria}</strong></div><div><span>Cliente</span><strong>{selected.cliente_nome}</strong></div><div><span>Número de série</span><strong>{selected.numero_serie || '—'}</strong></div><div><span>Cadastrado em</span><strong>{formatDateTime(selected.criado_em)}</strong></div></div><footer className="equipment-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Fechar</button></footer></div>}
      </section></div>}
    </div>
  )
}

export default Equipment
