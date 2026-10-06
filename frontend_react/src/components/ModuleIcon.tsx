import type { ReactNode } from 'react'

export type ModuleIconName = 'clients' | 'equipment' | 'budgets' | 'finance' | 'reports' | 'users'

const iconShapes: Record<ModuleIconName, ReactNode> = {
  clients: <><circle cx="9" cy="8" r="3.1" /><path d="M3.5 19c.7-3.1 2.6-4.8 5.5-4.8s4.8 1.7 5.5 4.8" /><path d="M16 5.4a3.1 3.1 0 0 1 0 5.9M17 14.6c1.9.5 3.1 2 3.6 4.4" /></>,
  equipment: <><rect x="4" y="3.5" width="16" height="17" rx="2.2" /><path d="M8 7h8M8 11h5" /><circle cx="12" cy="16" r="1.5" /></>,
  budgets: <><path d="M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M15 3.8V8h4M8.5 12h7M8.5 15.5h7M8.5 19h4" /></>,
  finance: <><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V7a.5.5 0 0 1 .5-.5Z" /><path d="M3.5 8V6a2 2 0 0 1 2-2H17" /><path d="M20 11h-5a2 2 0 0 0 0 4h5" /><circle cx="15" cy="13" r=".4" /></>,
  reports: <><path d="M4 20V11M10 20V5M16 20v-7M22 20H2" /><path d="m3.5 8 5-4 5 4 6-5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.7-3.1 2.6-4.8 5.5-4.8 2.3 0 4 1.1 4.9 3" /><path d="m17.5 11 .6 1.1 1.3.2-.9.9.2 1.3-1.2-.6-1.1.6.2-1.3-.9-.9 1.3-.2.5-1.1Z" /></>,
}

function ModuleIcon({ name }: { name: ModuleIconName }) {
  return <span className="nav-glyph"><svg className="module-icon" viewBox="0 0 24 24" aria-hidden="true">{iconShapes[name]}</svg></span>
}

export default ModuleIcon
