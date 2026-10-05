import { useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  apiGet,
  logout as requestLogout,
  type FinancialReport,
  type OperationalReport,
  type PageResult,
  type ServiceOrder,
} from './services/api'
import './dashboard.css'

type UserProfile = {
  nome?: string
  login?: string
  perfil?: string
  perfil_display?: string
}

type DashboardProps = { onLogout: () => void }

const stages = [
  ['RECEBIDA', 'Recebida'],
  ['EM_DIAGNOSTICO', 'Em diagnóstico'],
  ['AGUARDANDO_APROVACAO', 'Aguardando aprovação'],
  ['EM_REPARO', 'Em reparo'],
  ['AGUARDANDO_PECA', 'Aguardando peça'],
  ['EM_TESTES', 'Em testes'],
  ['PREPARAR_DEVOLUCAO', 'Preparar devolução'],
  ['PRONTA_ENTREGA', 'Pronta para entrega'],
  ['ENTREGUE', 'Entregue'],
] as const

function readStoredUser(): UserProfile | null {
  try {
    return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null
  } catch {
    return null
  }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

function formatMoney(value: number | string | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date)
}

function statusTone(status: string) {
  if (['ENTREGUE', 'APROVADO', 'QUITADA', 'PRONTA_ENTREGA'].includes(status)) return 'success'
  if (['CANCELADA', 'RECUSADO', 'ESTORNADA'].includes(status)) return 'danger'
  if (['AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA', 'PENDENTE'].includes(status)) return 'warning'
  if (['EM_REPARO', 'EM_DIAGNOSTICO', 'EM_TESTES', 'RECEBIDA'].includes(status)) return 'info'
  return 'neutral'
}

function Dashboard({ onLogout }: DashboardProps) {
  const user = useMemo(readStoredUser, [])
  const firstName = (user?.nome || user?.login || 'equipe').split(' ')[0]
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [operational, setOperational] = useState<OperationalReport | null>(null)
  const [financial, setFinancial] = useState<FinancialReport | null>(null)
  const [ordersError, setOrdersError] = useState('')
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      const [operationalResult, financialResult, ordersResult] = await Promise.allSettled([
        apiGet<OperationalReport>('/api/relatorios/operacional/'),
        apiGet<FinancialReport>('/api/relatorios/financeiro/'),
        apiGet<PageResult<ServiceOrder> | ServiceOrder[]>('/api/ordens/?page=1'),
      ])
      if (!active) return

      if (ordersResult.status === 'fulfilled') {
        const value = ordersResult.value
        setOrders(Array.isArray(value) ? value : value.results || [])
      } else if (ordersResult.reason instanceof ApiError && [401, 403].includes(ordersResult.reason.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      } else {
        setOrdersError(ordersResult.reason instanceof Error ? ordersResult.reason.message : 'Não foi possível carregar as ordens.')
      }

      setOperational(operationalResult.status === 'fulfilled' ? operationalResult.value : null)
      setFinancial(financialResult.status === 'fulfilled' ? financialResult.value : null)
      setOrdersLoading(false)
    }

    void loadDashboard()
    return () => { active = false }
  }, [onLogout])

  const counts = operational?.ordens_por_situacao || {}
  const activeOrders = Object.entries(counts)
    .filter(([code]) => !['ENTREGUE', 'CANCELADA'].includes(code))
    .reduce((total, [, value]) => total + Number(value || 0), 0)
  const overdue = Number(operational?.ordens_atrasadas || 0)
  const maxStageCount = Math.max(...stages.map(([code]) => Number(counts[code] || 0)), 1)
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  async function handleLogout() {
    try {
      await requestLogout()
    } catch {
      // Encerra também o estado local se a API estiver indisponível.
    }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-brand"><span className="brand-mark">SF</span><span className="sidebar-brand-name">ServiceFlow<small>gestão de serviços</small></span></div>
        <div className="nav-section-label">Operação</div>
        <nav className="sidebar-nav">
          <a className="nav-link active" href="/dashboard/" aria-current="page"><span className="nav-glyph">▦</span><span className="nav-link-label">Visão geral</span></a>
          <a className="nav-link" href="/ordens/"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
          <a className="nav-link" href="/clientes/"><span className="nav-glyph">♙</span><span className="nav-link-label">Clientes</span></a>
          {['Equipamentos', 'Orçamentos', 'Financeiro', 'Relatórios'].map((item) => (
            <button className="nav-link nav-link-disabled" key={item} type="button" title="Módulo ainda não migrado" onClick={() => setNotice(`${item}: módulo ainda em migração para React.`)}><span className="nav-glyph" aria-hidden="true">·</span><span className="nav-link-label">{item}</span></button>
          ))}
          {user?.perfil === 'GERENTE' && <button className="nav-link nav-link-disabled" type="button" onClick={() => setNotice('Usuários: módulo ainda em migração para React.')}><span className="nav-glyph" aria-hidden="true">·</span><span className="nav-link-label">Usuários</span></button>}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer"><div className="sidebar-user"><span className="avatar">{initials || 'SF'}</span><div className="sidebar-user-text"><div className="sidebar-user-name">{user?.nome || user?.login || 'Usuário'}</div><div className="sidebar-user-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div><button className="sidebar-user-menu" type="button" onClick={handleLogout}>Sair</button></div></div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button>
          <div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Visão geral</span></div>
          <div className="topbar-actions">
            <button className="search-box search-disabled" type="button" onClick={() => setNotice('A busca ficará disponível quando o módulo de ordens for migrado.')}>Buscar no sistema</button>
            <button className="icon-button" type="button" onClick={() => setNotice('Não há novas notificações.')} aria-label="Notificações">Avisos</button>
            <div className="topbar-divider" />
            <div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div>
          </div>
        </header>

        <main className="dashboard-content">
          {notice && <div className="dashboard-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
          <div className="page-heading"><div><p className="eyebrow">Visão geral</p><h1 className="page-title">Bom dia, {firstName}.</h1><p className="page-description">Acompanhe o que precisa de atenção e mantenha a operação em movimento.</p></div><div className="page-heading-actions"><button className="button button-primary" type="button" onClick={() => setNotice('A criação de ordens estará disponível quando o módulo de ordens for migrado.')}>＋ Nova ordem</button></div></div>

          {ordersError && <div className="dashboard-error" role="alert">{ordersError}</div>}

          <section className="stats-grid" aria-label="Indicadores da operação">
            <article className="stat-card"><div className="stat-card-header"><span>Ordens em andamento</span><span className="stat-icon">OS</span></div><div className="stat-value">{operational ? formatNumber(activeOrders) : '—'}</div><div className="stat-meta">{operational ? activeOrders ? `${formatNumber(activeOrders)} em acompanhamento` : 'Sem ordens em andamento' : 'Indicador restrito ao gerente'}</div></article>
            <article className="stat-card"><div className="stat-card-header"><span>Ordens atrasadas</span><span className="stat-icon alert-icon">!</span></div><div className="stat-value">{operational ? formatNumber(overdue) : '—'}</div><div className={`stat-meta ${operational && overdue ? 'attention' : 'positive'}`}>{operational ? overdue ? 'Requer atenção' : 'Dentro do prazo' : 'Indicador restrito ao gerente'}</div></article>
            <article className="stat-card"><div className="stat-card-header"><span>Valor recebido</span><span className="stat-icon">R$</span></div><div className="stat-value stat-value-money">{financial ? formatMoney(financial.valor_recebido) : '—'}</div><div className="stat-meta">{financial ? 'Consolidado do período atual' : 'Acesso de gerente necessário'}</div></article>
            <article className="stat-card"><div className="stat-card-header"><span>Saldo pendente</span><span className="stat-icon">R$</span></div><div className="stat-value stat-value-money">{financial ? formatMoney(financial.saldo_pendente) : '—'}</div><div className="stat-meta attention">{financial ? 'A receber das ordens atuais' : 'Acesso de gerente necessário'}</div></article>
          </section>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header"><div><h2 className="panel-title">Ordens recentes</h2><p className="panel-subtitle">Últimas entradas registradas no sistema</p></div><span className="panel-link panel-link-muted">{ordersLoading ? 'Carregando…' : `${orders.length} nesta página`}</span></div>
              {ordersLoading ? <div className="dashboard-loading"><span className="spinner" role="status" aria-label="Carregando ordens" /></div> : orders.length ? (
                <div className="table-wrap"><table className="data-table"><thead><tr><th>Ordem</th><th>Cliente</th><th>Status</th><th>Previsão</th><th className="right">Saldo</th></tr></thead><tbody>
                  {orders.map((order) => <tr key={order.id}><td className="primary-cell"><span className="order-number">{order.numero || `OS #${order.id}`}</span><div className="muted-cell order-equipment">{order.equipamento_descricao || 'Equipamento não informado'}</div></td><td>{order.cliente_nome || `Cliente #${order.cliente}`}</td><td><span className={`status status-${statusTone(order.situacao)}`}>{order.situacao_display || order.situacao}</span></td><td className="muted-cell">{formatDate(order.previsao_entrega)}</td><td className="right">{formatMoney(order.saldo_pendente)}</td></tr>)}
                </tbody></table></div>
              ) : <div className="empty-state"><span className="icon-wrap">i</span><p>Nenhuma ordem de serviço encontrada.</p></div>}
            </section>

            <section className="panel">
              <div className="panel-header"><div><h2 className="panel-title">Fluxo de atendimento</h2><p className="panel-subtitle">Distribuição atual por etapa</p></div></div>
              {operational ? <div className="panel-body">{stages.map(([code, label]) => {
                const value = Number(counts[code] || 0)
                return <div className="progress-row" key={code}><div className="progress-label"><span>{label}</span><strong>{formatNumber(value)}</strong></div><div className="progress-track"><div className={`progress-fill ${code === 'ENTREGUE' ? 'success' : code === 'AGUARDANDO_APROVACAO' ? 'warning' : ''}`} style={{ width: `${value ? Math.max(value / maxStageCount * 100, 8) : 0}%` }} /></div></div>
              })}</div> : <div className="empty-state"><span className="icon-wrap">i</span><p>Relatório operacional disponível para perfil de gerente.</p></div>}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
