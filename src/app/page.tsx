import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import crypto from "crypto";

const firebaseConfig = {
  apiKey: "AIzaSyBsROV8k8xwZgUq9pjcJnYj20qmNPuAGw8",
  authDomain: "too-sticky.firebaseapp.com",
  projectId: "too-sticky",
  storageBucket: "too-sticky.firebasestorage.app",
  messagingSenderId: "640753884501",
  appId: "1:640753884501:web:4c06af82f43ee47613a3dc",
  measurementId: "G-76S0J4KK8G"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const baseSymbols = ["🍒", "💎", "7️⃣", "🔔", "🍋"];
const wildSymbol = "⭐";
const scatterSymbol = "💰";
const allSymbols = [...baseSymbols, wildSymbol, scatterSymbol];

const generateRNG = (seed, round) => {
  const hash = crypto.createHash("sha256").update(`${seed}:${round}`).digest("hex");
  const value = parseInt(hash.substring(0, 8), 16);
  return value / 0xffffffff;
};

export default function SlotMachine() {
  const initialGrid = Array(5).fill(null).map(() => Array(5).fill("❓"));
  const [grid, setGrid] = useState(initialGrid);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState("");
  const [lineMultipliers, setLineMultipliers] = useState(Array(5).fill(0));
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(50);
  const [freeSpins, setFreeSpins] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [sound, setSound] = useState(null);
  const [stickyWilds, setStickyWilds] = useState([]);
  const [history, setHistory] = useState([]);
  const [seed] = useState("user-seed");
  const [round, setRound] = useState(1);

  useEffect(() => {
    const winSound = new Audio("/sounds/win.mp3");
    const spinSound = new Audio("/sounds/spin.mp3");
    setSound({ win: winSound, spin: spinSound });
  }, []);

  const spin = async () => {
    if (!freeSpins && balance < betAmount) {
      setResult("Insufficient balance");
      return;
    }

    setSpinning(true);
    setResult("");
    setLineMultipliers(Array(5).fill(0));
    setAnimate(true);
    if (sound?.spin) sound.spin.play();
    if (!freeSpins) setBalance(prev => prev - betAmount);

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

      setGrid(newGrid);
      setLineMultipliers(multipliers);
      setSpinning(false);
      setAnimate(false);

      let totalWin = 0;
      let scatterCount = 0;
      let newStickyWilds = [...stickyWilds];

      multipliers.forEach((mult, rowIdx) => {
        const row = newGrid.map(col => col[rowIdx]);
        const first = row[0];
        const allSameOrWild = row.every(s => s === first || s === wildSymbol || first === wildSymbol);
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
        setFreeSpins(prev => prev + 5);
      }

      if (totalWin > 0 && sound?.win) sound.win.play();

      setBalance(prev => prev + totalWin);
      setStickyWilds(newStickyWilds);
      setHistory(prev => [
        { grid: newGrid, win: totalWin, freeSpin: freeSpins > 0 },
        ...prev.slice(0, 9)
      ]);

      await addDoc(collection(db, "spins"), {
        seed,
        round,
        win: totalWin,
        freeSpin: freeSpins > 0,
        timestamp: new Date()
      });

      setResult(
        totalWin > 0
          ? `💰 Win: $${totalWin}${scatterCount >= 3 ? " + 5 Free Spins!" : ""}`
          : freeSpins > 0
          ? `Free Spin used. No win.`
          : "No win this time"
      );

      if (freeSpins > 0) setFreeSpins(prev => prev - 1);
      setRound(prev => prev + 1);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">🎰 5x5 Slot Machine Demo</h1>

      <div className="mb-2 text-lg">Balance: ${balance}</div>
      <div className="mb-2 text-lg">Bet Amount: ${betAmount}</div>
      {freeSpins > 0 && <div className="mb-4 text-green-600 font-semibold">🎁 Free Spins Left: {freeSpins}</div>}

      <div className={`grid grid-cols-5 gap-2 mb-4 text-3xl transition-transform duration-500 ${animate ? "animate-pulse" : ""}`}>
        {grid.map((col, colIdx) => (
          <div key={colIdx} className="space-y-2">
            {col.map((symbol, rowIdx) => (
              <div key={rowIdx} className="p-2 border rounded bg-white shadow">{symbol}</div>
            ))}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2 mb-4">
        {lineMultipliers.map((mult, i) => (
          <div key={i} className="text-sm text-gray-700 font-semibold">
            {mult > 0 ? `x${mult} Line` : ""}
          </div>
        ))}
      </div>

      <Button onClick={spin} disabled={spinning}>
        {spinning ? "Spinning..." : freeSpins > 0 ? "Free Spin" : "Spin"}
      </Button>

      {result && <div className="mt-4 text-lg font-semibold">{result}</div>}

      <div className="mt-6 text-left">
        <h2 className="text-md font-bold mb-2">📜 Spin History</h2>
        <ul className="text-sm space-y-1">
          {history.map((h, idx) => (
            <li key={idx} className="bg-gray-100 p-2 rounded">
              {h.freeSpin ? "(Free Spin)" : "(Paid Spin)"} Win: ${h.win}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
