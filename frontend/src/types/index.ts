export interface User {
  id: string
  email: string
  name?: string | null
  createdAt?: string
}

export interface AuthResponse {
  user: User
  token: string
}

export enum BotStatus {
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export interface StrategyConfig {
  id: string
  strategy: string
  params: Record<string, unknown>
  builderConfig?: Record<string, unknown> | null
}

export interface ExecutionSession {
  id: string
  botId: string
  startedAt: string
  endedAt: string | null
  totalTrades: number
  profitLoss: number
  initialBalance: number
  currentBalance: number
}

export interface Bot {
  id: string
  name: string
  description?: string | null
  symbol: string
  status: BotStatus
  userId: string
  isPublic?: boolean
  shareSlug?: string | null
  createdAt: string
  updatedAt: string
  strategyConfig?: StrategyConfig | null
  executionSession?: ExecutionSession | null
}

// ─── Marketplace ─────────────────────────────────────────────────────────────────

export interface PublicBot {
  shareSlug: string
  name: string
  description: string | null
  symbol: string
  strategy: string
  userName: string | null
  createdAt: string
}

export interface MarketplaceResponse {
  items: PublicBot[]
  total: number
  take: number
  skip: number
}

export interface CloneBotPayload {
  name?: string
  symbol?: string
}

export enum InstrumentAssetClass {
  CRYPTO = 'CRYPTO',
  COMMODITY = 'COMMODITY',
}

export enum InstrumentMarketType {
  SPOT = 'SPOT',
  CFD = 'CFD',
}

export enum InstrumentStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  DISABLED = 'DISABLED',
}

export interface Instrument {
  id: string
  symbol: string
  displayName: string
  assetClass: InstrumentAssetClass
  marketType: InstrumentMarketType
  baseAsset?: string | null
  quoteCurrency: string
  exchange: string
  dataSource: string
  sourceSymbol?: string | null
  supportedIntervals: string[]
  pricePrecision: number
  quantityPrecision: number
  status: InstrumentStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface InstrumentSyncResult {
  provider: string
  totalFetched: number
  created: number
  updated: number
}

export interface InstrumentCatalogResponse {
  items: Instrument[]
  total: number
  take: number
  skip: number
}

export interface BotLog {
  id: string
  botId: string
  botName?: string
  level: string
  category: string
  message: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface BotLogsResponse {
  items: BotLog[]
  total: number
  take: number
  skip: number
}

export type InAppNotificationType =
  | 'BOT_STARTED'
  | 'BOT_STOPPED'
  | 'BOT_ERROR'
  | 'TRADE_OPENED'
  | 'TRADE_CLOSED'
  | 'STOP_LOSS_HIT'
  | 'TAKE_PROFIT_HIT'

export interface InAppNotification {
  id: string
  userId: string
  botId?: string | null
  tradeId?: string | null
  type: InAppNotificationType
  title: string
  message: string
  metadata?: Record<string, unknown> | null
  isRead: boolean
  readAt?: string | null
  createdAt: string
}

export interface NotificationsResponse {
  items: InAppNotification[]
  total: number
  unreadCount: number
  take: number
  skip: number
}

export interface MarkAllNotificationsReadResponse {
  updatedCount: number
}

export interface MarkNotificationReadPayload {
  isRead?: boolean
}

export interface ListNotificationsQuery {
  isRead?: boolean
  take?: number
  skip?: number
}

export interface DashboardEquityPoint {
  at: string
  cumulativePnl: number
}

export interface DashboardMetrics {
  totalBots: number
  runningBots: number
  stoppedBots: number
  errorBots: number
  totalTrades: number
  closedTradesWithPnl: number
  winningTrades: number
  losingTrades: number
  winRate: number | null
  totalPnl: number
  dailyPnl: number
  averageWin: number | null
  averageLoss: number | null
  maxDrawdown: number
}

export interface DashboardActivityRow {
  id: string
  botId: string
  level: string
  message: string
  createdAt: string
  botName: string
}

export interface DashboardSnapshot {
  botSymbols: string[]
  metrics: DashboardMetrics
  equityCurve: DashboardEquityPoint[]
  recentTrades: Trade[]
  recentActivities: DashboardActivityRow[]
  recentErrors: DashboardActivityRow[]
}

export interface AdminRecentError {
  id: string
  botId: string
  botName: string
  botSymbol: string
  botStatus: BotStatus
  userId: string
  userEmail: string
  level: string
  category: string
  message: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface AdminRecentTrade {
  id: string
  botId: string
  botName: string
  botSymbol: string
  botStatus: BotStatus
  userId: string
  userEmail: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  status: TradeStatus
  executedAt: string | null
  openReason?: string | null
  exitPrice?: number | null
  realizedPnl?: number | null
  closedAt: string | null
  closeReason?: string | null
  createdAt: string
}

export interface AdminTopActiveBot {
  botId: string
  botName: string
  symbol: string
  status: BotStatus
  userId: string
  userEmail: string
  tradeCount: number
}

export interface AdminTopActiveUser {
  userId: string
  email: string
  tradeCount: number
  activeBotCount: number
}

export interface AdminMonitoringSnapshot {
  totals: { users: number; bots: number }
  botStatusCounts: Record<BotStatus, number>
  windowHours: number
  recentErrors: AdminRecentError[]
  recentTrades: AdminRecentTrade[]
  topActiveBots: AdminTopActiveBot[]
  topActiveUsers: AdminTopActiveUser[]
}

export enum TradeSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  CLOSED = 'CLOSED',
}

export enum TradeSortBy {
  createdAt = 'createdAt',
  executedAt = 'executedAt',
  closedAt = 'closedAt',
  realizedPnl = 'realizedPnl',
  symbol = 'symbol',
  status = 'status',
  price = 'price',
}

export type SortDir = 'asc' | 'desc'

export interface TradeExplanation {
  strategy?: string
  instrument?: string
  interval?: string
  shortPeriod?: number
  longPeriod?: number
  prevShort?: number
  prevLong?: number
  currShort?: number
  currLong?: number
  period?: number
  oversold?: number
  overbought?: number
  prevRsi?: number
  currRsi?: number
  trigger?: string
  maxDailyLoss?: number
  checkedPrice?: number
  stopLoss?: number | null
  takeProfit?: number | null
  [key: string]: unknown
}

export interface Trade {
  id: string
  botId: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  status: TradeStatus
  executedAt?: string | null
  openReason?: string | null
  openExplanation?: TradeExplanation | null
  createdAt: string
  exitPrice?: number | null
  realizedPnl?: number | null
  closedAt?: string | null
  closeReason?: string | null
  closeExplanation?: TradeExplanation | null
  bot?: {
    id: string
    name: string
    symbol: string
  }
}

export interface TradeHistoryResponse {
  items: Trade[]
  total: number
  take: number
  skip: number
}

export interface ListTradesQuery {
  botId?: string
  symbol?: string
  status?: TradeStatus
  from?: string
  to?: string
  take?: number
  skip?: number
  sortBy?: TradeSortBy
  sortDir?: SortDir
}

export interface CreateBotPayload {
  name: string
  description?: string
  symbol: string
  strategyConfig?: {
    strategy: string
    params: Record<string, unknown>
  }
}

export interface UpdateBotPayload {
  name?: string
  description?: string
  symbol?: string
  status?: BotStatus
}

// ─── Templates ─────────────────────────────────────────────────────────────────

export interface BotTemplate {
  id: string
  userId: string | null
  name: string
  description: string | null
  strategy: string
  params: Record<string, unknown>
  isDefault: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface TemplatesListResponse {
  userTemplates: BotTemplate[]
  defaults: BotTemplate[]
}

export interface CreateTemplatePayload {
  name: string
  description?: string
  strategy: string
  params: Record<string, unknown>
}

export type MarketKlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export const MARKET_KLINE_INTERVALS: MarketKlineInterval[] = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
  '1d',
]

export interface MarketKline {
  openTime: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  closeTime: number
}

// ─── Backtest ─────────────────────────────────────────────────────────────────

export interface BacktestMetrics {
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

export interface BacktestTrade {
  id: number
  entryTime: number
  entryPrice: number
  quantity: number
  side: string
  exitTime: number | null
  exitPrice: number | null
  pnl: number | null
  closeReason: string | null
}

export interface BacktestEquityPoint {
  at: string
  cumulativePnl: number
}

export interface BacktestResult {
  metrics: BacktestMetrics
  trades: BacktestTrade[]
  equityCurve: BacktestEquityPoint[]
}

export interface RunBacktestPayload {
  symbol: string
  interval: string
  strategy: string
  params?: Record<string, unknown>
  fromDate: string
  toDate: string
  initialBalance?: number
}

export interface RunBacktestResponse {
  id: string
  status: string
  result: BacktestResult
}

// ─── Portfolios ─────────────────────────────────────────────────────────────────

export interface Portfolio {
  id: string
  name: string
  userId: string
  createdAt: string
  updatedAt: string
  bots: Bot[]
}

export interface PortfolioMetrics {
  totalPnl: number
  drawdown: number
  closedTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  totalInitialBalance: number
  totalCurrentBalance: number
  totalBots: number
  runningBots: number
}

// ─── Strategy Builder ─────────────────────────────────────────────────────────

export type LogicalOperator = 'AND' | 'OR'

export type ComparisonOperator =
  | 'CROSSES_ABOVE'
  | 'CROSSES_BELOW'
  | 'ABOVE'
  | 'BELOW'

export type IndicatorType = 'RSI' | 'MA'

export interface IndicatorParams {
  period?: number
  oversold?: number
  overbought?: number
  maType?: 'SMA' | 'EMA'
  shortPeriod?: number
  longPeriod?: number
}

export interface Condition {
  id: string
  indicator: IndicatorType
  params: IndicatorParams
  comparison: ComparisonOperator
  value: number
}

export interface BuilderEntryCondition {
  type: 'CONDITION'
  condition: Condition
}

export interface BuilderGroupCondition {
  type: 'GROUP'
  operator: LogicalOperator
  conditions: (BuilderEntryCondition | BuilderGroupCondition)[]
}

export type BuilderCondition = BuilderEntryCondition | BuilderGroupCondition

export interface BuilderConfig {
  version: 1
  conditions: BuilderCondition[]
  entryOperator: LogicalOperator
  risk: {
    stopLossPercent?: number
    takeProfitPercent?: number
    maxDailyLoss?: number
    quantity: number
  }
}

export interface CompiledStrategyResult {
  strategy: 'rsi' | 'sma_crossover'
  params: Record<string, unknown>
}

export interface CreateBotFromBuilderPayload {
  name: string
  description?: string
  symbol: string
  initialBalance: number
  builderConfig: BuilderConfig
}
