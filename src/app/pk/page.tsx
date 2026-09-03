"use client";

import React, { useState, useEffect, useRef } from "react";

type GameState = "LOBBY" | "ROOM" | "PLAYING" | "RESULT";
type ExerciseMode = "squat" | "pushup";

export default function GamePKPage() {
  // 遊戲與對戰狀態
  const [gameState, setGameState] = useState<GameState>("LOBBY");
  const [roomId, setRoomId] = useState<string>("");
  const [inputRoomId, setInputRoomId] = useState<string>("");
  const [selectedMode, setSelectedMode] = useState<ExerciseMode>("squat");
  const [isReady, setIsReady] = useState<boolean>(false);
  const [opponentReady, setOpponentReady] = useState<boolean>(false);

  // 比分與連線
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [opponentScore, setOpponentScore] = useState<number>(0);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 鏡頭與 AI Canvas
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);

  // 1. 初始化相機與模擬 AI HUD 繪製
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraActive(true);
        }
      } catch (err) {
        console.error("無法存取攝影機:", err);
      }
    }
    if (gameState === "PLAYING" || gameState === "ROOM") {
      setupCamera();
    }
  }, [gameState]);

  // 繪製 HUD 視覺回饋 (可接後續 MediaPipe 骨架邏輯)
  useEffect(() => {
    let animationFrameId: number;
    const renderHUD = () => {
      if (canvasRef.current && videoRef.current && cameraActive) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // 繪製科技藍外框
          ctx.strokeStyle = "#00f0ff";
          ctx.lineWidth = 3;
          ctx.strokeRect(20, 20, canvasRef.current.width - 40, canvasRef.current.height - 40);

          // 繪製 AI 頭部與關節追蹤點示意
          ctx.fillStyle = "#00ff66";
          ctx.beginPath();
          ctx.arc(canvasRef.current.width / 2, 100, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      animationFrameId = requestAnimationFrame(renderHUD);
    };
    if (cameraActive) renderHUD();
    return () => cancelAnimationFrame(animationFrameId);
  }, [cameraActive]);

  // 2. WebSocket 連線與房間邏輯
  const connectWebSocket = (targetRoomId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/pk?room=${targetRoomId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setGameState("ROOM");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "OPPONENT_SCORE") {
          setOpponentScore(data.score);
        } else if (data.type === "OPPONENT_READY") {
          setOpponentReady(true);
        } else if (data.type === "GAME_START") {
          setGameState("PLAYING");
        }
      } catch (e) {
        console.error("WS Message Error", e);
      }
    };

    ws.onclose = () => setWsConnected(false);
  };

  // 3. 按鈕事件處理
  const handleCreateRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomId(newRoomId);
    connectWebSocket(newRoomId);
  };

  const handleJoinRoom = () => {
    if (!inputRoomId) return;
    setRoomId(inputRoomId);
    connectWebSocket(inputRoomId);
  };

  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    wsRef.current?.send(JSON.stringify({ type: "READY", ready: nextReady }));

    if (nextReady && opponentReady) {
      wsRef.current?.send(JSON.stringify({ type: "START" }));
      setGameState("PLAYING");
    }
  };

  // 動作觸發計次 (預留給 AI 骨架辨識模組呼叫)
  const handleTriggerRep = () => {
    const newScore = playerScore + 1;
    setPlayerScore(newScore);
    wsRef.current?.send(JSON.stringify({ type: "SCORE_UPDATE", score: newScore }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center justify-center">
      {/* 頂部連線狀態 */}
      <div className="mb-4 flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${wsConnected ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-rose-500/20 text-rose-400 border border-rose-500/40"}`}>
          {wsConnected ? `● 房號: ${roomId}` : "○ 離線 / 大廳"}
        </span>
      </div>

      {/* 階段 1：大廳 / 配對與模式選擇 */}
      {gameState === "LOBBY" && (
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-6">
          <h1 className="text-2xl font-black text-cyan-400">1v1 實時動作 PK 對戰</h1>
          
          {/* 模式選擇 (精準保留深蹲與伏地挺身) */}
          <div className="space-y-2 text-left">
            <label className="text-sm font-semibold text-slate-400">選擇健身模式</label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as ExerciseMode)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="squat">🏋️ 深蹲 (Squats)</option>
              <option value="pushup">💪 伏地挺身 (Push-ups)</option>
            </select>
          </div>

          {/* 配對區塊 */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleCreateRoom}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 font-bold rounded-xl shadow-lg transition-all"
            >
              建立對戰房間
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="輸入 4 位數房號"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-center text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleJoinRoom}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 font-bold rounded-xl transition-all"
              >
                加入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 階段 2：房間準備區 */}
      {gameState === "ROOM" && (
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-6">
          <h2 className="text-xl font-bold">房間代碼：<span className="text-cyan-400 text-2xl font-black">{roomId}</span></h2>
          <p className="text-sm text-slate-400">當前模式：<span className="text-white font-semibold">{selectedMode === "squat" ? "🏋️ 深蹲" : "💪 伏地挺身"}</span></p>

          <div className="grid grid-cols-2 gap-4 my-6">
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-sm text-slate-400">玩家 (你)</p>
              <p className={`mt-2 font-bold ${isReady ? "text-emerald-400" : "text-amber-400"}`}>
                {isReady ? "已準備" : "未準備"}
              </p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
              <p className="text-sm text-slate-400">對手</p>
              <p className={`mt-2 font-bold ${opponentReady ? "text-emerald-400" : "text-slate-500"}`}>
                {opponentReady ? "已準備" : "等待加入..."}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleReady}
            className={`w-full py-3 font-bold rounded-xl transition-all shadow-lg ${
              isReady ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {isReady ? "取消準備" : "準備完成"}
          </button>
        </div>
      )}

      {/* 階段 3：對戰畫面 + HUD 疊加 */}
      {gameState === "PLAYING" && (
        <div className="w-full max-w-4xl space-y-4">
          <div className="flex justify-between items-center bg-slate-900 px-6 py-3 rounded-xl border border-slate-800">
            <div>
              <span className="text-xs text-slate-400">你的分數 ({selectedMode === "squat" ? "深蹲" : "伏地挺身"})</span>
              <p className="text-3xl font-black text-cyan-400">{playerScore}</p>
            </div>
            <div className="text-2xl font-black text-rose-500">VS</div>
            <div className="text-right">
              <span className="text-xs text-slate-400">對手分數</span>
              <p className="text-3xl font-black text-rose-400">{opponentScore}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 本地視訊 + HUD 骨架疊加層 */}
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-cyan-500/30">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-md text-xs text-cyan-400 font-mono">
                AI HUD 追蹤中
              </div>
            </div>

            {/* 對手數據區域 */}
            <div className="aspect-video bg-slate-900 rounded-xl border border-slate-800 flex flex-col items-center justify-center p-4">
              <p className="text-slate-400 text-sm mb-2">對手數據廣播</p>
              <p className="text-5xl font-black text-rose-500">{opponentScore} <span className="text-base font-normal text-slate-400">次</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}