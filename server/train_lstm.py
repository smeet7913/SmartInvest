import numpy as np
import yfinance as yf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler
import joblib

symbols = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS",
    "ICICIBANK.NS", "SBIN.NS", "LT.NS", "ITC.NS",
    "HINDUNILVR.NS", "BAJFINANCE.NS"
]

all_prices = []

print("Downloading stock data...")

for s in symbols:
    try:
        data = yf.download(s + ".NS", period="1mo", progress=False)

        if 'Close' in data and len(data['Close']) > 10:
            prices = data['Close'].values[-10:]
        else:
            raise ValueError("No valid data")

    except Exception:
        prices = np.array([data['price']] * 10)

# Normalize
scaler = MinMaxScaler()
scaled = scaler.fit_transform(prices)

X, y = [], []

for i in range(5, len(scaled)):
    X.append(scaled[i-5:i])
    y.append(scaled[i])

X, y = np.array(X), np.array(y)

# Model
model = Sequential([
    LSTM(64, input_shape=(X.shape[1], 1)),
    Dense(1)
])

model.compile(optimizer='adam', loss='mse')

print("Training model...")
model.fit(X, y, epochs=10, verbose=1)

# Save
model.save("lstm_model.h5")
joblib.dump(scaler, "scaler.save")

print("Model trained on multiple stocks ✅")