import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiGet, logout as requestLogout, type PageResult } from './services/api'
import './finance.css'

type Refund = { id: number; valor: number | string; motivo: string; registrado_em: string; autorizado_por_nome?: string }
type Payment = {
  id: number
  ordem: number
  registrado_por_nome?: string
  valor: number | string
  forma: string
  forma_display?: string
  situacao: string
  situacao_display?: string
  pago_em?: string | null
  referencia?: string
  identificador_operacao: string
  estornos?: Refund[]
}
type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type Props = { onLogout: () => void }
const pageSize = 20

function readUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}
function money(value: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
function dateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}
function tone(status: string) {
  if (status === 'CONFIRMADO') return 'success'
  if (['ESTORNADO', 'CANCELADO', 'CANCELADA'].includes(status)) return 'danger'
  if (['PENDENTE', 'PARCIAL'].includes(status)) return 'warning'
  return 'neutral'
}

function Finance({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const [records, setRecords] = useState<Payment[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Payment | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await apiGet<PageResult<Payment> | Payment[]>(`/api/pagamentos/?page=${page}`)
      const pageRecords = Array.isArray(result) ? result : result.results || []
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? result.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os pagamentos.')
      setRecords([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, onLogout])

  useEffect(() => { void loadPayments() }, [loadPayments])

  async function handleLogout() {
    try { await requestLogout() } catch { /* Encerra a sessão local mesmo se a API estiver indisponível. */ }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  const filteredRecords = records.filter((item) => `${item.identificador_operacao} ${item.referencia || ''} ${item.ordem} ${item.registrado_por_nome || ''}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
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
          <a className="nav-link" href="/equipamentos/"><span className="nav-glyph">▣</span><span className="nav-link-label">Equipamentos</span></a>
          <a className="nav-link" href="/orcamentos/"><span className="nav-glyph">▤</span><span className="nav-link-label">Orçamentos</span></a>
          <a className="nav-link active" href="/financeiro/" aria-current="page"><span className="nav-glyph">◈</span><span className="nav-link-label">Financeiro</span></a>
          <a className="nav-link" href="/relatorios/"><span className="nav-glyph">▥</span><span className="nav-link-label">Relatórios</span></a>
          {user?.perfil === 'GERENTE' && <button className="nav-link nav-link-disabled" type="button" onClick={() => setNotice('Usuários: módulo ainda em migração para React.')}><span className="nav-glyph">·</span><span className="nav-link-label">Usuários</span></button>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Financeiro</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>

        <main className="finance-content">
          {notice && <div className="finance-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
          <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Financeiro</h1><p className="page-description">Veja pagamentos registrados e o andamento financeiro das ordens.</p></div></div>
          <div className="finance-toolbar"><form className="finance-search-form" onSubmit={(event) => { event.preventDefault(); setQuery(queryInput.trim()) }}><label className="sr-only" htmlFor="finance-search">Buscar pagamentos</label><input id="finance-search" className="finance-search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Buscar operação, referência, ordem ou responsável"/><button className="button button-secondary" type="submit">Buscar</button></form><button className="button button-secondary refresh-button" type="button" onClick={() => void loadPayments()} disabled={loading} aria-label="Atualizar pagamentos">↻ <span>Atualizar</span></button></div>

          {error && <div className="finance-error" role="alert">{error}<button type="button" onClick={() => void loadPayments()}>Tentar novamente</button></div>}
          <section className="panel finance-panel" aria-label="Pagamentos registrados">
            {loading ? <div className="finance-loading"><span className="spinner" role="status" aria-label="Carregando pagamentos"/></div> : filteredRecords.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Operação</th><th>Ordem</th><th>Registrado por</th><th>Forma</th><th>Status</th><th>Pago em</th><th className="right">Valor</th></tr></thead><tbody>{filteredRecords.map((item) => <tr key={item.id} className="finance-row" onClick={() => setSelected(item)}><td className="primary-cell">{item.identificador_operacao}<div className="muted-cell finance-reference">{item.referencia || 'Sem referência'}</div></td><td><a className="finance-order-link" href={`/ordens/?ordemId=${item.ordem}`} onClick={(event) => event.stopPropagation()}>OS #{item.ordem}</a></td><td>{item.registrado_por_nome || '—'}</td><td className="muted-cell">{item.forma_display || item.forma}</td><td><span className={`status status-${tone(item.situacao)}`}>{item.situacao_display || item.situacao}</span></td><td className="muted-cell">{dateTime(item.pago_em)}</td><td className="right">{money(item.valor)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir os pagamentos.' : query ? 'Nenhum pagamento corresponde à busca nesta página.' : 'Nenhum pagamento registrado.'}</p></div>}
            {!loading && count > 0 && <div className="finance-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros{query ? ` · ${filteredRecords.length} nesta página` : ''}</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</button><span className="page-count">Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </main>
      </div>

      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="finance-modal" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title"><header className="finance-modal-header"><div><p className="eyebrow">Ordem #{selected.ordem}</p><h2 id="payment-detail-title">{selected.identificador_operacao}</h2><p>{selected.forma_display || selected.forma} · {dateTime(selected.pago_em)}</p></div><button className="modal-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></header><div className="finance-detail-grid"><div><span>Valor</span><strong>{money(selected.valor)}</strong></div><div><span>Status</span><strong><span className={`status status-${tone(selected.situacao)}`}>{selected.situacao_display || selected.situacao}</span></strong></div><div><span>Registrado por</span><strong>{selected.registrado_por_nome || '—'}</strong></div><div><span>Referência</span><strong>{selected.referencia || '—'}</strong></div></div>{selected.estornos?.length ? <section className="finance-refunds"><h3>Estornos</h3>{selected.estornos.map((refund) => <div className="finance-refund" key={refund.id}><div><strong>{money(refund.valor)}</strong><span>{refund.motivo}</span></div><small>{dateTime(refund.registrado_em)}{refund.autorizado_por_nome ? ` · ${refund.autorizado_por_nome}` : ''}</small></div>)}</section> : <p className="finance-no-refunds">Nenhum estorno registrado.</p>}<footer className="finance-modal-footer"><button className="button button-secondary" type="button" onClick={() => setSelected(null)}>Fechar</button><a className="button button-primary" href={`/ordens/?ordemId=${selected.ordem}`}>Abrir ordem</a></footer></section></div>}
    </div>
  )
}

export default Finance
