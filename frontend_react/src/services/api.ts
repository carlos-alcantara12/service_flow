type Credentials = {
  login: string
  password: string
}

type AuthenticatedUser = {
  id: number
  nome: string
  login: string
  email?: string
  perfil: string
  perfil_display?: string
  ativo: boolean
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
    throw new Error(
      errorMessage(payload) || 'Não foi possível entrar. Verifique suas credenciais.',
    )
  }

  return payload as AuthenticatedUser
}
