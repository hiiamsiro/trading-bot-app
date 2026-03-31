# Phase 43: Walk-Forward Testing

## Goal
Implement walk-forward testing to validate strategies and avoid overfitting.

## Requirements
- Split data:
  - 70% training
  - 30% testing
- Optimize strategy on training data
- Evaluate best config on testing data

## Backend
- Reuse optimization + backtest modules
- Return:
  - train metrics
  - test metrics

## Frontend
- Show:
  - train vs test PnL
  - drawdown comparison
- Show 2 equity curves

## Constraints
- No duplicate logic
- Keep it simple

## Definition of Done
- users can see difference between training and testing performance
