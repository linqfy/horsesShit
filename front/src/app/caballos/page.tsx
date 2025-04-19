// pages/caballos.tsx
"use client";

import { Button, Card, Input, Spin, message } from 'antd';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface Horse {
    id: number;
    name: string;
    total_value: number;
    number_of_installments: number;
    [key: string]: any;
}

const CaballosPage: React.FC = () => {
    const [caballos, setCaballos] = useState<Horse[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Asegurarse de que el código solo se ejecute en el cliente
        if (typeof window === 'undefined') {
            return;
        }
        cargarCaballos();
    }, []);

    const cargarCaballos = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/horses');
            if (!response.ok) {
                throw new Error('Error al cargar caballos.');
            }
            const data: Horse[] = await response.json();
            setCaballos(data);
        } catch (error: any) {
            console.error('Error al cargar caballos:', error);
            setError('Error al cargar caballos.');
            message.error('Error al cargar caballos.');
        } finally {
            setLoading(false);
        }
    };

    const filtrarCaballos = () => {
        return caballos.filter((caballo) =>
            caballo.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const verDetalles = (id: number) => {
        router.push(`/caballo/${id}`);
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Gestión de Caballos</h1>
            <div className="flex items-center mb-4">
                <Input
                    placeholder="Buscar caballos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mr-4"
                />
                {/* Agregar botones o filtros adicionales si es necesario */}
            </div>
            {loading ? (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <Spin tip="Cargando caballos..." />
                </div>
            ) : error ? (
                <p>{error}</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtrarCaballos().map((caballo) => (
                        <Card
                            key={caballo.id}
                            title={caballo.name}
                            actions={[
                                <Button
                                    type="link"
                                    onClick={() => verDetalles(caballo.id)}
                                    key="details"
                                >
                                    Ver Detalles
                                </Button>,
                            ]}
                        >
                            <p>Valor Total: ${caballo.total_value.toLocaleString()}</p>
                            <p>Número de Cuotas: {caballo.number_of_installments}</p>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default CaballosPage;
