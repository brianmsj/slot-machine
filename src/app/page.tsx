// Updated Slot Machine with fixed auto spin loop, Firebase, styling, bonus, and animations
'use client';

import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import crypto from 'crypto';

const firebaseConfig = {
  apiKey: 'AIzaSyBsROV8k8xwZgUq9pjcJnYj20qmNPuAGw8',
  authDomain: 'too-sticky.firebaseapp.com',
  projectId: 'too-sticky',
  storageBucket: 'too-sticky.firebasestorage.app',
  messagingSenderId: '640753884501',
  appId: '1:640753884501:web:4c06af82f43ee47613a3dc',
  measurementId: 'G-76S0J4KK8G',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const baseSymbols = ['🍇', '🍉', '🍓', '🥝', '🍍'];
const wildSymbol = '🌟';
const scatterSymbol = '🎁';
const allSymbols = [...baseSymbols, wildSymbol, scatterSymbol];

const generateRNG = (seed: string, round: number): number => {
  const hash = crypto.createHash('sha256').update(`${seed}:${round}`).digest('hex');
  const value = parseInt(hash.substring(0, 8), 16);
  return value / 0xffffffff;
};

interface SpinResult {
  grid: string[][];
  win: number;
  freeSpin: boolean;
}

export default function SlotMachine() {
  const initialGrid = Array(5).fill(null).map(() => Array(5).fill('❓'));
  const [grid, setGrid] = useState(initialGrid);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('');
  const [lineMultipliers, setLineMultipliers] = useState(Array(5).fill(0));
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(50);
  const [freeSpins, setFreeSpins] = useState(0);
  const [bonusTriggered, setBonusTriggered] = useState(false);
  const [animateCols, setAnimateCols] = useState<number[]>([]);
  const [symbolFlash, setSymbolFlash] = useState(false);
  const [sound, setSound] = useState<any>(null);
  const [stickyWilds, setStickyWilds] = useState<[number, number][]>([]);
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [seed] = useState('user-seed');
  const [round, setRound] = useState(1);
  const [autoSpin, setAutoSpin] = useState(false);
  const [denominations] = useState([10, 25, 50, 100]);

  useEffect(() => {
    const winSound = new Audio('/sounds/win.mp3');
    const spinSound = new Audio('/sounds/spin.mp3');
    const coinSound = new Audio('/sounds/coin.mp3');
    setSound({ win: winSound, spin: spinSound, coin: coinSound });
  }, []);

  const spin = async () => {
    if (!freeSpins && balance < betAmount) {
      setResult('Insufficient balance');
      setAutoSpin(false);
      return;
    }

    setSpinning(true);
    setResult('');
    setBonusTriggered(false);
    setSymbolFlash(false);
    setLineMultipliers(Array(5).fill(0));
    setAnimateCols([0, 1, 2, 3, 4]);
    if (sound?.spin) sound.spin.play();
    if (!freeSpins) setBalance((prev) => prev - betAmount);

    setTimeout(async () => {
      const newGrid = Array(5).fill(null).map(() =>
        Array(5).fill(null).map(() => {
          const rng = generateRNG(seed, round + Math.random());
          return allSymbols[Math.floor(rng * allSymbols.length)];
        })
      );

      if (freeSpins > 0 && stickyWilds.length > 0) {
        stickyWilds.forEach(([x, y]) => {
          newGrid[x][y] = wildSymbol;
        });
      }

      const multipliers = Array(5).fill(null).map(() => {
        const rng = generateRNG(seed, round + Math.random());
        return [0, 2, 3, 5, 10][Math.floor(rng * 5)];
      });

      let totalWin = 0;
      let scatterCount = 0;
      let newStickyWilds = [...stickyWilds];

      multipliers.forEach((mult, rowIdx) => {
        const row = newGrid.map((col) => col[rowIdx]);
        const first = row[0];
        const allSameOrWild = row.every((s) => s === first || s === wildSymbol || first === wildSymbol);
        if (allSameOrWild && mult > 0) totalWin += mult * betAmount;
      });

      newGrid.forEach((col, x) => {
        col.forEach((symbol, y) => {
          if (symbol === scatterSymbol) scatterCount++;
          if (freeSpins > 0 && symbol === wildSymbol) newStickyWilds.push([x, y]);
        });
      });

      if (scatterCount >= 3) {
        totalWin += betAmount * 5;
        setFreeSpins((prev) => prev + 5);
        setBonusTriggered(true);
      }

      if (totalWin > 0) {
        sound?.win?.play();
        sound?.coin?.play();
        setSymbolFlash(true);
      }

      setBalance((prev) => prev + totalWin);
      setStickyWilds(newStickyWilds);
      setHistory((prev) => [
        { grid: newGrid, win: totalWin, freeSpin: freeSpins > 0 },
        ...prev.slice(0, 9),
      ]);

      await addDoc(collection(db, 'spins'), {
        seed,
        round,
        win: totalWin,
        freeSpin: freeSpins > 0,
        timestamp: new Date(),
      });

      setTimeout(() => {
        setGrid(newGrid);
        setLineMultipliers(multipliers);
        setSpinning(false);
        setAnimateCols([]);
        setResult(
          totalWin > 0
            ? `💰 Win: $${totalWin}${scatterCount >= 3 ? ' + Bonus Round!' : ''}`
            : freeSpins > 0
            ? `Free Spin used. No win.`
            : 'No win this time'
        );
        if (freeSpins > 0) setFreeSpins((prev) => prev - 1);
        setRound((prev) => prev + 1);
      }, 1000);
    }, 500);
  };

  useEffect(() => {
    if (autoSpin && !spinning) {
      if (balance >= betAmount) {
        const timer = setTimeout(spin, 1500);
        return () => clearTimeout(timer);
      } else {
        setAutoSpin(false);
      }
    }
  }, [autoSpin, spinning, balance]);

  return (
    <div className="max-w-5xl mx-auto p-6 rounded-xl shadow-xl bg-gradient-to-br from-purple-900 via-indigo-800 to-black border border-purple-700 text-white">
      <h1 className="text-3xl font-extrabold text-center mb-6 text-yellow-300 drop-shadow-md">🎰 Deluxe Slot Machine</h1>

      <div className="mb-4 text-lg text-center">
        <div>💰 Balance: ${balance}</div>
        {freeSpins > 0 && <div>🎁 Free Spins Left: {freeSpins}</div>}
        {bonusTriggered && (
          <div className="mb-4 text-yellow-500 font-bold text-xl animate-pulse">🎉 Bonus Round Triggered!</div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6 text-4xl text-center">
        {grid.map((col, i) => (
          <div key={i} className="space-y-2">
            {col.map((symbol, j) => (
              <div
                key={j}
                className={`p-4 bg-white text-black rounded shadow transition-all duration-500 ease-in-out transform ${
                  animateCols.includes(i) ? 'animate-spin-fast' : ''
                } ${symbolFlash ? 'animate-coin-flash' : ''}`}
              >
                {symbol}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex justify-center items-center gap-4 mb-4">
        <button
          className="bg-green-600 text-white px-6 py-3 rounded-xl text-lg hover:bg-green-700 shadow-lg transition"
          onClick={spin}
          disabled={spinning || balance < betAmount}
        >
          {spinning ? 'Spinning...' : freeSpins > 0 ? 'Free Spin' : 'Spin'}
        </button>

        <button
          className={`px-6 py-3 rounded-xl text-lg text-white shadow-lg transition ${
            autoSpin ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-500 hover:bg-gray-600'
          }`}
          onClick={() => setAutoSpin(!autoSpin)}
        >
          {autoSpin ? 'Stop Auto' : 'Auto Spin'}
        </button>
      </div>

      <div className="mb-6 text-center">
        <label className="font-semibold mr-2">💵 Denomination:</label>
        <select
          className="p-2 border rounded bg-white text-black"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
        >
          {denominations.map((d) => (
            <option key={d} value={d}>${d}</option>
          ))}
        </select>
      </div>

      {result && <div className="text-center text-lg font-semibold mt-4">{result}</div>}

      <div className="mt-6 text-left">
        <h2 className="text-md font-bold mb-2">📜 Spin History</h2>
        <ul className="text-sm space-y-1">
          {history.map((h, idx) => (
            <li key={idx} className="bg-gray-100 text-black p-2 rounded">
              {h.freeSpin ? '(Free Spin)' : '(Paid Spin)'} Win: ${h.win}
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        @keyframes spin-fast {
          0% { transform: rotateX(0deg); }
          50% { transform: rotateX(180deg); }
          100% { transform: rotateX(360deg); }
        }
        .animate-spin-fast {
          animation: spin-fast 0.6s linear infinite;
        }
        @keyframes coin-flash {
          0%, 100% { background-color: white; }
          50% { background-color: gold; }
        }
        .animate-coin-flash {
          animation: coin-flash 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}

