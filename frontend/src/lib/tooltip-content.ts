// Optimization page tooltips
export const optimizationTooltips = {
  pageTitle:
    'Strategy Optimization tests hundreds of parameter combinations against historical data to find the most profitable configuration. Uses grid search to exhaustively evaluate every combination you define.',

  parameterRangesCard:
    'Define the range of values for each parameter. The system will test every possible combination (grid search) and rank results by your chosen metric.',

  instrument:
    'The trading pair (e.g. BTCUSDT) to run the optimization on. Must be available on your connected exchange.',

  timeframe:
    'The candlestick (OHLCV) timeframe used for the backtest. Shorter timeframes (1m, 5m) are noisier; longer ones (1h, 4h) are more stable but fewer data points.',

  strategy:
    'RSI: buy when oversold, sell when overbought. SMA Crossover: buy when short MA crosses above long MA, sell on reverse cross.',

  initialBalance:
    'Starting capital for the backtest simulation. All trades are sized proportionally to this balance.',

  fromDate:
    'Start date of the historical data window. More data = more reliable results but longer computation time.',

  toDate:
    'End date of the historical data window. Defaults to today. Data after this date is excluded from the backtest.',

  parameterRanges:
    'Enter comma-separated values for each parameter. Example: 10,14,20 tests three values for that parameter. Total combinations = product of all value counts.',

  runOptimization:
    'Starts a grid search that tests every combination of your defined parameters. Results appear progressively as combinations complete.',

  optimizationStatus:
    'PENDING: queued for processing. RUNNING: actively testing combinations. COMPLETED: all combinations tested. FAILED: an error occurred during backtesting.',

  progress:
    'Number of parameter combinations tested so far out of the total. Higher totals mean longer wait times.',

  bestByPnl:
    'Configuration with the highest total profit/loss across all tested combinations. Best for pure profit-maximization strategies.',

  bestByDrawdown:
    'Configuration with the smallest maximum drawdown — meaning the strategy stayed closest to its peak without large losses. Best for risk-averse strategies.',

  bestByWinrate:
    'Configuration with the highest percentage of winning trades (closed with positive PnL). Best for high-frequency or consistent small-gain strategies.',

  bestConfiguration:
    'The single best parameter set found for your chosen ranking metric. Review all metrics before applying to a bot.',

  totalPnl:
    'Total profit or loss across all trades in the backtest, including both winning and losing positions.',

  maxDrawdown:
    'The largest peak-to-trough decline during the backtest. Lower drawdown = less risk. A 20% drawdown means the account fell 20% from its high at worst.',

  winRate:
    'Percentage of closed trades that ended with positive PnL. A 60% win rate means 6 out of 10 trades made money.',

  totalTrades:
    'Total number of completed trades (both winners and losers) during the backtest period.',

  avgWinLoss:
    'Average profit of winning trades vs. average loss of losing trades. A healthy ratio is typically > 1.5:1 (wins are 1.5x larger than losses).',

  pnlColumn: 'Total profit/loss for this parameter set. Positive = profitable, negative = loss-making.',

  drawdownColumn: 'Maximum drawdown for this parameter set. Lower is better for risk-averse strategies.',

  winRateColumn: 'Win rate for this parameter set. Higher is generally better, but must be balanced against P&L.',

  tradesColumn: 'Number of trades executed by this parameter set. Very few trades may indicate an overly restrictive strategy.',

  allResults: 'Full ranked list of every tested parameter combination. Sort by different tabs (PnL, Drawdown, Win Rate) to explore trade-offs.',

  applyToBot:
    'Applies the selected best parameter configuration to a stopped bot. The bot will use these parameters for live trading. Only stopped bots are shown.',
}

// Walk-Forward page tooltips
export const walkforwardTooltips = {
  pageTitle:
    'Walk-Forward Testing splits your data into training (optimization) and testing (validation) sets. Find the best params on training data, then validate on unseen test data to detect overfitting.',

  configurationTitle:
    'Walk-forward testing trains on a portion of data and validates on the held-out portion to check if the strategy generalizes beyond the training period.',

  trainTestSplit:
    'Percentage of data used for training (finding best params) vs. testing (validation). 70/30 means 70% of data trains the strategy, 30% tests it without any parameter optimization on that portion.',

  defaultSplitDescription:
    'The default 70/30 split is a common heuristic. 80/20 gives more training data but less validation confidence; 60/40 gives more test data for stricter validation.',

  walkforwardStatus:
    'PENDING: queued. RUNNING: training + testing in progress. COMPLETED: train/test finished. FAILED: an error occurred.',

  splitInfo:
    'Train % is used to find the best parameters; test % is held out and only used for final validation.',

  trainingData:
    'Subset of historical data used to find the best parameter combination. The optimizer exhaustively tests all defined combinations on this data.',

  testingData:
    'Unseen data held out during optimization. The best parameters from training are applied to this data without any fitting — this reveals real-world performance.',

  trainVsTestComparison:
    'Side-by-side comparison of metrics on training vs. testing data. Large gaps indicate overfitting — the strategy memorized training data and fails on new data.',

  pnlComparison:
    'Total PnL on training data vs. total PnL on testing data. Ideally these are similar; a large drop on test data signals overfitting.',

  degradation:
    'Performance drop from training to testing data, expressed as a percentage. Lower degradation = more robust strategy. Positive degradation means the strategy actually performed better on test data — a great sign. Above 20% degradation should be reviewed carefully.',

  bestParams:
    'The best parameter combination found during training. These are applied verbatim to test data without any re-optimization.',

  trainingEquityCurve:
    'Equity curve showing cumulative P&L over the training period using the optimized parameters. Should show consistent growth with minimal drawdown.',

  testingEquityCurve:
    'Equity curve on held-out test data using the best parameters from training. A curve that continues to grow (not just on training data) indicates good generalization.',

  pnlMetric: 'Total profit or loss on this data segment.',

  drawdownMetric:
    'Largest peak-to-trough decline on this segment. Lower is better.',

  winRateMetric:
    'Percentage of winning trades on this segment.',

  tradesMetric:
    'Number of completed trades on this segment.',

  wlMetric: 'Number of winning trades vs. losing trades.',

  finalBalanceMetric:
    'Ending account balance after all trades on this segment.',

  applyBestConfig:
    'Applies the best training configuration to a stopped bot. The bot will use these parameters for live trading without any re-optimization.',
}

// Backtest page tooltips
export const backtestTooltips = {
  pageTitle:
    'Backtesting simulates a single strategy configuration against historical market data. Unlike Optimization, there is no parameter search — you define the exact values and see how the strategy would have performed historically.',

  configurationTitle:
    'Configure the strategy parameters, position sizing, and risk rules for the backtest simulation.',

  instrument:
    'The trading pair (e.g. BTCUSDT) to simulate trades on. Must be available on your connected exchange.',

  timeframe:
    'The candlestick (OHLCV) timeframe. Shorter timeframes (1m, 5m) are noisier; longer ones (1h, 4h) are more stable.',

  trendTimeframe:
    'An optional longer timeframe used to determine overall trend direction. Trades are only taken in the direction of the trend when enabled. Leave as None for single-timeframe trading.',

  strategy:
    'SMA Crossover: buy when short MA crosses above long MA. RSI: buy when oversold, sell when overbought.',

  initialBalance:
    'Starting capital for the simulation. All trades are sized proportionally to this balance.',

  fromDate: 'Start date of the simulation window. More data means longer run time.',

  toDate: 'End date. Defaults to today. Data after this date is excluded.',

  shortPeriod:
    'Number of candles for the fast (short) moving average. Smaller = more responsive, noisier signals. SMA Crossover only.',

  longPeriod:
    'Number of candles for the slow (long) moving average. Must be greater than short period. SMA Crossover only.',

  rsiPeriod:
    'Number of candles used to calculate the RSI value. Common values: 7 (more sensitive) or 14 (standard). RSI only.',

  oversold:
    'RSI threshold below which a buy signal is generated. Standard values: 20–35. Lower = rarer, stronger signals. RSI only.',

  overbought:
    'RSI threshold above which a sell signal is generated. Standard values: 65–80. Higher = rarer, stronger signals. RSI only.',

  quantity:
    'Fixed amount of the base asset bought/sold per trade (e.g. 0.01 BTC). This is the base quantity before position sizing mode.',

  positionSizeMode:
    'Fixed: trades the same quantity every time. % of Balance: trades a fraction of current balance. Risk-based: sizes position so that a stop loss hits a fixed % loss.',

  riskPercent:
    'Percentage of account balance risked per trade. A 1% risk on a $10,000 account = $100 max loss per trade. Used with Stop Loss % to calculate position size.',

  stopLoss:
    'Exit price offset from entry to cut losses automatically. Expressed as % of entry price. E.g. 2% stop on a $50,000 entry = $49,000 exit.',

  takeProfit:
    'Exit price offset from entry to lock in gains automatically. Expressed as % of entry price. E.g. 4% TP on a $50,000 entry = $52,000 exit.',

  maxDailyLoss:
    'Trading halts for the rest of the day if daily loss reaches this threshold. Protects against rapid drawdowns in volatile conditions.',

  trailingStop:
    'A stop loss that trails the price as it moves in your favor, locking in profits while giving the trade room to breathe. Expressed as % offset from the highest price since entry.',

  partialTp:
    'Closes a portion of the position when Take Profit is hit. E.g. 50% = half the position closes at TP, the rest stays open. Useful for locking in gains while leaving room for more.',

  runBacktest:
    'Runs the simulation using your configured parameters and date range. Results appear below when complete.',

  netPnl:
    'Net profit/loss after subtracting all fees and slippage. This is the most realistic P&L figure.',

  grossPnl:
    'Profit/loss before fees. Useful to see raw strategy performance separate from market costs.',

  feesPaid:
    'Total maker/taker fees and estimated slippage paid across all trades. Larger positions and higher frequency strategies pay more in fees.',

  winRate:
    'Percentage of closed trades that ended with positive P&L. A 60% win rate means 6 out of 10 trades were profitable.',

  maxDrawdown:
    'The largest peak-to-trough decline during the simulation. A 20% max drawdown means the account fell 20% from its highest point at worst.',

  equityCurve:
    'Cumulative P&L over time. A rising curve means the strategy was profitable; flat or falling means losses. Look for smooth upward slope with minimal drawdowns.',

  candlestickChart:
    'Price chart with your trade entry/exit markers overlaid. Green triangles = buys, red triangles = sells.',

  tradeLog:
    'Detailed record of every completed trade: entry/exit prices, timing, fees, and P&L. Review losing trades to identify edge cases.',

  sessionReplay:
    'Step through the backtest trade-by-trade on the candlestick chart. Useful for understanding why the strategy made specific decisions.',
}
