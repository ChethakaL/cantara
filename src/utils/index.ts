export function createPageUrl(pageName: string): string {
  const map: Record<string, string> = {
    Landing: '/',
    AdminDashboard: '/admin',
    ClientDashboard: '/dashboard',
    AdminLogin: '/login/admin',
    ClientLogin: '/login/client',
  }
  return map[pageName] ?? '/'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str
}
