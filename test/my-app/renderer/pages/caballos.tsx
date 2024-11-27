import { ThunderboltOutlined } from '@ant-design/icons';
import { Button, Card, Input } from 'antd';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

const CaballosPage: React.FC = () => {
    const [caballos, setCaballos] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        cargarCaballos();
    }, []);

    const cargarCaballos = async () => {
        try {
            const response = await axios.get('http://localhost:8000/horses');
            setCaballos(response.data);
        } catch (error) {
            console.error('Error al cargar caballos', error);
        }
    };

    const filtrarCaballos = () => {
        return caballos.filter((caballo: any) =>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtrarCaballos().map((caballo: any) => (
                    <Card
                        key={caballo.id}
                        title={caballo.name}
                        actions={[
                            <Button type="link" href={`/caballo/${caballo.id}`}>
                                Ver Detalles
                            </Button>,
                        ]}
                    >
                        <p>Valor Total: ${caballo.total_value}</p>
                        <p>Número de Cuotas: {caballo.number_of_installments}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default CaballosPage;
