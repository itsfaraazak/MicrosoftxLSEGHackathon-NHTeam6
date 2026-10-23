"""Small pure metric functions. Their SOURCE is shown to users, so keep them short and readable.

`values` is a pandas Series of portfolio value indexed by date; `returns` is its daily % change.
"""
import pandas as pd


def portfolio_value(prices, weights):
    """Value of 1 dollar kept at fixed weights, rebalanced daily, from the first day all funds exist."""
    prices = prices[list(weights)].dropna()
    returns = prices.pct_change().fillna(0.0)
    return (1 + returns @ pd.Series(weights)).cumprod()


def cagr(values):
    """Compound yearly growth rate."""
    years = (values.index[-1] - values.index[0]).days / 365.25
    return float((values.iloc[-1] / values.iloc[0]) ** (1 / years) - 1)


def volatility(returns):
    """Yearly size of the ups and downs (std of daily returns x sqrt(252))."""
    return float(returns.std() * 252 ** 0.5)


def max_drawdown(values):
    """Worst fall from a previous peak (a negative number)."""
    peak = values.cummax()
    return float((values / peak - 1).min())


def sharpe(returns, rf=0.0):
    """Return per unit of risk (annualised, risk-free rate rf per year)."""
    return float((returns.mean() - rf / 252) / returns.std() * 252 ** 0.5)


def window_return(values, start, end):
    """Total change of the portfolio between two dates (a stress window)."""
    w = values.loc[start:end]
    return float(w.iloc[-1] / w.iloc[0] - 1)


def overlap(weights, sector_weights):
    """Share of the portfolio in the sector your job already depends on.

    sector_weights maps ticker -> fraction of that fund in the sector."""
    return float(sum(w * sector_weights.get(t, 0.0) for t, w in weights.items()))
