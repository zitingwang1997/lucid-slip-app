import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Shell } from "../components/Shell";
import { RitualErrorScreen } from "../components/RitualErrorScreen";

/** 访问了不存在的路由 */
function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    <Shell intensity={0.5} showTemple={false}>
      <RitualErrorScreen
        title="此处无签"
        subtitle="你要找的页面不存在"
        restartLabel="回到首页"
        onRestart={() => navigate({ to: "/" })}
      />
    </Shell>
  );
}

/** 路由或渲染层崩溃时的兜底 */
function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <Shell intensity={0.5} showTemple={false}>
      <RitualErrorScreen
        title="仪式中断"
        subtitle="出了点小状况"
        restartLabel="重启仪式"
        // 崩溃时内存里的状态可能已经坏了，用整页跳转而不是路由跳转，
        // 顺带把 React 树彻底重建，比 reset() 更可靠。
        onRestart={() => {
          window.location.href = "/";
        }}
      />
    </Shell>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#231b14" },
      { title: "一签 OneSlip" },
      { name: "description", content: "提一个问题，求一支签，与AI一同安静地解签。" },
      { property: "og:title", content: "一签 OneSlip" },
      { property: "og:description", content: "提一个问题，求一支签，与AI一同安静地解签。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "一签 OneSlip" },
      { name: "twitter:description", content: "提一个问题，求一支签，与AI一同安静地解签。" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/242b3f1c-1d6f-4e85-94d7-b80bf8b807a3/id-preview-d28b04ae--618815a0-2c44-40d8-ad6b-b175e99bdb7c.lovable.app-1780696481499.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/242b3f1c-1d6f-4e85-94d7-b80bf8b807a3/id-preview-d28b04ae--618815a0-2c44-40d8-ad6b-b175e99bdb7c.lovable.app-1780696481499.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Inter:wght@300;400;500&family=Noto+Serif+SC:wght@300;400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
