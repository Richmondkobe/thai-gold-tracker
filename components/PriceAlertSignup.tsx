"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type AlertType = "every_change" | "target";
type Direction = "above" | "below";
type Status = "idle" | "submitting" | "success" | "error";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50";
const RADIO_LABEL_CLASS = "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300";
const SMALL_LABEL_CLASS = "mb-1 block text-xs text-gray-500 dark:text-gray-400";

export function PriceAlertSignup() {
  const [alertType, setAlertType] = useState<AlertType>("every_change");
  const [email, setEmail] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<Direction>("above");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isTarget = alertType === "target";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          isTarget
            ? { email, alertType, targetPrice: Number(targetPrice), direction }
            : { email, alertType },
        ),
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
        {isTarget
          ? "ตั้งราคาเป้าหมาย แล้วเราจะส่งอีเมลแจ้งเตือนเมื่อราคาทองคำแท่งขายออกถึงเป้าหมาย"
          : "เราจะส่งอีเมลให้ทุกครั้งที่สมาคมค้าทองคำประกาศราคาทองใหม่ ยกเลิกได้ทุกเมื่อ"}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2">
          <legend className={SMALL_LABEL_CLASS}>รูปแบบการแจ้งเตือน</legend>
          <label className={RADIO_LABEL_CLASS}>
            <input
              type="radio"
              name="alertType"
              value="every_change"
              checked={alertType === "every_change"}
              onChange={() => setAlertType("every_change")}
              className="accent-amber-500"
            />
            ทุกครั้งที่ราคาเปลี่ยน
          </label>
          <label className={RADIO_LABEL_CLASS}>
            <input
              type="radio"
              name="alertType"
              value="target"
              checked={alertType === "target"}
              onChange={() => setAlertType("target")}
              className="accent-amber-500"
            />
            เมื่อถึงราคาเป้าหมาย
          </label>
        </fieldset>

        <div>
          <label htmlFor="alert-email" className={SMALL_LABEL_CLASS}>
            อีเมล
          </label>
          <input
            id="alert-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={INPUT_CLASS}
          />
        </div>

        {isTarget && (
          <>
            <div>
              <label htmlFor="alert-price" className={SMALL_LABEL_CLASS}>
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
                className={INPUT_CLASS}
              />
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className={SMALL_LABEL_CLASS}>เงื่อนไขการแจ้งเตือน</legend>
              <label className={RADIO_LABEL_CLASS}>
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
              <label className={RADIO_LABEL_CLASS}>
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
          </>
        )}

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
