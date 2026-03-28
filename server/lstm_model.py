import numpy as np
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from sklearn.preprocessing import MinMaxScaler

def train_lstm(prices):
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(prices.reshape(-1, 1))

    X, y = [], []
    for i in range(5, len(scaled)):
        X.append(scaled[i-5:i])
        y.append(scaled[i])

    X, y = np.array(X), np.array(y)

    model = Sequential([
        LSTM(50, input_shape=(X.shape[1], 1)),
        Dense(1)
    ])

    model.compile(optimizer='adam', loss='mse')
    model.fit(X, y, epochs=3, verbose=0)

    return model, scaler

def predict_next(model, scaler, prices):
    last = prices[-5:]
    scaled = scaler.transform(last.reshape(-1,1)).reshape(1,5,1)
    pred = model.predict(scaled, verbose=0)
    return scaler.inverse_transform(pred)[0][0]