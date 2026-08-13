import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

function ErrorPreviewPage() {
  const navigate = useNavigate();

  return (
    <Shell intensity={0.5}>
      <RitualErrorScreen detail="解签失败，请稍后再试" onRestart={() => navigate({ to: "/" })} />
    </Shell>
  );
}
