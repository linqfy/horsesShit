"use client"
import dynamic from 'next/dynamic';

const EditarClient = dynamic(() => import('./editar'), { ssr: false });


export default function EditarPage() {
    return <EditarClient />;
}