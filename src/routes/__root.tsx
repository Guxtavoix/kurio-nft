import { createRootRouteWithContext, HeadContent, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { ConnectionIndicator } from '@/components/feedback/connection-indicator'
import { LiveAnnouncer } from '@/components/feedback/live-announcer'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { RouterContext } from '@/router'

const MockPanel =
  import.meta.env.VITE_ENABLE_MOCKS !== 'false' ? lazy(() => import('@/mocks/panel/mock-panel')) : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
})

function RootLayout() {
  return (
    <TooltipProvider delayDuration={300}>
      <HeadContent />
      <a
        href="#conteudo"
        className="bg-brand text-ink sr-only-focusable fixed top-2 left-2 z-[100] rounded-md px-4 py-2 font-bold"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer className="mb-24 md:mb-0" />
      <MobileTabBar />
      <ConnectionIndicator />
      <LiveAnnouncer />
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        toastOptions={{ className: 'font-sans' }}
        containerAriaLabel="Notificações"
      />
      <Suspense fallback={null}>
        <MockPanel />
      </Suspense>
    </TooltipProvider>
  )
}
