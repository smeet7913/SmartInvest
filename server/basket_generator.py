import csv
import os
import json
import sys
from typing import List, Dict, Union
import yfinance as yf
import numpy as np
from tensorflow.keras.models import load_model
import joblib

# Load model
model = load_model("lstm_model.h5", compile=False)
scaler = joblib.load("scaler.save")

sys.stdout.reconfigure(encoding='utf-8')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

price_cache = {}

def predict_growth(prices):
    try:
        prices = np.array(prices).reshape(-1, 1)

        if len(prices) < 5:
            return 0

        scaled = scaler.transform(prices)
        last = scaled[-5:].reshape(1, 5, 1)

        pred = model.predict(last, verbose=0)
        predicted_price = scaler.inverse_transform(pred)[0][0]

        current_price = prices[-1][0]

        return (predicted_price - current_price) / current_price

    except:
        return 0


# CSV LOADER
def load_stocks_from_csv(filepath: str) -> List[Dict[str, Union[str, float]]]:
    if not os.path.exists(filepath):
        return []

    stocks = []

    try:
        with open(filepath, mode='r') as file:
            reader = csv.DictReader(file)

            for row in reader:
                try:
                    processed_row = {
                        'symbol': row.get('Stock Symbol', '').strip(),
                        'name': row.get('Full Name', '').strip(),
                        'price': float(row.get('Current Price', 0)),
                        'rank': float(row.get('Rank', 0)),
                        'theme': os.path.splitext(os.path.basename(filepath))[0],
                        '52_week_low': float(row.get('52-Week Low', 0)),
                        '52_week_high': float(row.get('52-Week High', 0)),
                        'current_price': float(row.get('Current Price', 0))
                    }

                    symbol = processed_row['symbol']

                    # PRICE HISTORY WITH CACHE
                    try:
                        if symbol in price_cache:
                            prices = price_cache[symbol]
                        else:
                            data = yf.download(symbol + ".NS", period="1mo", progress=False)

                            if 'Close' in data and len(data['Close']) > 10:
                                prices = data['Close'].values[-10:]
                            else:
                                prices = np.array([processed_row['price']] * 10)

                            price_cache[symbol] = prices

                    except:
                        prices = np.array([processed_row['price']] * 10)

                    processed_row['price_history'] = [
                        float(p.item()) if hasattr(p, "item") else float(p)
                        for p in prices
                    ]

                    stocks.append(processed_row)

                except:
                    continue

        return stocks

    except:
        return []


# PURE BASKET
def generate_pure_basket(investment: float, stocks: List[dict], theme: str, risk: str) -> dict:

    basket = {
        'theme': theme,
        'type': 'pure',
        'stocks': [],
        'investment': investment,
        'remaining': investment,
        'count': 0,
        'risk': risk
    }

    lstm_cache = {}

    # 🔹 scoring
    for stock in stocks:
        base_score = 1 / (stock['rank'] + 1)
        symbol = stock['symbol']

        if symbol not in lstm_cache:
            lstm_cache[symbol] = predict_growth(stock.get('price_history', []))

        growth = lstm_cache[symbol]

        if risk == "low":
            stock['score'] = 0.8 * base_score + 0.2 * growth
        elif risk == "medium":
            stock['score'] = 0.6 * base_score + 0.4 * growth
        else:
            stock['score'] = 0.4 * base_score + 0.6 * growth

    # 🔹 sort
    sorted_stocks = sorted(stocks, key=lambda x: x['score'], reverse=True)

    # 🔹 pick top unique 10
    selected = []
    symbols = set()

    for stock in sorted_stocks:
        if len(selected) >= 10:
            break
        if stock['symbol'] not in symbols:
            selected.append(stock)
            symbols.add(stock['symbol'])

    # 🔹 allocate equally
    if len(selected) == 0:
        return basket

    allocation = investment / len(selected)

    for stock in selected:
        stock_copy = stock.copy()
        stock_copy['allocated_amount'] = allocation

        basket['stocks'].append(stock_copy)
        basket['count'] += 1

    basket['remaining'] = 0
    basket['invested'] = investment

    return basket


# HYBRID BASKET (UNCHANGED BUT SAFE)
def generate_hybrid_basket(investment: float, theme_files: List[str], risk: str) -> dict:

    basket = {
        'theme': "Hybrid",
        'type': 'hybrid',
        'stocks': [],
        'investment': investment,
        'remaining': investment,
        'count': 0,
        'risk': risk
    }

    all_stocks = []

    for file in theme_files:
        stocks = load_stocks_from_csv(file)
        all_stocks.extend(stocks)

    if len(all_stocks) == 0:
        return basket

    return generate_pure_basket(investment, all_stocks, "Hybrid", risk)


# EXPORT
def export_baskets_to_json(baskets: List[dict], filename: str = 'baskets.json'):
    with open(filename, 'w') as f:
        json.dump(baskets, f, indent=2)


# MAIN
def main(income: float, risk: str, theme_files: List[str]):

    risk_multiplier = {'low': 0.1, 'medium': 0.2, 'high': 0.3}.get(risk, 0.2)
    basket_investment = income * risk_multiplier

    baskets = []

    for file in theme_files:
        stocks = load_stocks_from_csv(file)
        if stocks:
            baskets.append(generate_pure_basket(basket_investment, stocks, file, risk))

    baskets.append(generate_hybrid_basket(basket_investment, theme_files, risk))

    export_baskets_to_json(baskets)

    print(json.dumps(baskets))
    return baskets


if __name__ == "__main__":
    if len(sys.argv) == 3:
        INCOME = float(sys.argv[1])
        RISK = sys.argv[2].lower()

        THEME_FILES = [
            "Largecap.csv", "Midcap.csv", "Smallcap.csv",
            "Realty.csv", "Healthcare.csv", "Auto.csv",
            "Consumer durables.csv", "IT.csv",
            "Consumer Discretionary.csv"
        ]

        main(INCOME, RISK, THEME_FILES)
    else:
        print("Usage: python basket_generator.py <income> <risk>")