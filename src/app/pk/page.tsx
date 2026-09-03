"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { CameraFrame } from "@/components/fitness/camera-frame";

export default function GamePKPage() {
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // 1. 初始化 WebSocket 連線
  useEffect(() => {
    // 建立與後端 PK WebSocket 的連線
    const ws = new WebSocket("ws://localhost:8000/ws/pk");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket 已成功連線至 PK 伺服器");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // 接收對手傳來的分數更新
        if (data.type === "OPPONENT_SCORE") {
          setOpponentScore(data.score);
        }
      } catch (error) {
        console.error("解析 WebSocket 訊息失敗:", error);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket 連線已關閉");
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("WebSocket 發生錯誤:", error);
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // 2. 點擊測試按鈕：自己 +1 分並透過 WebSocket 廣播給對手
  const handleAddScore = () => {
    const newScore = playerScore + 1;
    setPlayerScore(newScore);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "SCORE_UPDATE",
          score: newScore,
        })
      );
    }
  };

  // 接收 CameraFrame 準備好的 Video 標籤
  const handleVideoReady = useCallback((video: HTMLVideoElement | null) => {
    setVideoElement(video);
    if (video) {
      console.log("相機影像已準備完成，可在此綁定 MediaPipe / AI 模型：", video);
    }
  }, []);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center">
        {/* 頂部標題與連線狀態 */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-3xl font-bold text-cyan-400">
            1v1 實時動作 PK 對戰
          </h1>
          <span
            className={`text-xs px-2.5 py-1 rounded-full border ${
              isConnected
                ? "bg-green-950/80 text-green-400 border-green-800"
                : "bg-red-950/80 text-red-400 border-red-800"
            }`}
          >
            {isConnected ? "WS 已連線" : "WS 離線"}
          </span>
        </div>

        <div className="flex justify-between items-center w-full max-w-4xl bg-slate-800 p-4 rounded-xl border border-slate-700 mb-6 shadow-lg">
          {/* 玩家 (你) */}
          <div className="flex flex-col items-center w-1/3">
            <span className="text-lg font-semibold text-cyan-400">玩家 (你)</span>
            <span className="text-5xl font-extrabold my-2 text-white">
              {playerScore}
            </span>
            <span className="text-sm bg-slate-700 px-3 py-1 rounded-full text-slate-300">
              當前動作：深蹲
            </span>
          </div>

          {/* VS 標誌 */}
          <div className="flex flex-col items-center">
            <div className="text-3xl font-black italic text-red-500 animate-pulse">
              VS
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {videoElement ? "相機正常運行中" : "相機連線中..."}
            </div>
          </div>

          {/* 對手數據 */}
          <div className="flex flex-col items-center w-1/3">
            <span className="text-lg font-semibold text-red-400">對手</span>
            <span className="text-5xl font-extrabold my-2 text-white">
              {opponentScore}
            </span>
            <span className="text-sm bg-slate-700 px-3 py-1 rounded-full text-slate-300">
              狀態：對戰中 ⚡
            </span>
          </div>
        </div>

        {/* 畫面顯示區 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {/* 左側： CameraFrame 元件 */}
          <div className="relative aspect-video bg-black rounded-xl border-2 border-cyan-500 overflow-hidden flex items-center justify-center shadow-2xl shadow-cyan-950/50">
            <CameraFrame active={true} onVideoReady={handleVideoReady} />
            <div className="absolute top-3 left-3 bg-cyan-600/80 backdrop-blur-md text-xs px-2.5 py-1 rounded-md font-medium z-10">
              本地 AI 骨架追蹤
            </div>
          </div>

          {/* 右側：對手數據面板 */}
          <div className="relative aspect-video bg-slate-800/80 rounded-xl border-2 border-red-500/50 p-6 flex flex-col justify-between shadow-2xl">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-red-400">
                對手數據 (純文字/數據)
              </span>
              <span className="text-xs bg-red-950/80 text-red-300 border border-red-800/50 px-2 py-0.5 rounded">
                已受隱私保護
              </span>
            </div>

            <div className="flex flex-col items-center justify-center my-auto space-y-3">
              <div className="text-6xl font-black text-red-500 tracking-wider">
                {opponentScore} <span className="text-2xl text-slate-400">下</span>
              </div>
              <p className="text-slate-400 text-sm">對手當前完成次數</p>
            </div>

            <div className="w-full bg-slate-700/50 rounded-full h-3 overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{
                  width: `${Math.min((opponentScore / 20) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>


      </div>
    </RequireAuth>
  );
}