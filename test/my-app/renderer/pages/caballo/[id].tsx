import { Card, Table, Tabs } from 'antd';
import axios from 'axios';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { TabPane } = Tabs;

const DetalleCaballo: React.FC = () => {
    const router = useRouter();
    const { id } = router.query;
    const [caballo, setCaballo] = useState<any>(null);
    const [compradores, setCompradores] = useState([]);
    const [instalments, setInstalments] = useState([]);

    useEffect(() => {
        if (id) {
            cargarCaballo(id);
        }
    }, [id]);

    const cargarCaballo = async (horseId: string | string[]) => {
        try {
            const response = await axios.get(`http://localhost:8000/horses/${horseId}`);
            setCaballo(response.data);
            setCompradores(response.data.buyers);
            // Cargar cuotas e información adicional si es necesario
        } catch (error) {
            console.error('Error al cargar caballo', error);
        }
    };

    if (!caballo) return <p>Cargando...</p>;

    return (
        <div className="p-6">
            <Card title={`Detalles de ${caballo.name}`}>
                <p>Valor Total: ${caballo.total_value}</p>
                <p>Información: {caballo.information}</p>
                <Tabs defaultActiveKey="1">
                    <TabPane tab="Compradores" key="1">
                        {compradores.map((comprador: any) => (
                            <Card key={comprador.id} className="mb-2">
                                <p>Nombre: {comprador.buyer_name}</p>
                                <p>Porcentaje: {comprador.percentage}%</p>
                                <p>Balance: ${comprador.balance}</p>
                            </Card>
                        ))}
                    </TabPane>
                    <TabPane tab="Cuotas" key="2">
                        <Table dataSource={instalments} columns={[/* Definir columnas */]} />
                    </TabPane>
                    {/* Agregar más pestañas si es necesario */}
                </Tabs>
            </Card>
        </div>
    );
};

export default DetalleCaballo;
