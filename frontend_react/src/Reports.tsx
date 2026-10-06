import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiGet, logout as requestLogout } from './services/api'
import './dashboard.css'
import './reports.css'
import ModuleIcon from './components/ModuleIcon'

type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type OperationalReport = {
  ordens_por_situacao: Record<string, number>
  ordens_atrasadas: number
  tempo_medio_atendimento_dias: number | string
  servicos_por_tecnico: { tecnico_id: number; tecnico_nome: string; servicos_concluidos: number }[]
  equipamentos_aguardando_retirada: number
  retornos: number
}
type FinancialReport = {
  orcamentos_aprovados: number
  orcamentos_recusados: number
  valor_aprovado: number | string
  valor_recebido: number | string
  saldo_pendente: number | string
}
type ReportState<T> = { data: T | null; error: string; restricted: boolean; loading: boolean }

function storedUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}
function money(value: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}
function number(value: number | string) { return new Intl.NumberFormat('pt-BR').format(Number(value || 0)) }
function AnimatedValue({ value, currency = false, decimals = 0 }: { value: number | string; currency?: boolean; decimals?: number }) {
  const target = Number(value || 0)
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(target)
      return
    }
    let startTime: number | null = null
    let frame = 0
    const tick = (time: number) => {
      if (startTime === null) startTime = time
      const progress = Math.min((time - startTime) / 780, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(target * eased)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target])
  return <>{new Intl.NumberFormat('pt-BR', currency
    ? { style: 'currency', currency: 'BRL' }
    : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(current)}</>
}
function labelize(value: string) {
  const labels: Record<string, string> = {
    RECEBIDA: 'Recebida', EM_DIAGNOSTICO: 'Em diagnóstico', AGUARDANDO_APROVACAO: 'Aguardando aprovação',
    EM_REPARO: 'Em reparo', AGUARDANDO_PECA: 'Aguardando peça', EM_TESTES: 'Em testes',
    PREPARAR_DEVOLUCAO: 'Preparar devolução', PRONTA_ENTREGA: 'Pronta para entrega', ENTREGUE: 'Entregue', CANCELADA: 'Cancelada',
  }
  return labels[value] || value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function Reports({ onLogout }: { onLogout: () => void }) {
  const user = useMemo(storedUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const [operational, setOperational] = useState<ReportState<OperationalReport>>({ data: null, error: '', restricted: false, loading: true })
  const [financial, setFinancial] = useState<ReportState<FinancialReport>>({ data: null, error: '', restricted: false, loading: true })
  const [menuOpen, setMenuOpen] = useState(false)

  const loadReports = useCallback(async () => {
    setOperational((state) => ({ ...state, loading: true, error: '' }))
    setFinancial((state) => ({ ...state, loading: true, error: '' }))
    const [opResult, finResult] = await Promise.allSettled([
      apiGet<OperationalReport>('/api/relatorios/operacional/'),
      apiGet<FinancialReport>('/api/relatorios/financeiro/'),
    ])
    const results = [opResult, finResult]
    if (results.some((result) => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401)) {
      localStorage.removeItem('serviceflow.user')
      onLogout()
      return
    }
    const update = <T,>(result: PromiseSettledResult<T>): ReportState<T> => {
      if (result.status === 'fulfilled') return { data: result.value, error: '', restricted: false, loading: false }
      if (result.reason instanceof ApiError && result.reason.status === 403) return { data: null, error: '', restricted: true, loading: false }
      return { data: null, error: result.reason instanceof Error ? result.reason.message : 'Não foi possível carregar este relatório.', restricted: false, loading: false }
    }
    setOperational(update(opResult))
    setFinancial(update(finResult))
  }, [onLogout])

  useEffect(() => { void loadReports() }, [loadReports])

  async function handleLogout() {
    try { await requestLogout() } catch { /* A sessão local também deve ser encerrada. */ }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  const counts = operational.data?.ordens_por_situacao || {}
  const statusRows = Object.entries(counts)
  const maxCount = Math.max(1, ...statusRows.map(([, value]) => Number(value)))

  return <div className="app-shell">
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Navegação principal">
      <div className="sidebar-brand"><span className="brand-mark">SF</span><span className="sidebar-brand-name">ServiceFlow<small>gestão de serviços</small></span></div>
      <div className="nav-section-label">Operação</div>
      <nav className="sidebar-nav">
        <a className="nav-link" href="/dashboard/"><span className="nav-glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg></span><span className="nav-link-label">Visão geral</span></a>
        <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
        <a className="nav-link" href="/clientes/"><ModuleIcon name="clients" /><span className="nav-link-label">Clientes</span></a>
        <a className="nav-link" href="/equipamentos/"><ModuleIcon name="equipment" /><span className="nav-link-label">Equipamentos</span></a>
        <a className="nav-link" href="/orcamentos/"><ModuleIcon name="budgets" /><span className="nav-link-label">Orçamentos</span></a>
        <a className="nav-link" href="/financeiro/"><ModuleIcon name="finance" /><span className="nav-link-label">Financeiro</span></a>
        <a className="nav-link active" href="/relatorios/" aria-current="page"><ModuleIcon name="reports" /><span className="nav-link-label">Relatórios</span></a>
        {user?.perfil === 'GERENTE' && <a className="nav-link" href="/usuarios/"><ModuleIcon name="users" /><span className="nav-link-label">Usuários</span></a>}
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Relatórios</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>
      <main className="reports-content">
        <div className="reports-heading"><div><p className="eyebrow">Análises</p><h1 className="page-title">Relatórios</h1><p className="page-description">Indicadores consolidados para orientar decisões e prioridades.</p></div><button className="button button-secondary" type="button" onClick={() => void loadReports()} disabled={operational.loading || financial.loading}>↻ Atualizar</button></div>
        {(operational.restricted || financial.restricted) && <div className="reports-restricted" role="status"><strong>Acesso restrito</strong><span>Os relatórios estão disponíveis somente para o perfil de gerente.</span></div>}
        <section className="reports-grid" aria-label="Indicadores operacionais">
          <article className="report-card"><div className="report-label">Ordens atrasadas</div><div className={`report-value ${operational.data?.ordens_atrasadas ? 'warning' : 'success'}`}>{operational.loading ? '…' : operational.data ? <AnimatedValue value={operational.data.ordens_atrasadas} /> : operational.restricted ? 'Restrito' : '—'}</div><div className="report-note">Itens fora da previsão de entrega</div></article>
          <article className="report-card"><div className="report-label">Tempo médio</div><div className="report-value">{operational.loading ? '…' : operational.data ? <><AnimatedValue value={operational.data.tempo_medio_atendimento_dias} decimals={2} /> <small>dias</small></> : operational.restricted ? 'Restrito' : '—'}</div><div className="report-note">Entre entrada e conclusão</div></article>
          <article className="report-card"><div className="report-label">Aguardando retirada</div><div className="report-value">{operational.loading ? '…' : operational.data ? <AnimatedValue value={operational.data.equipamentos_aguardando_retirada} /> : operational.restricted ? 'Restrito' : '—'}</div><div className="report-note">Prontas para entrega</div></article>
        </section>
        <section className="reports-grid" aria-label="Indicadores financeiros">
          <article className="report-card"><div className="report-label">Orçamentos aprovados</div><div className="report-value">{financial.loading ? '…' : financial.data ? <AnimatedValue value={financial.data.orcamentos_aprovados} /> : financial.restricted ? 'Restrito' : '—'}</div><div className="report-note">{financial.data ? `${money(financial.data.valor_aprovado)} aprovados` : 'Dados financeiros'}</div></article>
          <article className="report-card"><div className="report-label">Valor recebido</div><div className="report-value report-value-money">{financial.loading ? '…' : financial.data ? <AnimatedValue value={financial.data.valor_recebido} currency /> : financial.restricted ? 'Restrito' : '—'}</div><div className="report-note">Pagamentos confirmados</div></article>
          <article className="report-card"><div className="report-label">Saldo pendente</div><div className="report-value report-value-money">{financial.loading ? '…' : financial.data ? <AnimatedValue value={financial.data.saldo_pendente} currency /> : financial.restricted ? 'Restrito' : '—'}</div><div className="report-note">Valores a receber</div></article>
        </section>
        <div className="reports-panels">
          <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Ordens por situação</h2><p className="panel-subtitle">Distribuição atual do fluxo</p></div></div>
            {operational.loading ? <div className="reports-loading"><span className="spinner" role="status" aria-label="Carregando relatório" /></div> : operational.data ? statusRows.length ? <div className="reports-status-list">{statusRows.map(([status, value]) => <div className="progress-row" key={status}><div className="progress-label"><span>{labelize(status)}</span><strong>{number(value)}</strong></div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(Number(value) / maxCount * 100, 100)}%` }} /></div></div>)}</div> : <div className="empty-state"><span className="icon-wrap">i</span><p>Sem dados operacionais.</p></div> : operational.restricted ? <div className="empty-state"><span className="icon-wrap">i</span><p>Indicador disponível somente para gerentes.</p></div> : <div className="reports-error" role="alert">{operational.error}<button type="button" onClick={() => void loadReports()}>Tentar novamente</button></div>}
          </section>
          <section className="panel"><div className="panel-header"><div><h2 className="panel-title">Serviços concluídos</h2><p className="panel-subtitle">Desempenho por técnico</p></div></div>
            {operational.loading ? <div className="reports-loading"><span className="spinner" role="status" aria-label="Carregando relatório" /></div> : operational.data ? operational.data.servicos_por_tecnico.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Técnico</th><th className="right">Serviços</th></tr></thead><tbody>{operational.data.servicos_por_tecnico.map((item) => <tr key={item.tecnico_id}><td className="primary-cell">{item.tecnico_nome}</td><td className="right">{number(item.servicos_concluidos)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>Ainda não há serviços concluídos.</p></div> : operational.restricted ? <div className="empty-state"><span className="icon-wrap">i</span><p>Indicador disponível somente para gerentes.</p></div> : <div className="reports-error" role="alert">{operational.error}<button type="button" onClick={() => void loadReports()}>Tentar novamente</button></div>}
          </section>
        </div>
        {(operational.error || financial.error) && <div className="reports-errors" role="alert">{operational.error && <p>Relatório operacional: {operational.error}</p>}{financial.error && <p>Relatório financeiro: {financial.error}</p>}</div>}
      </main>
    </div>
  </div>
}

export default Reports
