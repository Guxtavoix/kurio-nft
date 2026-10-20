import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'
import { errorMessage } from '@/api/errors'
import { ErrorState } from './states'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const { reset: resetQueries } = useQueryErrorResetBoundary()
  useEffect(() => resetQueries(), [resetQueries])
  return (
    <div className="mx-auto max-w-[600px] px-4 py-24">
      <ErrorState
        title="Não foi possível carregar esta página"
        message={errorMessage(error)}
        onRetry={() => {
          reset()
          void router.invalidate()
        }}
      />
    </div>
  )
}
