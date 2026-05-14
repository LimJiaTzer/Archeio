"use client";;
import { CanvasText } from "@/components/ui/canvas-text";

export default function AnimatedText() {
  return (
    <div
      className="items-center justify-center">
      <CanvasText
        text="files easily"
        className="text-5xl sm:text-7xl font-extrabold mb-6 tracking-tight text-stone-800 drop-shadow-sm"
        backgroundClassName="bg-black dark:bg-neutral-700"
        colors={[
          "var(--color-blue-500)",
          "var(--color-sky-500)",
          "var(--color-violet-500)",
          "var(--color-teal-500)",
        ]}
        lineGap={6}
        animationDuration={10} />
    </div>
  );
}
