import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Chart, registerables } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import PropTypes from "prop-types";

Chart.register(...registerables, ChartDataLabels);

const StockDashboard = () => {
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [risk, setRisk] = useState("medium");
  const [baskets, setBaskets] = useState([]);
  const [selectedBasket, setSelectedBasket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBaskets = async () => {
    try {
      // Add cache busting parameter
      const response = await axios.get(
        `http://localhost:5000/baskets?t=${Date.now()}`,
        { 
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        const formattedData = response.data.map(basket => ({
          theme: basket.theme || "Unknown Theme",
          type: basket.type || "regular",
          invested: Number(basket.invested) || 0,
          risk: basket.risk || "medium",
          stocks: (basket.stocks || []).map(stock => ({
            symbol: stock.symbol || "N/A",
            name: stock.name || stock.company || "Unknown Company",
            current_price: Number(stock.current_price) || 0,
            "52_week_low": Number(stock["52_week_low"]) || 0,
            "52_week_high": Number(stock["52_week_high"]) || 0,
            rank: Number(stock.rank) || 0,
            theme: stock.theme || basket.theme || "Unknown"
          })).filter(stock => stock.symbol !== "N/A")
        })).filter(basket => basket.stocks.length > 0);
        
        setBaskets(formattedData);
      } else {
        throw new Error("Invalid data format received from server");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load basket data");
      console.error("Error loading baskets:", err);
    }
  };

  const handleGenerate = async () => {
    if (!investmentAmount) {
      setError("Please enter an investment amount");
      return;
    }

    setIsLoading(true);
    setError(null);
    setBaskets([]); // Clear previous baskets immediately
    setSelectedBasket(null); // Clear selection
    
    try {

      // Add cache-busting parameter and headers
      const response = await axios.post(
        `http://localhost:5000/generate?t=${Date.now()}`,
        {
          investment: parseFloat(investmentAmount),
          risk: risk
        },
        { 
          withCredentials: true
        }
      );

      // Simplify data handling - use response directly
      if (response.data && Array.isArray(response.data)) {
        setBaskets(response.data);
      } else {
        throw new Error("Invalid data format received from generator");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate baskets");
      console.error("Error generating baskets:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaskets();
  }, []);

  // Debug effect to log basket changes
  useEffect(() => {
    console.log("Baskets updated:", baskets);
  }, [baskets]);

  return (
    <div className="bg-black text-white min-h-screen p-6">
      <header className="text-center mb-8">
        <h1 className="text-3xl text-green-400 font-bold">Stock Basket Dashboard</h1>
        <p className="text-gray-400">Create and analyze your stock baskets</p>
      </header>

      <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1">
            <label className="block text-gray-400 mb-2">Income (₹)</label>
            <input
              type="number"
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:border-green-500 focus:outline-none"
              placeholder="e.g. 50000"
              value={investmentAmount}
              onChange={(e) => setInvestmentAmount(e.target.value)}
            />
          </div>
          
          <div className="flex-1">
            <label className="block text-gray-400 mb-2">Risk Level</label>
            <select
              className="w-full px-4 py-2 rounded-md bg-gray-800 text-white border border-gray-700 focus:border-green-500 focus:outline-none"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={isLoading || !investmentAmount}
            className={`mt-6 md:mt-0 px-6 py-2 rounded-md font-medium transition-colors ${
              isLoading || !investmentAmount
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </span>
            ) : (
              "Generate Baskets"
            )}
          </button>
        </div>
        
        {error && (
          <div className="mt-4 text-red-400 text-sm">{error}</div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
          <p className="mt-4 text-green-400">Generating your baskets...</p>
        </div>
      ) : (
        <>
          {baskets.length > 0 ? (
            !selectedBasket ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {baskets.map((basket, index) => (
                  <ThemeCard key={index} basket={basket} onSelect={setSelectedBasket} />
                ))}
              </div>
            ) : (
              <BasketDetails basket={selectedBasket} onBack={() => setSelectedBasket(null)} />
            )
          ) : (
            <div className="text-center py-12 text-gray-400">
              No baskets available. Enter an investment amount and click [ Generate Baskets ].
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ThemeCard = ({ basket, onSelect }) => {
  const initialTotal = basket.stocks.reduce((sum, stock) => sum + stock["52_week_low"], 0);
  const currentTotal = basket.stocks.reduce((sum, stock) => sum + stock.current_price, 0);
  const returnPercentage = initialTotal > 0
  ? ((currentTotal - initialTotal) / initialTotal * 100).toFixed(2)
  : 0;

  return (
    <div
      className="bg-gray-900 p-6 rounded-lg shadow-lg cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all border border-gray-800 hover:border-green-500/30"
      onClick={() => onSelect(basket)}
    >
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-bold text-green-400">
          {basket.theme} {basket.type === "hybrid" ? "Basket" : ""}
        </h2>
        <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
          {basket.stocks.length} stocks
        </span>
      </div>
      
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Invested Value</p>
          <p className="text-lg font-bold">₹{currentTotal.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Returns</p>
          <p className={`text-lg font-bold ${
            parseFloat(returnPercentage) >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {returnPercentage}%
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-gray-400 text-sm">Top Stocks:</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {basket.stocks.slice(0, 3).map((stock, i) => (
            <span key={i} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
              {stock.symbol}
            </span>
          ))}
          {basket.stocks.length > 3 && (
            <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-500">
              +{basket.stocks.length - 3} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

ThemeCard.propTypes = {
  basket: PropTypes.shape({
    theme: PropTypes.string,
    type: PropTypes.string,
    invested: PropTypes.number,
    risk: PropTypes.string,
    stocks: PropTypes.arrayOf(
      PropTypes.shape({
        symbol: PropTypes.string,
        name: PropTypes.string,
        current_price: PropTypes.number,
        "52_week_low": PropTypes.number,
        "52_week_high": PropTypes.number,
        rank: PropTypes.number,
        theme: PropTypes.string,
      })
    )
  }).isRequired,

  onSelect: PropTypes.func.isRequired,
};

const BasketDetails = ({ basket, onBack }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current && basket) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      
      chartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: ["52-Week Low", "Current", "52-Week High"],
          datasets: [{
            label: "Price Movement",
            data: [
              basket.stocks.reduce((acc, stock) => acc + stock["52_week_low"], 0),
              basket.stocks.reduce((acc, stock) => acc + stock.current_price, 0),
              basket.stocks.reduce((acc, stock) => acc + stock["52_week_high"], 0),
            ],
            borderColor: "rgb(46, 204, 113)",
            backgroundColor: "rgba(46, 204, 113, 0.2)",
            tension: 0.1,
            fill: true,
            pointBackgroundColor: [
              "rgba(231, 76, 60, 1)",
              "rgba(52, 152, 219, 1)",
              "rgba(46, 204, 113, 1)"
            ],
            pointRadius: 6,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const labels = ['52-Week Low', 'Current', '52-Week High'];
                  return `${labels[context.dataIndex]}: ₹${context.raw.toLocaleString('en-IN')}`;
                }
              }
            },
            datalabels: {
              anchor: 'end',
              align: 'top',
              formatter: (value) => '₹' + value.toLocaleString('en-IN'),
              color: '#fff',
              font: { weight: 'bold' }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: {
                callback: (value) => '₹' + value.toLocaleString('en-IN')
              }
            }
          }
        },
        plugins: [ChartDataLabels]
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [basket]);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      <div className="p-6">
        <button 
          onClick={onBack} 
          className="flex items-center text-green-400 hover:text-green-300 mb-4 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to all baskets
        </button>
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-green-400">
              {basket.theme} {basket.type === "hybrid" ? "Basket" : "Theme"}
            </h2>
            <p className="text-gray-400">{basket.stocks.length} selected stocks</p>
          </div>
          <div className="bg-gray-800 px-3 py-1 rounded-md text-sm">
            <span className="text-gray-400">Risk:</span>{' '}
            <span className="font-medium capitalize">{basket.risk || 'medium'}</span>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <canvas ref={chartRef} className="w-full h-64"></canvas>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 bg-gray-900 text-gray-400 text-sm font-medium p-4 border-b border-gray-700">
            <div className="col-span-2">Symbol</div>
            <div className="col-span-4">Company</div>
            <div className="col-span-2">Theme</div>
            <div className="col-span-2 text-right">Current</div>
            <div className="col-span-2 text-right">52-Week Range</div>
          </div>
          
          {basket.stocks.map((stock, index) => (
            <div key={index} className="grid grid-cols-12 p-4 items-center border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
              <div className="col-span-2 font-medium text-green-400">
                {stock.symbol}
              </div>
              <div className="col-span-4 text-gray-300 truncate">
                {stock.name || stock.company || "Unknown Company"}
              </div>
              <div className="col-span-2 text-gray-400 truncate">
                {stock.theme || basket.theme || "Unknown"}
              </div>
              <div className="col-span-2 text-right font-bold">
                ₹{(stock.current_price || 0).toLocaleString("en-IN")}
              </div>
              <div className="col-span-2 text-right text-sm text-gray-400">
                ₹{(stock["52_week_low"] || 0).toLocaleString("en-IN")} -{' '}
                ₹{(stock["52_week_high"] || 0).toLocaleString("en-IN")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

BasketDetails.propTypes = {
  basket: PropTypes.shape({
    theme: PropTypes.string,
    type: PropTypes.string,
    risk: PropTypes.string,
    stocks: PropTypes.arrayOf(
      PropTypes.shape({
        symbol: PropTypes.string,
        name: PropTypes.string,
        current_price: PropTypes.number,
        "52_week_low": PropTypes.number,
        "52_week_high": PropTypes.number,
        theme: PropTypes.string,
      })
    )
  }).isRequired,

  onBack: PropTypes.func.isRequired,
};

export default StockDashboard;