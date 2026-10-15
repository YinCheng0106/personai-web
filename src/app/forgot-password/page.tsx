"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("重設密碼連結已發送！請前往您的電子信箱查看郵件。");
      } else {
        setMessage(data.detail || "發送失敗，請稍後再試");
      }
    } catch (err) {
      setMessage("網路連線失敗，請檢查後端伺服器是否運作中");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-md">
        <h2 className="mb-2 text-2xl font-bold text-gray-800">重設密碼申請</h2>
        <p className="mb-6 text-sm text-gray-600">
          請輸入您的註冊 Email，系統將會寄送重設密碼連結至您的信箱。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入您的 Email"
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-white font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {loading ? "發送中..." : "寄送重設信件"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm font-medium text-blue-600 bg-blue-50 p-3 rounded-lg">
            {message}
          </p>
        )}

        <div className="text-center mt-6">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">
            返回登入頁面
          </Link>
        </div>
      </div>
    </div>
  );
}