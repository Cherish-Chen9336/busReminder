// Define Stop interface locally since it's not exported from favorites
interface Stop {
  id: string
  name: string
  code: string
}

export async function searchStops(q: string): Promise<Stop[]> {
  if (q.trim().length < 2) return []
  const base: Stop[] = [
    { id: 'S1', name: 'Al Jafiliya Bus Station', code: 'AJS' },
    { id: 'S2', name: 'Ibn Battuta Metro Bus Stop', code: 'IBM' },
    { id: 'S3', name: 'Expo Metro Bus Stop', code: 'EXPO' },
  ]
  return base.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.code.toLowerCase().includes(q.toLowerCase()))
}

export interface Departure { route: string; headsign: string; etaMin: number; scheduled: string; realtime?: boolean }

export async function getMockDepartures(_stopId: string): Promise<Departure[]> {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const t = (m: number) => `${pad(now.getHours())}:${pad((now.getMinutes()+m)%60)}`
  return [
    { route: 'F55', headsign: 'Ibn Battuta', etaMin: 7,  scheduled: t(7),  realtime: true },
    { route: 'F55', headsign: 'Expo Metro',   etaMin: 18, scheduled: t(18) },
    { route: 'X28', headsign: 'Gold Souq',    etaMin: 31, scheduled: t(31) },
  ]
}
