import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiGet, logout as requestLogout, type PageResult } from './services/api'
import './budgets.css'
import ModuleIcon from './components/ModuleIcon'

type BudgetItem = {
  id: number
  tipo: string
  tipo_display?: string
  descricao: string
  quantidade: number | string
  valor_unitario: number | string
  total: number | string
}
type BudgetDecision = {
  decisao: string
  decisao_display?: string
  registrado_por_nome?: string
  data: string
  canal_display?: string
  nome_autorizador: string
  evidencia_nome?: string | null
}
type Budget = {
  id: number
  ordem: number
  criador_nome?: string
  versao: number
  situacao: string
  situacao_display?: string
  criado_em: string
  enviado_em?: string | null
  valido_ate?: string | null
  observacoes?: string
  total: number | string
  itens: BudgetItem[]
  decisao?: BudgetDecision | null
}
type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type Props = { onLogout: () => void }
const pageSize = 20
const statuses = [
  ['RASCUNHO', 'Rascunho'],
  ['ENVIADO', 'Enviado'],
  ['APROVADO', 'Aprovado'],
  ['RECUSADO', 'Recusado'],
  ['EXPIRADO', 'Expirado'],
  ['SUBSTITUIDO', 'Substituído'],
] as const

function readUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}
function money(value: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
function date(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(parsed)
}
function dateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}
function statusTone(value: string) {
  if (['APROVADO'].includes(value)) return 'success'
  if (['RECUSADO'].includes(value)) return 'danger'
  if (['ENVIADO', 'EXPIRADO'].includes(value)) return 'warning'
  if (['RASCUNHO'].includes(value)) return 'info'
  return 'neutral'
}

function Budgets({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const [records, setRecords] = useState<Budget[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Budget | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadBudgets = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (query.trim()) params.set('q', query.trim())
    if (status) params.set('situacao', status)
    try {
      const result = await apiGet<PageResult<Budget> | Budget[]>(`/api/orcamentos/?${params}`)
      const pageRecords = Array.isArray(result) ? result : result.results || []
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? result.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os orçamentos.')
      setRecords([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, query, status, onLogout])

  useEffect(() => { void loadBudgets() }, [loadBudgets])

  async function handleLogout() {
    try { await requestLogout() } catch { /* Encerra a sessão local mesmo se a API estiver indisponível. */ }
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
          <a className="nav-link" href="/clientes/"><ModuleIcon name="clients" /><span className="nav-link-label">Clientes</span></a>
          <a className="nav-link" href="/equipamentos/"><ModuleIcon name="equipment" /><span className="nav-link-label">Equipamentos</span></a>
          <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
          <a className="nav-link active" href="/orcamentos/" aria-current="page"><ModuleIcon name="budgets" /><span className="nav-link-label">Orçamentos</span></a>
          <a className="nav-link" href="/financeiro/"><ModuleIcon name="finance" /><span className="nav-link-label">Financeiro</span></a>
          <a className="nav-link" href="/relatorios/"><ModuleIcon name="reports" /><span className="nav-link-label">Relatórios</span></a>
          {user?.perfil === 'GERENTE' && <a className="nav-link" href="/usuarios/"><ModuleIcon name="users" /><span className="nav-link-label">Usuários</span></a>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Orçamentos</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>

        <main className="budgets-content">
          <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Orçamentos</h1><p className="page-description">Acompanhe versões, aprovações e valores dos serviços.</p></div></div>
          <div className="budgets-toolbar"><form className="budgets-filter-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(queryInput) }}><label className="sr-only" htmlFor="budget-search">Buscar orçamentos</label><input id="budget-search" className="budgets-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar por ordem, cliente ou observações"/><button className="button button-secondary" type="submit">Buscar</button><label className="sr-only" htmlFor="budget-status">Filtrar por status</label><select id="budget-status" className="budgets-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">Todos os status</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></form><button className="button button-secondary refresh-button" type="button" onClick={() => void loadBudgets()} disabled={loading} aria-label="Atualizar lista">↻ <span>Atualizar</span></button></div>

          {error && <div className="budgets-error" role="alert">{error}<button type="button" onClick={() => void loadBudgets()}>Tentar novamente</button></div>}
          <section className="panel budgets-panel" aria-label="Lista de orçamentos">
            {loading ? <div className="budgets-loading"><span className="spinner" role="status" aria-label="Carregando orçamentos"/></div> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Orçamento</th><th>Ordem</th><th>Criador</th><th>Status</th><th>Validade</th><th className="right">Total</th><th aria-label="Ações"/></tr></thead><tbody>{records.map((item) => <tr key={item.id} onClick={() => setSelected(item)} className="budget-row"><td className="primary-cell">Versão {item.versao}<div className="muted-cell budget-created">{dateTime(item.criado_em)}</div></td><td><span className="budget-order">OS #{item.ordem}</span></td><td>{item.criador_nome || '—'}</td><td><span className={`status status-${statusTone(item.situacao)}`}>{item.situacao_display || item.situacao}</span></td><td className="muted-cell">{date(item.valido_ate)}</td><td className="right">{money(item.total)}</td><td className="right"><button className="budget-open-button" type="button" onClick={(event) => { event.stopPropagation(); setSelected(item) }} aria-label={`Ver orçamento versão ${item.versao}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir os orçamentos.' : 'Nenhum orçamento encontrado.'}</p></div>}
            {!loading && count > 0 && <div className="budgets-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</button><span className="page-count">Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </main>
      </div>

      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-detail-title"><header className="budget-modal-header"><div><p className="eyebrow">Ordem #{selected.ordem}</p><h2 id="budget-detail-title">Orçamento · versão {selected.versao}</h2><p>{selected.situacao_display || selected.situacao} · criado em {dateTime(selected.criado_em)}</p></div><button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></header>
          <div className="budget-detail-body"><div className="budget-summary"><div><span>Status</span><strong><span className={`status status-${statusTone(selected.situacao)}`}>{selected.situacao_display || selected.situacao}</span></strong></div><div><span>Criado por</span><strong>{selected.criador_nome || '—'}</strong></div><div><span>Validade</span><strong>{date(selected.valido_ate)}</strong></div><div><span>Enviado em</span><strong>{dateTime(selected.enviado_em)}</strong></div><div><span>Total</span><strong>{money(selected.total)}</strong></div></div>
            <section className="budget-items"><h3>Itens do orçamento</h3>{selected.itens?.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Tipo</th><th>Descrição</th><th className="right">Qtd.</th><th className="right">Valor unitário</th><th className="right">Total</th></tr></thead><tbody>{selected.itens.map((item) => <tr key={item.id}><td>{item.tipo_display || item.tipo}</td><td>{item.descricao}</td><td className="right">{new Intl.NumberFormat('pt-BR').format(Number(item.quantidade))}</td><td className="right">{money(item.valor_unitario)}</td><td className="right">{money(item.total)}</td></tr>)}</tbody></table></div> : <p className="budget-empty">Este orçamento ainda não possui itens.</p>}</section>
            {selected.observacoes && <section className="budget-notes"><h3>Observações</h3><p>{selected.observacoes}</p></section>}
            {selected.decisao && <section className="budget-decision"><h3>Decisão registrada</h3><div className="budget-summary"><div><span>Decisão</span><strong>{selected.decisao.decisao_display || selected.decisao.decisao}</strong></div><div><span>Autorizador</span><strong>{selected.decisao.nome_autorizador}</strong></div><div><span>Canal</span><strong>{selected.decisao.canal_display || '—'}</strong></div><div><span>Registrado em</span><strong>{dateTime(selected.decisao.data)}</strong></div><div><span>Registrado por</span><strong>{selected.decisao.registrado_por_nome || '—'}</strong></div></div></section>}
          </div><footer className="budget-modal-footer"><button className="button button-secondary" type="button" onClick={() => setSelected(null)}>Fechar</button><a className="button button-primary" href="/ordens/">Ir para ordens</a></footer>
        </section></div>}
    </div>
  )
}

export default Budgets
