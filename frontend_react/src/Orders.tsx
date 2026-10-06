import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ApiError,
  apiGet,
  apiPost,
  logout as requestLogout,
  type PageResult,
  type ServiceOrder,
} from './services/api'
import './orders.css'
import useTransientNotice from './hooks/useTransientNotice'
import ModuleIcon from './components/ModuleIcon'

type UserProfile = { nome?: string; login?: string; perfil?: string; perfil_display?: string }
type Customer = { id: number; nome: string; ativo?: boolean }
type Equipment = { id: number; cliente: number; categoria: string; marca: string; modelo: string }
type Budget = { id: number; versao: number; situacao_display?: string; total: number | string }
type Payment = { id: number; identificador_operacao: string; forma_display?: string; situacao_display?: string; valor: number | string }
type OrderDetail = ServiceOrder & {
  cliente_nome: string
  equipamento_descricao: string
  atendente_nome?: string
  tecnico_nome?: string | null
  prioridade: string
  prioridade_display?: string
  situacao_financeira?: string
  situacao_financeira_display?: string
  entrada_em: string
  defeito_relatado: string
  condicoes_entrada: string
  acessorios?: string
  orcamentos?: Budget[]
  pagamentos?: Payment[]
}

type Props = { onLogout: () => void }
type ModalState = 'create' | 'detail' | 'payment' | 'budget' | null

const pageSize = 20
const situationOptions = [
  ['RECEBIDA', 'Recebida'],
  ['EM_DIAGNOSTICO', 'Em diagnóstico'],
  ['AGUARDANDO_APROVACAO', 'Aguardando aprovação'],
  ['EM_REPARO', 'Em reparo'],
  ['AGUARDANDO_PECA', 'Aguardando peça'],
  ['EM_TESTES', 'Em testes'],
  ['PRONTA_ENTREGA', 'Pronta entrega'],
  ['ENTREGUE', 'Entregue'],
  ['CANCELADA', 'Cancelada'],
] as const

function readUser(): UserProfile | null {
  try { return JSON.parse(localStorage.getItem('serviceflow.user') || 'null') as UserProfile | null } catch { return null }
}

function listResults<T>(data: T[] | PageResult<T>) {
  return Array.isArray(data) ? data : data.results || []
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatMoney(value?: string | number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function statusTone(status: string) {
  if (['ENTREGUE', 'APROVADO', 'QUITADA', 'PRONTA_ENTREGA', 'CONFIRMADO'].includes(status)) return 'success'
  if (['CANCELADA', 'RECUSADO', 'ESTORNADA'].includes(status)) return 'danger'
  if (['AGUARDANDO_APROVACAO', 'AGUARDANDO_PECA', 'PENDENTE', 'PARCIAL'].includes(status)) return 'warning'
  if (['EM_REPARO', 'EM_DIAGNOSTICO', 'EM_TESTES', 'RECEBIDA', 'ENVIADO'].includes(status)) return 'info'
  return 'neutral'
}

function OrderStatus({ code, label }: { code: string; label?: string }) {
  return <span className={`status status-${statusTone(code)}`}>{label || code.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
}

function Orders({ onLogout }: Props) {
  const user = useMemo(readUser, [])
  const initials = (user?.nome || 'SF').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const [records, setRecords] = useState<ServiceOrder[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { notice, showNotice: setNotice, dismissNotice, isLeaving } = useTransientNotice()
  const [modal, setModal] = useState<ModalState>(null)
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [customerId, setCustomerId] = useState('')
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page) })
    if (search.trim()) params.set('q', search.trim())
    if (situation) params.set('situacao', situation)

    try {
      const result = await apiGet<PageResult<ServiceOrder> | ServiceOrder[]>(`/api/ordens/?${params}`)
      const pageRecords = listResults(result)
      setRecords(pageRecords)
      setCount(Array.isArray(result) ? result.length : result.count ?? pageRecords.length)
    } catch (requestError) {
      if (requestError instanceof ApiError && [401, 403].includes(requestError.status)) {
        localStorage.removeItem('serviceflow.user')
        onLogout()
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as ordens.')
      setRecords([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, search, situation, onLogout])

  useEffect(() => { void loadOrders() }, [loadOrders])

  const openCreate = useCallback(async () => {
    setModal('create')
    setModalError('')
    setSaving(false)
    setCustomerId('')
    try {
      const [customerData, equipmentData] = await Promise.all([
        apiGet<Customer[] | PageResult<Customer>>('/api/clientes/?ativo=1'),
        apiGet<Equipment[] | PageResult<Equipment>>('/api/equipamentos/?page=1'),
      ])
      const activeCustomers = listResults(customerData).filter((item) => item.ativo !== false)
      setCustomers(activeCustomers)
      setEquipment(listResults(equipmentData))
      if (activeCustomers.length) setCustomerId(String(activeCustomers[0].id))
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar clientes e equipamentos.')
    }
  }, [onLogout])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('novo') !== '1') return
    url.searchParams.delete('novo')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void openCreate()
  }, [openCreate])

  const openDetail = useCallback(async (orderId: number) => {
    setModal('detail')
    setDetail(null)
    setModalError('')
    try {
      setDetail(await apiGet<OrderDetail>(`/api/ordens/${orderId}/`))
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar os detalhes da ordem.')
    }
  }, [])

  useEffect(() => {
    const orderId = new URLSearchParams(window.location.search).get('ordemId')
    if (orderId && /^\d+$/.test(orderId)) void openDetail(Number(orderId))
  }, [openDetail])

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setModalError('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    if (!data.previsao_entrega) delete data.previsao_entrega
    try {
      await apiPost('/api/ordens/', data)
      setModal(null)
      setNotice('Ordem de serviço criada com sucesso.')
      setPage(1)
      if (page === 1) await loadOrders()
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a ordem.')
    } finally {
      setSaving(false)
    }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeOrderId) return
    setSaving(true)
    setModalError('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const action = modal
    const body = action === 'payment'
      ? data
      : { valido_ate: data.valido_ate || null, observacoes: data.observacoes || '', itens: [{ tipo: 'SERVICO', descricao: data.descricao, quantidade: data.quantidade, valor_unitario: data.valor_unitario }] }
    try {
      await apiPost(`/api/ordens/${activeOrderId}/${action === 'payment' ? 'pagamentos' : 'orcamentos'}/`, body)
      setModal(null)
      setNotice(action === 'payment' ? 'Pagamento registrado com sucesso.' : 'Orçamento criado com sucesso.')
      await loadOrders()
      await openDetail(activeOrderId)
    } catch (requestError) {
      setModalError(requestError instanceof Error ? requestError.message : 'Não foi possível concluir a operação.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    try { await requestLogout() } catch { /* Limpa a sessão local mesmo se o backend estiver indisponível. */ }
    localStorage.removeItem('serviceflow.user')
    onLogout()
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const filteredEquipment = equipment.filter((item) => String(item.cliente) === customerId)

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? ' open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-brand"><span className="brand-mark">SF</span><span className="sidebar-brand-name">ServiceFlow<small>gestão de serviços</small></span></div>
        <div className="nav-section-label">Operação</div>
        <nav className="sidebar-nav">
          <a className="nav-link" href="/dashboard/"><span className="nav-glyph"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"/><circle cx="12" cy="12" r="3"/></svg></span><span className="nav-link-label">Visão geral</span></a>
          <a className="nav-link active" href="/ordens/" aria-current="page"><span className="nav-glyph">▤</span><span className="nav-link-label">Ordens de serviço</span></a>
          <a className="nav-link" href="/clientes/"><ModuleIcon name="clients" /><span className="nav-link-label">Clientes</span></a>
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
        <header className="topbar"><button className="mobile-menu" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Abrir menu">☰</button><div className="breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><span className="current">Ordens de serviço</span></div><div className="topbar-actions"><div className="topbar-profile"><span className="avatar">{initials || 'SF'}</span><div className="topbar-profile-text"><div className="topbar-profile-name">{user?.nome || user?.login || 'Usuário'}</div><div className="topbar-profile-role">{user?.perfil_display || user?.perfil || 'Equipe'}</div></div></div></div></header>

        <main className="orders-content">
          {notice && <div className={`orders-notice notice-toast${isLeaving ? ' is-leaving' : ''}`} role="status">{notice}<button type="button" onClick={dismissNotice} aria-label="Fechar aviso">×</button></div>}
          <div className="page-heading"><div><p className="eyebrow">Workspace</p><h1 className="page-title">Ordens de serviço</h1><p className="page-description">Controle o atendimento, os prazos e a situação de cada serviço.</p></div><div className="page-heading-actions"><button className="button button-primary" type="button" onClick={() => void openCreate()}>＋ Nova ordem</button></div></div>

          <div className="orders-toolbar">
            <form className="orders-filter-form" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query) }}>
              <label className="sr-only" htmlFor="order-search">Buscar ordens</label>
              <input id="order-search" className="orders-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número ou descrição" />
              <button className="button button-secondary" type="submit">Buscar</button>
              <label className="sr-only" htmlFor="order-situation">Filtrar por situação</label>
              <select id="order-situation" className="orders-select" value={situation} onChange={(event) => { setSituation(event.target.value); setPage(1) }}><option value="">Todas as situações</option>{situationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </form>
            <button className="button button-secondary refresh-button" type="button" onClick={() => void loadOrders()} disabled={loading} aria-label="Atualizar lista">↻ <span>Atualizar</span></button>
          </div>

          {error && <div className="orders-error" role="alert">{error}<button type="button" onClick={() => void loadOrders()}>Tentar novamente</button></div>}
          <section className="panel orders-panel" aria-label="Lista de ordens de serviço">
            {loading ? <div className="orders-loading"><span className="spinner" role="status" aria-label="Carregando ordens" /></div> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Ordem</th><th>Cliente</th><th>Responsável</th><th>Status</th><th>Prioridade</th><th>Entrada</th><th aria-label="Ações" /></tr></thead><tbody>{records.map((order) => <tr key={order.id}><td className="primary-cell"><button className="order-detail-link" type="button" onClick={() => void openDetail(order.id)}>{order.numero || `OS #${order.id}`}</button><div className="muted-cell equipment-name">{order.equipamento_descricao || 'Equipamento não informado'}</div></td><td>{order.cliente_nome || `Cliente #${order.cliente}`}</td><td className="muted-cell">{(order as ServiceOrder & { tecnico_nome?: string; atendente_nome?: string }).tecnico_nome || (order as ServiceOrder & { atendente_nome?: string }).atendente_nome || 'Não atribuído'}</td><td><OrderStatus code={order.situacao} label={order.situacao_display} /></td><td><OrderStatus code={(order as ServiceOrder & { prioridade?: string }).prioridade || ''} label={(order as ServiceOrder & { prioridade_display?: string }).prioridade_display} /></td><td className="muted-cell">{formatDateTime((order as ServiceOrder & { entrada_em?: string }).entrada_em)}</td><td className="right"><button className="order-open-button" type="button" onClick={() => void openDetail(order.id)} aria-label={`Abrir ordem ${order.numero}`}>›</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="icon-wrap">i</span><p>{error ? 'Não foi possível exibir as ordens.' : 'Nenhuma ordem de serviço encontrada.'}</p>{!error && <button className="button button-secondary button-sm" type="button" onClick={() => void openCreate()}>＋ Nova ordem</button>}</div>}
            {!loading && count > 0 && <div className="orders-pagination"><span>{Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} de {count} registros</span><div><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Anterior</button><span className="page-count">Página {page} de {totalPages}</span><button className="button button-secondary button-sm" type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>Próxima</button></div></div>}
          </section>
        </main>
      </div>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null) }}><section className={`orders-modal${modal === 'detail' ? ' orders-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="orders-modal-title">
        <header className="orders-modal-header"><div><h2 id="orders-modal-title">{modal === 'create' ? 'Nova ordem de serviço' : modal === 'detail' ? detail?.numero || 'Detalhes da ordem' : modal === 'payment' ? 'Registrar pagamento' : 'Novo orçamento'}</h2><p>{modal === 'create' ? 'Abra um atendimento com os dados necessários para iniciar o fluxo.' : modal === 'detail' ? detail ? `${detail.cliente_nome} · ${detail.situacao_display || detail.situacao}` : 'Consultando o histórico do atendimento.' : modal === 'payment' ? 'Associe o recebimento a esta ordem para atualizar o saldo.' : 'Crie uma versão de orçamento vinculada a esta ordem.'}</p></div><button className="modal-close" type="button" onClick={() => setModal(null)} aria-label="Fechar">×</button></header>
        {modalError && <div className="modal-error" role="alert">{modalError}</div>}

        {modal === 'create' && <form className="orders-modal-body" onSubmit={submitCreate}>
          <div className="orders-form-grid">
            <label>Cliente <span>*</span><select name="cliente" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Selecione</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label>Equipamento <span>*</span><select name="equipamento" required disabled={!filteredEquipment.length}><option value="">{filteredEquipment.length ? 'Selecione' : 'Nenhum equipamento disponível'}</option>{filteredEquipment.map((item) => <option key={item.id} value={item.id}>{item.categoria} · {item.marca} {item.modelo}</option>)}</select></label>
            <label>Prioridade<select name="prioridade" defaultValue="NORMAL"><option value="NORMAL">Normal</option><option value="BAIXA">Baixa</option><option value="ALTA">Alta</option><option value="URGENTE">Urgente</option></select></label>
            <label>Previsão de entrega<input name="previsao_entrega" type="date" /></label>
            <label className="full">Defeito relatado <span>*</span><textarea name="defeito_relatado" required rows={3} /></label>
            <label className="full">Condições de entrada <span>*</span><textarea name="condicoes_entrada" required rows={3} /></label>
            <label className="full">Acessórios<input name="acessorios" /></label>
          </div>
          <footer className="orders-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || !customers.length || !filteredEquipment.length}>{saving ? 'Salvando…' : 'Criar ordem'}</button></footer>
        </form>}

        {modal === 'detail' && (detail ? <div className="orders-modal-body">
          <div className="order-detail-grid"><div className="panel detail-panel"><div className="panel-header"><h3 className="panel-title">Dados do atendimento</h3><OrderStatus code={detail.situacao} label={detail.situacao_display} /></div><div className="detail-list"><div><span>Cliente</span><strong>{detail.cliente_nome}</strong></div><div><span>Equipamento</span><strong>{detail.equipamento_descricao}</strong></div><div><span>Responsável</span><strong>{detail.tecnico_nome || detail.atendente_nome || 'Não atribuído'}</strong></div><div><span>Prioridade</span><strong>{detail.prioridade_display || detail.prioridade}</strong></div><div><span>Entrada</span><strong>{formatDateTime(detail.entrada_em)}</strong></div><div><span>Previsão</span><strong>{formatDate(detail.previsao_entrega)}</strong></div><div><span>Financeiro</span><OrderStatus code={detail.situacao_financeira || ''} label={detail.situacao_financeira_display} /></div><div className="full"><span>Defeito relatado</span><strong>{detail.defeito_relatado}</strong></div><div className="full"><span>Condições de entrada</span><strong>{detail.condicoes_entrada}</strong></div>{detail.acessorios && <div className="full"><span>Acessórios</span><strong>{detail.acessorios}</strong></div>}</div></div>
            <div className="detail-side"><section className="panel detail-panel"><div className="panel-header"><h3 className="panel-title">Orçamentos</h3></div>{detail.orcamentos?.length ? <div className="mini-list">{detail.orcamentos.map((item) => <div className="mini-list-row" key={item.id}><span>Versão {item.versao}<small>{item.situacao_display || 'Sem status'}</small></span><strong>{formatMoney(item.total)}</strong></div>)}</div> : <p className="detail-empty">Nenhum orçamento registrado.</p>}</section>
              <section className="panel detail-panel"><div className="panel-header"><h3 className="panel-title">Pagamentos</h3></div>{detail.pagamentos?.length ? <div className="mini-list">{detail.pagamentos.map((item) => <div className="mini-list-row" key={item.id}><span>{item.identificador_operacao}<small>{item.forma_display || item.situacao_display || 'Pagamento'}</small></span><strong>{formatMoney(item.valor)}</strong></div>)}</div> : <p className="detail-empty">Nenhum pagamento registrado.</p>}</section></div>
          </div>
          <footer className="orders-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal(null)}>Fechar</button><button className="button button-secondary" type="button" onClick={() => { setActiveOrderId(detail.id); setModalError(''); setModal('budget') }}>＋ Novo orçamento</button><button className="button button-primary" type="button" onClick={() => { setActiveOrderId(detail.id); setModalError(''); setModal('payment') }}>Registrar pagamento</button></footer>
        </div> : <div className="orders-modal-body"><div className="orders-loading"><span className="spinner" role="status" aria-label="Carregando detalhes" /></div></div>)}

        {(modal === 'payment' || modal === 'budget') && <form className="orders-modal-body" onSubmit={submitAction}><div className="orders-form-grid">
          {modal === 'payment' ? <><label>Valor <span>*</span><input name="valor" type="number" min="0.01" step="0.01" required /></label><label>Forma de pagamento <span>*</span><select name="forma" defaultValue="PIX"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="CARTAO_CREDITO">Cartão de crédito</option><option value="CARTAO_DEBITO">Cartão de débito</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></label><label className="full">Identificador da operação <span>*</span><input name="identificador_operacao" required /></label><label className="full">Referência<input name="referencia" /></label></> : <><label className="full">Descrição do serviço/item <span>*</span><input name="descricao" required /></label><label>Quantidade <span>*</span><input name="quantidade" type="number" min="0.001" step="0.001" defaultValue="1" required /></label><label>Valor unitário <span>*</span><input name="valor_unitario" type="number" min="0" step="0.01" required /></label><label>Válido até<input name="valido_ate" type="date" /></label><label className="full">Observações<textarea name="observacoes" rows={3} /></label></>}
        </div><footer className="orders-modal-footer"><button className="button button-secondary" type="button" onClick={() => setModal('detail')}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : modal === 'payment' ? 'Confirmar pagamento' : 'Criar orçamento'}</button></footer></form>}
      </section></div>}
    </div>
  )
}

export default Orders
