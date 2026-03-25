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
  createdAt: string
  updatedAt: string
  strategyConfig?: StrategyConfig | null
  executionSession?: ExecutionSession | null
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
  level: string
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
  createdAt: string
  exitPrice?: number | null
  realizedPnl?: number | null
  closedAt?: string | null
  closeReason?: string | null
  bot?: {
    id: string
    name: string
    symbol: string
  }
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
