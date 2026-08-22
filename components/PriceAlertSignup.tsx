"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Direction = "above" | "below";
type Status = "idle" | "submitting" | "success" | "error";

export function PriceAlertSignup() {
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<Direction>("above");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, targetPrice: Number(targetPrice), direction }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  }

  if (status === "success") {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
          สมัครรับการแจ้งเตือนสำเร็จ
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          กรุณาตรวจสอบอีเมลของคุณและกดยืนยันเพื่อเริ่มรับการแจ้งเตือน
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">
        รับแจ้งเตือนราคาทองทางอีเมล
      </h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        ตั้งราคาเป้าหมาย แล้วเราจะส่งอีเมลแจ้งเตือนเมื่อราคาทองคำแท่งขายออกถึงเป้าหมาย
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <div>
          <label htmlFor="alert-email" className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
            อีเมล
          </label>
          <input
            id="alert-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
          />
        </div>

        <div>
          <label htmlFor="alert-price" className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
            ราคาเป้าหมาย (บาทละ)
          </label>
          <input
            id="alert-price"
            type="number"
            required
            min={1}
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="เช่น 67000"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-gray-500 dark:text-gray-400">เงื่อนไขการแจ้งเตือน</legend>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="direction"
              value="above"
              checked={direction === "above"}
              onChange={() => setDirection("above")}
              className="accent-amber-500"
            />
            แจ้งเตือนเมื่อราคาสูงกว่า
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="radio"
              name="direction"
              value="below"
              checked={direction === "below"}
              onChange={() => setDirection("below")}
              className="accent-amber-500"
            />
            แจ้งเตือนเมื่อราคาต่ำกว่า
          </label>
        </fieldset>

        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-1 rounded-full bg-amber-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {status === "submitting" ? "กำลังบันทึก..." : "สมัครรับการแจ้งเตือน"}
        </button>
      </form>
    </section>
  );
}
