'use client'

export const dynamic = 'force-dynamic';
export const dynamicParams = true;


export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es">
      <body>
        <h2>Ha ocurrido un error inesperado</h2>
        <p>{error.message}</p>
        {error.digest && <p>Error ID: {error.digest}</p>}
        <button onClick={() => reset()}>Intentar nuevamente</button>
      </body>
    </html>
  )
}