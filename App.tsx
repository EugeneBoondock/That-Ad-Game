
import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import { GameState } from './types';
import { CONSTANTS } from './constants';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [soldierCount, setSoldierCount] = useState(0);
  const [ultimateCharge, setUltimateCharge] = useState(0);
  const [combo, setCombo] = useState(0);
  const [triggerUltimate, setTriggerUltimate] = useState(false);
  const [startMessage, setStartMessage] = useState("MULTIPLY. DESTROY. DOMINATE.");
  const [systemStatus, setSystemStatus] = useState<'STABLE' | 'OVERDRIVE' | 'CORRUPTED'>('STABLE');

  useEffect(() => {
    const fetchWittyText = async () => {
      if (process.env.API_KEY) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: "Write a 3 word intense command for a war game menu.",
          });
          const text = response.text?.trim();
          if (text) setStartMessage(text.toUpperCase());
        } catch (e) {
          console.log("AI fallback skipped");
        }
      }
    };
    
    if (gameState === GameState.MENU) {
       fetchWittyText();
    }
  }, [gameState]);

  const handleUltimateClick = () => {
    if (ultimateCharge >= CONSTANTS.ULTIMATE_MAX_CHARGE) {
        setTriggerUltimate(true);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900 font-sans select-none">
      {/* Game Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <GameEngine 
            gameState={gameState} 
            setGameState={setGameState} 
            setScore={setScore}
            setSoldierCount={setSoldierCount}
            setUltimateCharge={setUltimateCharge}
            setCombo={setCombo}
            triggerUltimate={triggerUltimate}
            setTriggerUltimate={setTriggerUltimate}
            setSystemStatus={setSystemStatus}
        />
      </div>

      {/* HUD Layer (Playing) */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col items-center bg-blue-900/80 p-4 rounded-tr-2xl rounded-bl-2xl border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] backdrop-blur-sm transform -skew-x-6">
               <span className="text-blue-200 text-[10px] uppercase tracking-[0.2em] font-bold">Troop Count</span>
               <span className="text-5xl font-black text-white drop-shadow-lg">{soldierCount}</span>
            </div>
            
            {/* Central Status Monitor */}
            <div className={`flex flex-col items-center px-6 py-2 rounded-lg border-2 backdrop-blur-md transition-all duration-300
                ${systemStatus === 'CORRUPTED' ? 'bg-red-900/80 border-red-500 animate-pulse' : 
                  systemStatus === 'OVERDRIVE' ? 'bg-yellow-600/80 border-yellow-400 animate-bounce' : 
                  'bg-slate-800/50 border-slate-600'}`}>
                <span className="text-[10px] font-bold tracking-widest uppercase text-white opacity-80">System Status</span>
                <span className={`text-2xl font-black tracking-widest uppercase
                    ${systemStatus === 'CORRUPTED' ? 'text-red-400 glitch-text' : 
                      systemStatus === 'OVERDRIVE' ? 'text-yellow-200' : 'text-emerald-400'}`}>
                    {systemStatus}
                </span>
            </div>

            <div className="flex flex-col items-center bg-amber-900/80 p-4 rounded-tl-2xl rounded-br-2xl border-2 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.5)] backdrop-blur-sm transform skew-x-6">
               <span className="text-amber-200 text-[10px] uppercase tracking-[0.2em] font-bold">Score</span>
               <span className="text-5xl font-black text-white drop-shadow-lg">{score}</span>
            </div>
          </div>
          
          {/* Combo Counter */}
           {combo > 5 && (
             <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center">
                 <span className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-500 drop-shadow-lg">
                    {combo}x COMBO
                 </span>
             </div>
           )}

          {/* Ultimate Bar & Button */}
          <div className="w-full flex flex-col items-center gap-2 mb-8 pointer-events-auto">
             <div className="text-white font-bold tracking-widest text-xs uppercase text-shadow">Ion Cannon Charge</div>
             <div className="w-full max-w-md h-6 bg-gray-800 rounded-full border-2 border-gray-600 overflow-hidden relative">
                 <div 
                    className={`h-full transition-all duration-200 ease-out ${ultimateCharge >= CONSTANTS.ULTIMATE_MAX_CHARGE ? 'bg-blue-400 shadow-[0_0_15px_#3b82f6]' : 'bg-blue-600'}`}
                    style={{ width: `${(ultimateCharge / CONSTANTS.ULTIMATE_MAX_CHARGE) * 100}%` }}
                 />
                 {ultimateCharge >= CONSTANTS.ULTIMATE_MAX_CHARGE && (
                     <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white animate-pulse tracking-[0.3em]">
                        READY
                     </div>
                 )}
             </div>
             
             <button 
                onClick={handleUltimateClick}
                disabled={ultimateCharge < CONSTANTS.ULTIMATE_MAX_CHARGE}
                className={`mt-2 px-8 py-4 rounded-xl font-black text-xl uppercase tracking-widest transition-all transform active:scale-95
                    ${ultimateCharge >= CONSTANTS.ULTIMATE_MAX_CHARGE 
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-[0_0_30px_rgba(59,130,246,0.8)] hover:scale-105 animate-pulse' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                    }`}
             >
                FIRE ION CANNON
             </button>
          </div>
        </div>
      )}

      {/* Menu Layer */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="relative bg-slate-800/50 border-y-4 border-blue-600 p-12 max-w-lg w-full text-center">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 px-6 py-1 rounded-full text-white font-bold text-sm tracking-widest shadow-lg uppercase">
                Sandbox Edition
            </div>
            <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 mb-2 italic drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
              THAT<br/>AD GAME
            </h1>
            <p className="text-blue-400 mb-10 font-bold text-xl tracking-widest">{startMessage}</p>
            
            <button 
              onClick={() => setGameState(GameState.PLAYING)}
              className="group relative w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 px-8 text-3xl uppercase tracking-tighter transition-all overflow-hidden"
              style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 100%, 0 100%, 0 20%)' }}
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
              PLAY NOW
            </button>
            
            <div className="mt-8 text-slate-500 text-xs font-mono">
                WARNING: CONTAINS FLASHING LIGHTS AND LOUD SOUNDS
            </div>
          </div>
        </div>
      )}

      {/* Game Over Layer */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="text-center w-full max-w-md p-8 border-4 border-red-600 bg-black/60">
              <h2 className="text-6xl font-black text-red-600 mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">WASTED</h2>
              <p className="text-red-200/50 font-bold tracking-widest uppercase mb-8">Your army fell</p>
              
              <div className="flex justify-center items-end gap-2 mb-8">
                <span className="text-2xl font-bold text-white">SCORE:</span>
                <span className="text-6xl font-black text-white leading-none">{score}</span>
              </div>

              <button 
                onClick={() => setGameState(GameState.PLAYING)}
                className="w-full bg-white hover:bg-slate-200 text-black font-black py-4 text-2xl uppercase tracking-wider transition-transform hover:scale-105 active:scale-95"
              >
                RETRY
              </button>
              
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="mt-6 text-white/40 hover:text-white text-sm font-bold tracking-widest uppercase"
              >
                Return to Base
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
