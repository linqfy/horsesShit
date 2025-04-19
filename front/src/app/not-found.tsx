'use client'

import Link from 'next/link';

//export const dynamic = 'force-dynamic';
//export const dynamicParams = true;

export default function NotFound() {
    return (
        <div
            style={{
                textAlign: 'center',
                padding: '2rem',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                Página no encontrada
            </p>
            <p style={{ marginBottom: '2rem' }}>
                Lo sentimos, la página que buscas no existe.
            </p>
            <Link href="/" style={{ textDecoration: 'none', color: '#0070f3', fontSize: '1.2rem' }}>
                Regresar a Inicio
            </Link>
        </div>
    )
}