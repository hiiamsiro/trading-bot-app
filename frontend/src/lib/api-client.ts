import { api } from '@/lib/api'
import type {
  AuthResponse,
  Bot,
  BotLogsResponse,
  CreateBotPayload,
  Instrument,
  Trade,
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

export async function fetchBots(token: string): Promise<Bot[]> {
  return api.get<Bot[]>('/bots', token)
}

export async function fetchBot(token: string, id: string): Promise<Bot> {
  return api.get<Bot>(`/bots/${id}`, token)
}

export async function fetchInstruments(token: string): Promise<Instrument[]> {
  return api.get<Instrument[]>('/instruments', token)
}

export async function fetchAllInstruments(token: string): Promise<Instrument[]> {
  return api.get<Instrument[]>('/instruments/admin/all', token)
}

export async function fetchInstrumentBySymbol(
  token: string,
  symbol: string,
): Promise<Instrument> {
  return api.get<Instrument>(`/instruments/${encodeURIComponent(symbol)}`, token)
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
  const q = new URLSearchParams({
    take: String(take),
    skip: String(skip),
  })
  return api.get<BotLogsResponse>(`/bots/${botId}/logs?${q}`, token)
}

export async function fetchTrades(
  token: string,
  botId?: string,
): Promise<Trade[]> {
  const q = botId ? `?botId=${encodeURIComponent(botId)}` : ''
  return api.get<Trade[]>(`/trades${q}`, token)
}

export async function fetchTrade(token: string, id: string): Promise<Trade> {
  return api.get<Trade>(`/trades/${id}`, token)
}
