import { api } from '@/lib/api'
import type {
  AuthResponse,
  Bot,
  BotLogsResponse,
  CreateBotPayload,
  DashboardSnapshot,
  Instrument,
  InstrumentCatalogResponse,
  InstrumentSyncResult,
  MarketKline,
  MarketKlineInterval,
  ListTradesQuery,
  Trade,
  TradeHistoryResponse,
  UpdateBotPayload,
  User,
} from '@/types'

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', { email, password })
}

export async function registerRequest(
  email: string,
  password: string,
  name?: string,
): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', {
    email,
    password,
    ...(name ? { name } : {}),
  })
}

export async function fetchMe(token: string): Promise<User> {
  return api.get<User>('/users/me', token)
}

export async function fetchDashboard(token: string): Promise<DashboardSnapshot> {
  return api.get<DashboardSnapshot>('/dashboard', token)
}

export async function fetchBots(token: string): Promise<Bot[]> {
  return api.get<Bot[]>('/bots', token)
}

export async function fetchBot(token: string, id: string): Promise<Bot> {
  return api.get<Bot>(`/bots/${id}`, token)
}

export async function fetchInstruments(token: string): Promise<Instrument[]> {
  return api.get<Instrument[]>('/instruments', token)
}

export async function fetchAllInstruments(
  token: string,
  take = 10,
  skip = 0,
  search?: string,
): Promise<InstrumentCatalogResponse> {
  const queryParams = new URLSearchParams({
    take: String(take),
    skip: String(skip),
  })
  if (search?.trim()) {
    queryParams.set('search', search.trim())
  }
  return api.get<InstrumentCatalogResponse>(
    `/instruments/admin/all?${queryParams}`,
    token,
  )
}

export async function fetchInstrumentBySymbol(
  token: string,
  symbol: string,
): Promise<Instrument> {
  return api.get<Instrument>(`/instruments/${encodeURIComponent(symbol)}`, token)
}

export async function syncInstruments(token: string): Promise<InstrumentSyncResult> {
  return api.post<InstrumentSyncResult>('/instruments/admin/sync', {}, token)
}

export async function setInstrumentActivation(
  token: string,
  symbol: string,
  isActive: boolean,
): Promise<Instrument> {
  return api.patch<Instrument>(
    `/instruments/admin/${encodeURIComponent(symbol)}/activation`,
    { isActive },
    token,
  )
}

export async function createBot(
  token: string,
  payload: CreateBotPayload,
): Promise<Bot> {
  return api.post<Bot>('/bots', payload, token)
}

export async function updateBot(
  token: string,
  id: string,
  payload: UpdateBotPayload,
): Promise<Bot> {
  return api.put<Bot>(`/bots/${id}`, payload, token)
}

export async function deleteBot(token: string, id: string): Promise<Bot> {
  return api.delete<Bot>(`/bots/${id}`, token)
}

export async function startBot(token: string, id: string): Promise<Bot> {
  return api.post<Bot>(`/bots/${id}/start`, {}, token)
}

export async function stopBot(token: string, id: string): Promise<Bot> {
  return api.post<Bot>(`/bots/${id}/stop`, {}, token)
}

export async function fetchBotLogs(
  token: string,
  botId: string,
  take = 50,
  skip = 0,
): Promise<BotLogsResponse> {
  const queryParams = new URLSearchParams({
    take: String(take),
    skip: String(skip),
  })
  return api.get<BotLogsResponse>(`/bots/${botId}/logs?${queryParams}`, token)
}

export async function fetchTrades(
  token: string,
  query?: ListTradesQuery,
): Promise<TradeHistoryResponse> {
  const params = new URLSearchParams()
  if (query?.botId) params.set('botId', query.botId)
  if (query?.symbol) params.set('symbol', query.symbol)
  if (query?.status) params.set('status', query.status)
  if (query?.from) params.set('from', query.from)
  if (query?.to) params.set('to', query.to)
  if (query?.take != null) params.set('take', String(query.take))
  if (query?.skip != null) params.set('skip', String(query.skip))
  if (query?.sortBy) params.set('sortBy', query.sortBy)
  if (query?.sortDir) params.set('sortDir', query.sortDir)

  const queryString = params.size ? `?${params}` : ''
  return api.get<TradeHistoryResponse>(`/trades${queryString}`, token)
}

export async function fetchTrade(token: string, id: string): Promise<Trade> {
  return api.get<Trade>(`/trades/${id}`, token)
}

export async function fetchMarketKlines(
  token: string,
  symbol: string,
  interval: MarketKlineInterval,
  limit = 250,
): Promise<MarketKline[]> {
  const params = new URLSearchParams({
    symbol: symbol.trim(),
    interval,
    limit: String(limit),
  })
  return api.get<MarketKline[]>(`/market-data/klines?${params}`, token)
}
