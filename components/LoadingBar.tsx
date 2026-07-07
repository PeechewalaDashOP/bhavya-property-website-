"use client";

import { useEffect, useRef, useState } from "react";

export function LoadingBar({ loading }: { loading: boolean }) {
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => {
    clearAll();
    if (loading) {
      setShow(true);
      setPct(0);
      timers.current.push(setTimeout(() => setPct(25), 60));
      timers.current.push(setTimeout(() => setPct(55), 500));
      timers.current.push(setTimeout(() => setPct(78), 1200));
      timers.current.push(setTimeout(() => setPct(88), 2800));
    } else {
      setPct(100);
      timers.current.push(
        setTimeout(() => {
          setShow(false);
          setPct(0);
        }, 350)
      );
    }
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        background: "rgba(0,0,0,.07)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--red)",
          transition: pct === 100 ? "width .25s ease-out" : "width .6s ease",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}
