import pandas as pd

from ai.number_check import Fact, check
from engine import data_clock


def test_number_check_rejects_unknown_numbers():
    facts = [Fact(id="drop", value=33.0, unit="%", source="yfinance", as_of="2022-06-30")]
    assert check("Down 33% so far.", facts) == []
    assert check("Down 41% so far.", facts) == ["41"]


def test_data_clock_never_returns_future(tmp_path, monkeypatch):
    idx = pd.date_range("2021-12-01", "2022-03-01", freq="D")
    pd.DataFrame({"QQQ": range(len(idx))}, index=idx).to_csv(tmp_path / "p.csv")
    monkeypatch.setattr(data_clock, "PRICES_CSV", tmp_path / "p.csv")
    monkeypatch.setattr(data_clock, "_PRICES", None)
    assert data_clock.get_prices(["QQQ"], "2022-01-03").index.max() <= pd.Timestamp("2022-01-03")
