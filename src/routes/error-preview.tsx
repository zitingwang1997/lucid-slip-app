import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/Shell";
import { RitualErrorScreen } from "@/components/RitualErrorScreen";

export const Route = createFileRoute("/error-preview")({
  head: () => ({
    meta: [
      { title: "错误页预览 · 一签" },
      { name: "description", content: "预览一签的仪式感错误页面：燃香、青烟与金粒。" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "错误页预览 · 一签" },
      { property: "og:description", content: "预览一签的仪式感错误页面。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ErrorPreviewPage,
});

/**
 * 三种报错场景的文案，和真实调用方保持一致：
 *  · interpret —— poem.tsx / interpret.tsx 解签失败
 *  · notfound  —— __root.tsx notFoundComponent，访问不存在的路由
 *  · crash     —— __root.tsx errorComponent，渲染层崩溃
 * 改了真实页面的文案，记得同步这里，否则预览会失真。
 */
const VARIANTS = {
  interpret: {
    tab: "解签失败",
    title: "今日闭关",
    subtitle: "晚些时候再来",
    detail: "解签失败，请稍后再试" as string | null,
    restartLabel: "重 新 解 签",
    secondaryLabel: "重 启 仪 式" as string | null,
  },
  notfound: {
    tab: "404",
    title: "此处无签",
    subtitle: "你要找的页面不存在",
    detail: null,
    restartLabel: "回到首页",
    secondaryLabel: null as string | null,
  },
  crash: {
    tab: "崩溃兜底",
    title: "仪式中断",
    subtitle: "出了点小状况",
    detail: null,
    restartLabel: "重启仪式",
    secondaryLabel: null as string | null,
  },
} as const;

type VariantKey = keyof typeof VARIANTS;

function ErrorPreviewPage() {
  const navigate = useNavigate();
  const [key, setKey] = useState<VariantKey>("interpret");
  const v = VARIANTS[key];

  return (
    <Shell intensity={0.5} showTemple={false}>
      <RitualErrorScreen
        // key 变化时强制重挂载，让入场动效和香的燃烧从头播一遍
        key={key}
        title={v.title}
        subtitle={v.subtitle}
        detail={v.detail}
        restartLabel={v.restartLabel}
        onRestart={() => navigate({ to: "/" })}
        secondaryLabel={v.secondaryLabel ?? undefined}
        onSecondary={v.secondaryLabel ? () => navigate({ to: "/" }) : undefined}
      />

      {/* 切换器只在本地开发时出现。import.meta.env.DEV 在 bun run build 时是 false，
          整块会被打包器直接剔除，线上不会有这三个按钮，也不会增加体积。 */}
      {import.meta.env.DEV && (
        <div className="pointer-events-auto fixed inset-x-0 bottom-6 z-50 flex justify-center gap-2 px-4">
          {(Object.keys(VARIANTS) as VariantKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setKey(k)}
              className={`rounded-full border px-4 py-1.5 font-serif-sc text-[11px] tracking-[0.2em] transition-colors ${
                k === key
                  ? "border-foreground/30 text-foreground/80"
                  : "border-foreground/10 text-foreground/35 hover:text-foreground/60"
              }`}
            >
              {VARIANTS[k].tab}
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}
