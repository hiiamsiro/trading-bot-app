# Phase 42: Strategy Optimization System

## Goal
Implement a full strategy optimization system that allows users to automatically find the best parameter configurations.

## Requirements
- Users can define parameter ranges:
  - moving average periods
  - RSI thresholds
  - other numeric parameters
- System generates combinations (grid search)
- Run backtest for each combination
- Rank results by:
  - highest PnL
  - lowest drawdown
  - highest win rate

## Backend
- Reuse existing backtesting engine
- Run optimization as async job (queue or background task)
- Store results in DB
- Add APIs:
  - start optimization
  - get results

## Frontend
- Form for parameter ranges
- Button: "Run Optimization"
- Show results table:
  - parameters
  - pnl
  - drawdown
  - win rate
- Button: "Apply config to bot"

## Constraints
- Do not duplicate backtest logic
- Keep system scalable
- Do not block main thread

## Definition of Done
- users can run optimization and apply best config
