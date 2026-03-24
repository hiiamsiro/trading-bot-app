export interface User {
  id: string
  email: string
  name?: string
  createdAt: string
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
  params: Record<string, any>
}

export interface Bot {
  id: string
  name: string
  description?: string
  symbol: string
  status: BotStatus
  userId: string
  createdAt: string
  updatedAt: string
  strategyConfig?: StrategyConfig
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
  executedAt?: string
  createdAt: string
}
