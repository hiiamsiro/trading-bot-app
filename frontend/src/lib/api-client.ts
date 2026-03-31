import { api } from '@/lib/api'
import type {
  AdminMonitoringSnapshot,
  AuthResponse,
  BacktestResult,
  Bot,
  BotLogsResponse,
  BotTemplate,
  BuilderConfig,
  CompiledStrategyResult,
  CreateBotPayload,
  CreateBotFromBuilderPayload,
  CreateTemplatePayload,
  DashboardSnapshot,
  Instrument,
  InstrumentCatalogResponse,
  InstrumentSyncResult,
  ListNotificationsQuery,
  ListTradesQuery,
  MarketKline,
  MarketKlineInterval,
  MarketplaceResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadPayload,
  NotificationsResponse,
  Portfolio,
  PortfolioMetrics,
  RunBacktestPayload,
  TemplatesListResponse,
  Trade,
  TradeHistoryResponse,
  UpdateBotPayload,
  User,
  InAppNotification,
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

export type AdminMonitoringQuery = {
  recentErrorsTake?: number
  recentTradesTake?: number
  topTake?: number
  windowHours?: number
}

export async function fetchAdminMonitoringSnapshot(
  token: string,
  query?: AdminMonitoringQuery,
): Promise<AdminMonitoringSnapshot> {
  const params = new URLSearchParams()
  if (query?.recentErrorsTake != null) {
    params.set('recentErrorsTake', String(query.recentErrorsTake))
  }
  if (query?.recentTradesTake != null) {
    params.set('recentTradesTake', String(query.recentTradesTake))
  }
  if (query?.topTake != null) {
    params.set('topTake', String(query.topTake))
  }
  if (query?.windowHours != null) {
    params.set('windowHours', String(query.windowHours))
  }

  const queryString = params.size ? `?${params}` : ''
  return api.get<AdminMonitoringSnapshot>(`/admin/monitoring${queryString}`, token)
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

export type ListLogsQuery = {
  botId?: string
  level?: string
  category?: string
  search?: string
  take?: number
  skip?: number
}

export async function fetchLogs(
  token: string,
  query?: ListLogsQuery,
): Promise<BotLogsResponse> {
  const params = new URLSearchParams()
  if (query?.botId) params.set('botId', query.botId)
  if (query?.level) params.set('level', query.level)
  if (query?.category) params.set('category', query.category)
  if (query?.search) params.set('search', query.search)
  if (query?.take != null) params.set('take', String(query.take))
  if (query?.skip != null) params.set('skip', String(query.skip))

  const queryString = params.size ? `?${params}` : ''
  return api.get<BotLogsResponse>(`/logs${queryString}`, token)
}

export async function fetchNotifications(
  token: string,
  query?: ListNotificationsQuery,
): Promise<NotificationsResponse> {
  const params = new URLSearchParams()
  if (query?.isRead != null) params.set('isRead', String(query.isRead))
  if (query?.take != null) params.set('take', String(query.take))
  if (query?.skip != null) params.set('skip', String(query.skip))

  const queryString = params.size ? `?${params}` : ''
  return api.get<NotificationsResponse>(`/notifications${queryString}`, token)
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
  payload: MarkNotificationReadPayload = { isRead: true },
): Promise<InAppNotification> {
  return api.patch<InAppNotification>(
    `/notifications/${notificationId}/read`,
    payload,
    token,
  )
}

export async function markAllNotificationsRead(
  token: string,
): Promise<MarkAllNotificationsReadResponse> {
  return api.post<MarkAllNotificationsReadResponse>('/notifications/read-all', {}, token)
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

// ─── Backtest ─────────────────────────────────────────────────────────────────

export async function runBacktest(
  token: string,
  payload: RunBacktestPayload,
): Promise<{ id: string; status: string; result: BacktestResult }> {
  return api.post<{ id: string; status: string; result: BacktestResult }>('/backtest', payload, token)
}

export async function getBacktestCandles(
  token: string,
  backtestId: string,
): Promise<{ candles: MarketKline[] }> {
  return api.get<{ candles: MarketKline[] }>(`/backtest/${backtestId}/candles`, token)
}

export async function fetchBacktest(
  token: string,
  id: string,
): Promise<{ id: string; status: string; result: BacktestResult }> {
  return api.get<{ id: string; status: string; result: BacktestResult }>(`/backtest/${id}`, token)
}

export async function getBacktestReplay(
  token: string,
  backtestId: string,
): Promise<{ candles: MarketKline[]; trades: object[] }> {
  return api.get<{ candles: MarketKline[]; trades: object[] }>(`/backtest/${backtestId}/replay`, token)
}

export interface PreviewBacktestPayload {
  symbol: string
  interval: string
  strategy: string
  params?: Record<string, unknown>
}

export async function previewBacktest(
  token: string,
  payload: PreviewBacktestPayload,
): Promise<{ result: BacktestResult }> {
  return api.post<{ result: BacktestResult }>('/backtest/preview', payload, token)
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export async function fetchTemplates(token: string): Promise<TemplatesListResponse> {
  return api.get<TemplatesListResponse>('/templates', token)
}

export async function createTemplate(
  token: string,
  payload: CreateTemplatePayload,
): Promise<BotTemplate> {
  return api.post<BotTemplate>('/templates', payload, token)
}

export async function deleteTemplate(token: string, id: string): Promise<void> {
  return api.delete<void>(`/templates/${id}`, token)
}

// ─── Portfolios ─────────────────────────────────────────────────────────────────

export async function fetchPortfolios(token: string): Promise<Portfolio[]> {
  return api.get<Portfolio[]>('/portfolios', token)
}

export async function fetchPortfolio(token: string, id: string): Promise<Portfolio> {
  return api.get<Portfolio>(`/portfolios/${id}`, token)
}

export async function fetchPortfolioMetrics(token: string, id: string): Promise<PortfolioMetrics> {
  return api.get<PortfolioMetrics>(`/portfolios/${id}/metrics`, token)
}

export async function createPortfolio(
  token: string,
  payload: { name: string; botIds?: string[] },
): Promise<Portfolio> {
  return api.post<Portfolio>('/portfolios', payload, token)
}

export async function updatePortfolio(
  token: string,
  id: string,
  payload: { name?: string; botIds?: string[] },
): Promise<Portfolio> {
  return api.put<Portfolio>(`/portfolios/${id}`, payload, token)
}

export async function deletePortfolio(token: string, id: string): Promise<void> {
  return api.delete<void>(`/portfolios/${id}`, token)
}

// ─── Strategy Builder ─────────────────────────────────────────────────────────

export async function fetchBuilderDefault(token: string): Promise<BuilderConfig> {
  return api.get<BuilderConfig>('/strategy-builder/default', token)
}

export async function validateBuilderConfig(
  token: string,
  config: BuilderConfig,
): Promise<{ valid: true }> {
  return api.post<{ valid: true }>('/strategy-builder/validate', { config }, token)
}

export async function compileBuilderConfig(
  token: string,
  config: BuilderConfig,
): Promise<CompiledStrategyResult> {
  return api.post<CompiledStrategyResult>('/strategy-builder/compile', { config }, token)
}

export async function createBotFromBuilder(
  token: string,
  payload: CreateBotFromBuilderPayload,
): Promise<Bot> {
  return api.post<Bot>('/bots/from-builder', payload, token)
}

// ─── Marketplace ─────────────────────────────────────────────────────────────────

export async function fetchPublicBots(
  token: string,
  query?: { take?: number; skip?: number; search?: string; strategy?: string },
): Promise<MarketplaceResponse> {
  const params = new URLSearchParams()
  if (query?.take != null) params.set('take', String(query.take))
  if (query?.skip != null) params.set('skip', String(query.skip))
  if (query?.search?.trim()) params.set('search', query.search.trim())
  if (query?.strategy) params.set('strategy', query.strategy)
  const queryString = params.size ? `?${params}` : ''
  return api.get<MarketplaceResponse>(`/marketplace${queryString}`, token)
}

export async function publishBot(
  token: string,
  botId: string,
): Promise<{ shareSlug: string }> {
  return api.post<{ shareSlug: string }>(`/bots/${botId}/publish`, {}, token)
}

export async function unpublishBot(token: string, botId: string): Promise<void> {
  return api.post<void>(`/bots/${botId}/unpublish`, {}, token)
}

export async function cloneBot(
  token: string,
  slug: string,
  payload?: { name?: string; symbol?: string },
): Promise<Bot> {
  return api.post<Bot>(`/marketplace/clone/${slug}`, payload ?? {}, token)
}

// ─── Bot Health ─────────────────────────────────────────────────────────────────

export async function fetchBotHealthReport(token: string): Promise<import('@/types').BotHealthReport> {
  return api.get<import('@/types').BotHealthReport>('/health/bots', token)
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export async function fetchMySubscription(
  token: string,
): Promise<import('@/types').SubscriptionWithLimits> {
  return api.get<import('@/types').SubscriptionWithLimits>('/billing/me', token)
}

export async function fetchPlanLimits(
  token: string,
): Promise<import('@/types').PlanLimits> {
  return api.get<import('@/types').PlanLimits>('/billing/limits', token)
}

export async function createCheckoutSession(
  token: string,
  plan: 'PRO' | 'PREMIUM',
): Promise<{ url: string }> {
  return api.post<{ url: string }>('/billing/checkout', { plan }, token)
}

export async function createPortalSession(
  token: string,
): Promise<{ url: string }> {
  return api.post<{ url: string }>('/billing/portal', {}, token)
}

export async function updatePlan(
  token: string,
  plan: import('@/types').Plan,
): Promise<import('@/types').SubscriptionWithLimits> {
  return api.patch<import('@/types').SubscriptionWithLimits>('/billing/plan', { plan }, token)
}

// ─── Optimization ─────────────────────────────────────────────────────────────────

export interface OptimizationParamRange {
  param: string
  values: number[]
}

export interface StartOptimizationPayload {
  symbol: string
  interval: string
  strategy: string
  paramRanges: OptimizationParamRange[]
  fromDate: string
  toDate: string
  initialBalance?: number
  botId?: string
}

export interface OptimizationResult {
  params: Record<string, unknown>
  metrics: {
    totalTrades: number
    winningTrades: number
    losingTrades: number
    winRate: number | null
    totalPnl: number
    maxDrawdown: number
    initialBalance: number
    finalBalance: number
    averageWin: number | null
    averageLoss: number | null
  }
}

export interface OptimizationRecord {
  id: string
  symbol: string
  interval: string
  strategy: string
  paramRanges: OptimizationParamRange[]
  status: string
  progress: number
  totalCombinations: number
  completedCombinations: number
  bestByPnl: OptimizationResult | null
  bestByDrawdown: OptimizationResult | null
  bestByWinrate: OptimizationResult | null
  allResults: OptimizationResult[]
  error: string | null
  createdAt: string
}

export interface OptimizationListResponse {
  items: OptimizationRecord[]
  total: number
  take: number
  skip: number
}

export async function startOptimization(
  token: string,
  payload: StartOptimizationPayload,
): Promise<{ id: string; message: string }> {
  return api.post<{ id: string; message: string }>('/optimization', payload, token)
}

export async function fetchOptimization(
  token: string,
  id: string,
): Promise<OptimizationRecord> {
  return api.get<OptimizationRecord>(`/optimization/${id}`, token)
}

export async function fetchOptimizationList(
  token: string,
  take = 20,
  skip = 0,
): Promise<OptimizationListResponse> {
  return api.get<OptimizationListResponse>(`/optimization?take=${take}&skip=${skip}`, token)
}

// ─── Apply best config to bot ───────────────────────────────────────────────────

export async function applyBestConfigToBot(
  token: string,
  botId: string,
  strategy: string,
  params: Record<string, unknown>,
): Promise<import('@/types').Bot> {
  return api.patch<import('@/types').Bot>(`/bots/${botId}`, {
    strategyConfig: { strategy, params },
  }, token)
}

// ─── Walk-forward testing ───────────────────────────────────────────────────

export interface WalkforwardParamRange {
  param: string
  values: number[]
}

export interface StartWalkforwardPayload {
  symbol: string
  interval: string
  strategy: string
  paramRanges: WalkforwardParamRange[]
  fromDate: string
  toDate: string
  initialBalance?: number
  trainSplitPct?: number
}

export interface WalkforwardMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number | null
  totalPnl: number
  maxDrawdown: number
  initialBalance: number
  finalBalance: number
  averageWin: number | null
  averageLoss: number | null
}

export interface WalkforwardEquityPoint {
  at: string
  cumulativePnl: number
}

export interface WalkforwardRecord {
  id: string
  symbol: string
  interval: string
  strategy: string
  paramRanges: WalkforwardParamRange[]
  trainFromDate: string
  trainToDate: string
  testFromDate: string
  testToDate: string
  trainSplitPct: number
  status: string
  error: string | null
  bestTrainParams: Record<string, unknown> | null
  trainMetrics: WalkforwardMetrics | null
  testMetrics: WalkforwardMetrics | null
  trainEquityCurve: WalkforwardEquityPoint[]
  testEquityCurve: WalkforwardEquityPoint[]
  trainPnl: number | null
  testPnl: number | null
  trainDrawdown: number | null
  testDrawdown: number | null
  trainWinRate: number | null
  testWinRate: number | null
  createdAt: string
}

export interface WalkforwardListResponse {
  items: WalkforwardRecord[]
  total: number
  take: number
  skip: number
}

export async function startWalkforward(
  token: string,
  payload: StartWalkforwardPayload,
): Promise<{ id: string; message: string }> {
  return api.post<{ id: string; message: string }>('/walkforward', payload, token)
}

export async function fetchWalkforward(
  token: string,
  id: string,
): Promise<WalkforwardRecord> {
  return api.get<WalkforwardRecord>(`/walkforward/${id}`, token)
}

export async function fetchWalkforwardList(
  token: string,
): Promise<WalkforwardListResponse> {
  return api.get<WalkforwardListResponse>('/walkforward', token)
}

export interface LeaderboardItem {
  rank: number
  botId: string
  botName: string
  symbol: string
  strategy: string
  totalPnl: number
  winRate: number | null
  maxDrawdown: number
  totalTrades: number
  shareSlug: string | null
}

export async function getLeaderboard(opts?: {
  sortBy?: 'pnl' | 'winRate' | 'drawdown'
  limit?: number
  offset?: number
}): Promise<{ items: LeaderboardItem[]; total: number }> {
  const params = new URLSearchParams()
  if (opts?.sortBy) params.set('sortBy', opts.sortBy)
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  const qs = params.toString()
  return api.get<{ items: LeaderboardItem[]; total: number }>(`/leaderboard${qs ? `?${qs}` : ''}`)
}
