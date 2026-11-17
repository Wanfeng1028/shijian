"use client";
import { motion } from "motion/react";
import { useMemo } from "react";
import {
  Slider as AriaSlider,
  SliderThumb as AriaSliderThumb,
  SliderTrack as AriaSliderTrack,
} from "react-aria-components";

export const EFFORT_LEVELS = ["Low", "Medium", "Balanced", "High", "Very High", "Max"];

export function EffortSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isMax = value === EFFORT_LEVELS.length - 1;
  const scatter = useMemo(
    () =>
      EFFORT_LEVELS.map(() => ({
        x: -(70 + 130 * Math.random()),
        y: (Math.random() - 0.5) * 70,
        rotate: (Math.random() - 0.5) * 720,
        delay: 0.3 * Math.random(),
      })),
    [isMax],
  );
  const d = value / (EFFORT_LEVELS.length - 1);
  return (
    <AriaSlider
      aria-label="Effort"
      minValue={0}
      maxValue={EFFORT_LEVELS.length - 1}
      step={1}
      value={value}
      onChange={onChange}
      className="w-full"
    >
      <div className="relative h-[27px] w-full overflow-hidden rounded-lg bg-background-secondary-default">
        <div
          className="absolute inset-y-0 start-0 rounded-lg bg-background-tertiary-hover transition-[width] duration-150 ease-out"
          style={{ width: `calc(${d} * (100% - 21px) + 21px)` }}
        />
        <div
          className="absolute inset-y-0 start-0 rounded-lg bg-linear-to-r from-accent-500 to-accent-600 transition-[width,opacity] duration-150 ease-out"
          style={{
            width: `calc(${d} * (100% - 21px) + 21px)`,
            opacity: d,
            boxShadow: `0 0 ${12 + d * 12}px rgba(59, 130, 246, ${0.25 + d * 0.45})`,
          }}
        />
        <div className="absolute inset-x-[9px] top-[7px] flex h-[13px] items-center justify-between">
          {EFFORT_LEVELS.map((label, i) => (
            <motion.span
              key={label}
              animate={
                isMax
                  ? { x: scatter[i].x, y: scatter[i].y, rotate: scatter[i].rotate, opacity: 0 }
                  : { x: 0, y: 0, rotate: 0, opacity: i > value ? 0.3 : 1 }
              }
              transition={
                isMax
                  ? { duration: 1.6, ease: [0.22, 0.5, 0.5, 1], delay: scatter[i].delay }
                  : { duration: 0.3, ease: "easeOut" }
              }
              className="h-full w-[3px] rounded-[2px] bg-foreground-icon-tertiary"
            />
          ))}
        </div>
        <div className="absolute inset-x-[10.5px] inset-y-0">
          <AriaSliderTrack className="h-full w-full">
            <AriaSliderThumb className="top-1/2 h-[27px] w-[21px] cursor-grab rounded-[7px] border border-border-checkbox-default bg-background-primary-default shadow-xs outline-none transition-shadow data-[dragging]:cursor-grabbing data-[focus-visible]:ring-2 data-[focus-visible]:ring-border-focus-ring" />
          </AriaSliderTrack>
        </div>
      </div>
    </AriaSlider>
  );
}