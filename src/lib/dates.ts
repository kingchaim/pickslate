export function getTodayEST(): string {
  const now = new Date()
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return est.toISOString().split('T')[0]
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function isGameLocked(commenceTime: string): boolean {
  return new Date() >= new Date(commenceTime)
}

export function isBeforeAllGames(games: { commence_time: string }[]): boolean {
  if (games.length === 0) return false
  const earliest = games.reduce((min, g) =>
    new Date(g.commence_time) < new Date(min.commence_time) ? g : min
  )
  return new Date() < new Date(earliest.commence_time)
}

export function timeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'LOCKED'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) return `${Math.floor(hours / 24)}d`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}
