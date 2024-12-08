'use client'
import { ThunderboltOutlined } from '@ant-design/icons';
import { Button, Card, Input, Spin, message } from 'antd';
import axios from 'axios';
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

    useEffect(() => {
        cargarCaballos();
    }, []);

    const cargarCaballos = async () => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost:8000/horses');
            setCaballos(response.data);
        } catch (error) {
            console.error('Error al cargar caballos', error);
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
                                    onClick={() => (window.location.href = `/caballo/${caballo.id}`)}
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

export default CaballosPage;
