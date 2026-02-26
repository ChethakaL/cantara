"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  format,
  getDaysInMonth,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  id,
  placeholder = "Select date",
  className = "",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    value ? new Date(value) : new Date(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedDate = value ? new Date(value) : null;

  const monthStart = startOfMonth(viewDate);
  const daysInMonth = getDaysInMonth(viewDate);
  const startDayOfWeek = getDay(monthStart);

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
  }

  function handleSelect(date: Date) {
    onChange(format(date, "yyyy-MM-dd"));
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  }

  const displayValue = value ? format(new Date(value), "MMM d, yyyy") : "";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => setIsOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-[color:var(--navy)]/20 bg-white px-3 py-2.5 text-left text-sm outline-none ring-[color:var(--navy)] transition focus:ring"
      >
        <span
          className={
            displayValue
              ? "text-[color:var(--ink)]"
              : "text-[color:var(--ink-soft)]"
          }
        >
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {displayValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-[color:var(--ink-soft)] hover:bg-[color:var(--navy)]/10 hover:text-[color:var(--navy)]"
              aria-label="Clear date"
            >
              <span className="text-xs font-semibold">×</span>
            </button>
          ) : null}
          <ChevronRight
            size={16}
            className={`text-[color:var(--ink-soft)] transition-transform ${isOpen ? "-rotate-90" : "rotate-90"}`}
          />
        </div>
      </button>

      {isOpen ? (
        <div className="absolute top-full left-0 z-50 mt-2 rounded-2xl border border-[color:var(--navy)]/15 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(12,25,41,0.25)]">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate((d) => subMonths(d, 1))}
              className="rounded-lg p-2 text-[color:var(--navy)] transition hover:bg-[color:var(--navy-light)]"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold text-[color:var(--navy)]">
              {format(viewDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setViewDate((d) => addMonths(d, 1))}
              className="rounded-lg p-2 text-[color:var(--navy)] transition hover:bg-[color:var(--navy-light)]"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ink-soft)]"
              >
                {day}
              </div>
            ))}
            {days.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} />;
              }
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, viewDate);
              const isToday = isSameDay(date, new Date());

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleSelect(date)}
                  disabled={!isCurrentMonth}
                  className={`
                    aspect-square rounded-lg text-sm font-medium transition
                    ${!isCurrentMonth ? "text-[color:var(--ink-soft)]/40" : ""}
                    ${isCurrentMonth ? "text-[color:var(--ink)] hover:bg-[color:var(--navy-light)]" : ""}
                    ${isSelected ? "bg-[color:var(--navy)] text-white hover:bg-[color:var(--navy-soft)]" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-[color:var(--navy)]/30" : ""}
                  `}
                >
                  {format(date, "d")}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
