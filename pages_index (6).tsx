import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

type Position = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: number;
};

type Trade = {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  price: number;
  realizedPnl: number;
  timestamp: number;
  closeReason: string;
};

type PricePoint = {
  time: string;
  price: number;
};

const SYMBOLS = [
  { name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
  { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
  { name: 'Solana', symbol: 'SOL', icon: '◎' },
  { name: 'Cardano', symbol: 'ADA', icon: '₳' },
  { name: 'Polkadot', symbol: 'DOT', icon: '●' }
];

const DEFAULT_BALANCE = 10000;

export default function CryptoTradingDashboard() {
  // Account state
  const [balance, setBalance] = useState<number>(DEFAULT_BALANCE);
  const [equity, setEquity] = useState<number>(DEFAULT_BALANCE);
  const [unrealizedPnl, setUnrealizedPnl] = useState<number>(0);
  const [realizedPnl, setRealizedPnl] = useState<number>(0);
  const [leverage, setLeverage] = useState<number>(10);

  // Market state
  const [selectedSymbol, setSelectedSymbol] = useState(SYMBOLS[0]);
  const [price, setPrice] = useState<number>(42350.75);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [change24h, setChange24h] = useState<number>(2.35);

  // Orders
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(42350.75);
  const [quantity, setQuantity] = useState<number>(0.1);
  const [stopLoss, setStopLoss] = useState<number>(41000);
  const [takeProfit, setTakeProfit] = useState<number>(45000);

  // Positions and history
  const [positions, setPositions] = useState<Position[]>([
    {
      id: '1',
      symbol: 'BTC',
      side: 'LONG',
      quantity: 0.25,
      entryPrice: 41200.50,
      leverage: 10,
      stopLoss: 40000,
      takeProfit: 45000,
      timestamp: Date.now() - 86400000
    }
  ]);
  const [trades, setTrades] = useState<Trade[]>([
    {
      id: 't1',
      symbol: 'BTC',
      side: 'LONG',
      quantity: 0.25,
      price: 41200.50,
      realizedPnl: 0,
      timestamp: Date.now() - 86400000,
      closeReason: ''
    }
  ]);

  // Generate initial price history
  useEffect(() => {
    const initialHistory: PricePoint[] = [];
    let currentPrice = 42350.75;
    
    for (let i = 100; i >= 0; i--) {
      const fluctuation = (Math.random() - 0.5) * 200;
      currentPrice += fluctuation;
      const time = new Date(Date.now() - i * 60000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      initialHistory.push({ time, price: parseFloat(currentPrice.toFixed(2)) });
    }
    
    setPriceHistory(initialHistory);
    setPrice(parseFloat(currentPrice.toFixed(2)));
  }, []);

  // Simulate price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrice(prev => {
        const fluctuation = (Math.random() - 0.5) * 150;
        const newPrice = prev + fluctuation;
        
        // Update price history
        setPriceHistory(prevHistory => {
          const newHistory = [...prevHistory.slice(1), {
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            }),
            price: parseFloat(newPrice.toFixed(2))
          }];
          return newHistory;
        });
        
        return parseFloat(newPrice.toFixed(2));
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Calculate PnL
  useEffect(() => {
    const unrealized = positions.reduce((acc, pos) => {
      const direction = pos.side === 'LONG' ? 1 : -1;
      const priceDiff = direction * (price - pos.entryPrice);
      const notional = pos.quantity * pos.entryPrice * pos.leverage;
      const pnl = (priceDiff / pos.entryPrice) * notional;
      return acc + pnl;
    }, 0);
    
    setUnrealizedPnl(parseFloat(unrealized.toFixed(2)));
    setEquity(parseFloat((balance + unrealized).toFixed(2)));
  }, [positions, price, balance]);

  const handleBuy = () => {
    if (quantity <= 0) return;
    
    const requiredMargin = (quantity * price) / leverage;
    if (requiredMargin > balance) {
      alert('Insufficient balance');
      return;
    }
    
    setBalance(prev => prev - requiredMargin);
    
    const newPosition: Position = {
      id: `pos-${Date.now()}`,
      symbol: selectedSymbol.symbol,
      side: 'LONG',
      quantity,
      entryPrice: orderType === 'MARKET' ? price : limitPrice,
      leverage,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
      timestamp: Date.now()
    };
    
    setPositions(prev => [...prev, newPosition]);
  };

  const handleSell = () => {
    if (quantity <= 0) return;
    
    const longPositions = positions.filter(p => p.side === 'LONG');
    const totalLongQty = longPositions.reduce((sum, p) => sum + p.quantity, 0);
    
    if (quantity > totalLongQty) {
      alert('Not enough position to sell');
      return;
    }
    
    // Close positions
    let remainingQty = quantity;
    const closedPositions: Position[] = [];
    const updatedPositions = positions.filter(position => {
      if (position.side !== 'LONG') return true;
      if (remainingQty <= 0) return true;
      
      if (position.quantity <= remainingQty) {
        // Close entire position
        remainingQty -= position.quantity;
        closedPositions.push(position);
        return false;
      } else {
        // Partially close position
        const closedQty = remainingQty;
        const pnl = (price - position.entryPrice) * closedQty * leverage;
        
        setRealizedPnl(prev => prev + pnl);
        setBalance(prev => prev + (closedQty * position.entryPrice / leverage) + pnl);
        
        const newTrade: Trade = {
          id: `trade-${Date.now()}`,
          symbol: position.symbol,
          side: 'LONG',
          quantity: closedQty,
          price,
          realizedPnl: pnl,
          timestamp: Date.now(),
          closeReason: 'Market Sell'
        };
        
        setTrades(prev => [newTrade, ...prev]);
        
        remainingQty = 0;
        return {
          ...position,
          quantity: position.quantity - closedQty
        };
      }
    });
    
    // Close full positions
    closedPositions.forEach(position => {
      const pnl = (price - position.entryPrice) * position.quantity * leverage;
      setRealizedPnl(prev => prev + pnl);
      setBalance(prev => prev + (position.quantity * position.entryPrice / leverage) + pnl);
      
      const newTrade: Trade = {
        id: `trade-${Date.now()}`,
        symbol: position.symbol,
        side: 'LONG',
        quantity: position.quantity,
        price,
        realizedPnl: pnl,
        timestamp: Date.now(),
        closeReason: 'Market Sell'
      };
      
      setTrades(prev => [newTrade, ...prev]);
    });
    
    setPositions(updatedPositions);
  };

  const closeAllPositions = () => {
    if (positions.length === 0) return;
    
    const totalPnl = positions.reduce((acc, pos) => {
      const direction = pos.side === 'LONG' ? 1 : -1;
      const priceDiff = direction * (price - pos.entryPrice);
      const notional = pos.quantity * pos.entryPrice * pos.leverage;
      const pnl = (priceDiff / pos.entryPrice) * notional;
      return acc + pnl;
    }, 0);
    
    const marginReturned = positions.reduce((acc, pos) => {
      return acc + (pos.quantity * pos.entryPrice / pos.leverage);
    }, 0);
    
    setRealizedPnl(prev => prev + totalPnl);
    setBalance(prev => prev + marginReturned + totalPnl);
    
    const newTrades = positions.map(pos => ({
      id: `trade-${Date.now()}-${pos.id}`,
      symbol: pos.symbol,
      side: pos.side,
      quantity: pos.quantity,
      price,
      realizedPnl: (price - pos.entryPrice) * pos.quantity * pos.leverage,
      timestamp: Date.now(),
      closeReason: 'Manual Close All'
    }));
    
    setTrades(prev => [...newTrades, ...prev]);
    setPositions([]);
  };

  const resetAccount = () => {
    setBalance(DEFAULT_BALANCE);
    setEquity(DEFAULT_BALANCE);
    setUnrealizedPnl(0);
    setRealizedPnl(0);
    setPositions([
      {
        id: '1',
        symbol: 'BTC',
        side: 'LONG',
        quantity: 0.25,
        entryPrice: 41200.50,
        leverage: 10,
        stopLoss: 40000,
        takeProfit: 45000,
        timestamp: Date.now() - 86400000
      }
    ]);
    setTrades([
      {
        id: 't1',
        symbol: 'BTC',
        side: 'LONG',
        quantity: 0.25,
        price: 41200.50,
        realizedPnl: 0,
        timestamp: Date.now() - 86400000,
        closeReason: ''
      }
    ]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Crypto Trading Dashboard</h1>
          <p className="text-gray-400">Simulated trading environment for cryptocurrency markets</p>
        </header>

        {/* Account Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-1">Balance</h3>
            <p className="text-2xl font-bold">{formatCurrency(balance)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-1">Equity</h3>
            <p className="text-2xl font-bold">{formatCurrency(equity)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-1">Unrealized PnL</h3>
            <p className={`text-2xl font-bold ${unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(unrealizedPnl)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-gray-400 text-sm font-medium mb-1">Realized PnL</h3>
            <p className={`text-2xl font-bold ${realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatCurrency(realizedPnl)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Chart Section */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold flex items-center">
                    <span className="mr-2 text-yellow-500">{selectedSymbol.icon}</span>
                    {selectedSymbol.name} ({selectedSymbol.symbol})
                  </h2>
                  <div className="flex items-center mt-1">
                    <span className="text-2xl font-bold mr-3">{formatCurrency(price)}</span>
                    <span className={`px-2 py-1 rounded ${change24h >= 0 ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                      {formatPercent(change24h)}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {SYMBOLS.map(symbol => (
                    <button
                      key={symbol.symbol}
                      onClick={() => setSelectedSymbol(symbol)}
                      className={`px-3 py-1 rounded-lg ${selectedSymbol.symbol === symbol.symbol ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      {symbol.symbol}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: '#999', fontSize: 12 }}
                      tickLine={{ stroke: '#444' }}
                    />
                    <YAxis 
                      domain={['auto', 'auto']} 
                      tick={{ fill: '#999', fontSize: 12 }}
                      tickLine={{ stroke: '#444' }}
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Price']}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={false} 
                      activeDot={{ r: 6, fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trading Panel */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-6">Trade {selectedSymbol.symbol}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Order Type */}
                <div>
                  <label className="block text-gray-400 mb-2">Order Type</label>
                  <div className="flex space-x-4 mb-4">
                    <button
                      onClick={() => setOrderType('MARKET')}
                      className={`flex-1 py-2 rounded-lg ${orderType === 'MARKET' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      Market
                    </button>
                    <button
                      onClick={() => setOrderType('LIMIT')}
                      className={`flex-1 py-2 rounded-lg ${orderType === 'LIMIT' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      Limit
                    </button>
                  </div>
                  
                  {orderType === 'LIMIT' && (
                    <div className="mb-4">
                      <label className="block text-gray-400 mb-2">Limit Price</label>
                      <input
                        type="number"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <label className="block text-gray-400 mb-2">Quantity ({selectedSymbol.symbol})</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-400 mb-2">Leverage: {leverage}x</label>
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={leverage}
                      onChange={(e) => setLeverage(parseInt(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>1x</span>
                      <span>100x</span>
                    </div>
                  </div>
                </div>
                
                {/* Order Execution */}
                <div>
                  <div className="mb-4">
                    <label className="block text-gray-400 mb-2">Stop Loss</label>
                    <input
                      type="number"
                      value={stopLoss || ''}
                      onChange={(e) => setStopLoss(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="None"
                    />
                  </div>
                  
                  <div className="mb-6">
                    <label className="block text-gray-400 mb-2">Take Profit</label>
                    <input
                      type="number"
                      value={takeProfit || ''}
                      onChange={(e) => setTakeProfit(parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="None"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleBuy}
                      className="py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
                    >
                      BUY
                    </button>
                    <button
                      onClick={handleSell}
                      className="py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold transition-colors"
                    >
                      SELL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Positions */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Open Positions</h2>
                <button 
                  onClick={closeAllPositions}
                  disabled={positions.length === 0}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded disabled:opacity-50"
                >
                  Close All
                </button>
              </div>
              
              {positions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No open positions</p>
              ) : (
                <div className="space-y-3">
                  {positions.map(position => (
                    <div key={position.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between mb-2">
                        <div>
                          <span className="font-bold">{position.symbol}</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${position.side === 'LONG' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                            {position.side}
                          </span>
                        </div>
                        <span>{position.quantity} {position.symbol}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Entry:</span>
                        <span>{formatCurrency(position.entryPrice)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Current:</span>
                        <span>{formatCurrency(price)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm mb-1">
                        <span>PnL:</span>
                        <span className={`${(price - position.entryPrice) * position.quantity * position.leverage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency((price - position.entryPrice) * position.quantity * position.leverage)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>Leverage:</span>
                        <span>{position.leverage}x</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Recent Trades */}
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Recent Trades</h2>
                <button 
                  onClick={resetAccount}
                  className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
                >
                  Reset Account
                </button>
              </div>
              
              {trades.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent trades</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {trades.map(trade => (
                    <div key={trade.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between mb-1">
                        <div>
                          <span className="font-bold">{trade.symbol}</span>
                          <span className={`ml-2 px-2 py-1 rounded text-xs ${trade.side === 'LONG' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                            {trade.side}
                          </span>
                        </div>
                        <span className={`${trade.realizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {formatCurrency(trade.realizedPnl)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm text-gray-400">
                        <span>{new Date(trade.timestamp).toLocaleTimeString()}</span>
                        <span>{trade.quantity} {trade.symbol} @ {formatCurrency(trade.price)}</span>
                      </div>
                      
                      <div className="text-xs text-gray-500 mt-1">
                        {trade.closeReason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
