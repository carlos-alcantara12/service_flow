type Credentials = {
  login: string
  password: string
}

export type AuthenticatedUser = {
  id: number
  nome: string
  login: string
  email?: string
  perfil: string
  perfil_display?: string
  ativo: boolean
}

export type ServiceOrder = {
  id: number
  numero: string
  cliente: number
  cliente_nome?: string
  equipamento_descricao?: string
  situacao: string
  situacao_display?: string
  previsao_entrega?: string | null
  saldo_pendente?: number | string
}

export type OperationalReport = {
  ordens_por_situacao: Record<string, number>
  ordens_atrasadas: number
}

export type FinancialReport = {
  valor_recebido: number | string
  saldo_pendente: number | string
}

export type PageResult<T> = {
  results: T[]
  count: number
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getCookie(name: string) {
  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

function errorMessage(payload: unknown) {
  if (typeof payload === 'string' && payload) return payload
  if (!payload || typeof payload !== 'object') return ''

  const data = payload as Record<string, unknown>
  if (typeof data.detail === 'string') return data.detail

  return Object.values(data)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
}

export async function login(credentials: Credentials): Promise<AuthenticatedUser> {
  const csrfResponse = await fetch('/admin/login/', { credentials: 'include' })
  if (!csrfResponse.ok) {
    throw new Error('Não foi possível iniciar a sessão segura. Confirme se o backend está ativo.')
  }

  const csrfToken = getCookie('csrftoken')
  const response = await fetch('/api/login/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify(credentials),
  })

  const contentType = response.headers.get('content-type') || ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text()

  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload) || 'Não foi possível entrar. Verifique suas credenciais.',
      response.status,
    )
  }

  return payload as AuthenticatedUser
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  const contentType = response.headers.get('content-type') || ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text()

  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload) || 'Não foi possível carregar os dados do painel.',
      response.status,
    )
  }

  return payload as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const csrfResponse = await fetch('/admin/login/', { credentials: 'include' })
  if (!csrfResponse.ok) {
    throw new ApiError('Não foi possível iniciar a sessão segura. Confirme se o backend está ativo.', csrfResponse.status)
  }

  const csrfToken = getCookie('csrftoken')
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
    body: JSON.stringify(body),
  })
  const contentType = response.headers.get('content-type') || ''
  const payload: unknown = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text()

  if (!response.ok) {
    throw new ApiError(errorMessage(payload) || 'Não foi possível concluir a operação.', response.status)
  }

  return payload as T
}

export async function logout() {
  const csrfResponse = await fetch('/admin/login/', { credentials: 'include' })
  if (!csrfResponse.ok) return

  const csrfToken = getCookie('csrftoken')
  await fetch('/api/logout/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    },
  })
}
