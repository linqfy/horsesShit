import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, Tabs, Button, Table } from 'antd';
import axios from 'axios';

const { TabPane } = Tabs;

const DetalleUsuario: React.FC = () => {
    const router = useRouter();
    const { id } = router.query;
    const [usuario, setUsuario] = useState<any>(null);
    const [caballos, setCaballos] = useState([]);
    const [instalments, setInstalments] = useState([]);

    useEffect(() => {
        if (id) {
            cargarUsuario(id);
        }
    }, [id]);

    const cargarUsuario = async (userId: string | string[]) => {
        try {
            const response = await axios.get(`http://localhost:8000/users/${userId}`);
            setUsuario(response.data);
            setCaballos(response.data.horses);
            // Cargar cuotas e información adicional si es necesario
        } catch (error) {
            console.error('Error al cargar usuario', error);
        }
    };

    const eliminarUsuario = async () => {
        try {
            await axios.delete(`http://localhost:8000/users/${id}`);
            router.push('/usuarios');
        } catch (error) {
            console.error('Error al eliminar usuario', error);
        }
    };

    if (!usuario) return <p>Cargando...</p>;

    return (
        <div className="p-6">
            <Card title={`Perfil de ${usuario.name}`} extra={<Button onClick={eliminarUsuario}>Eliminar</Button>}>
                <p>Email: {usuario.email}</p>
                <p>Teléfono: {usuario.phone}</p>
                <Tabs defaultActiveKey="1">
                    <TabPane tab="Caballos" key="1">
                        {caballos.map((caballo: any) => (
                            <Card key={caballo.id} title={caballo.name} className="mb-2">
                                <p>Valor: ${caballo.total_value}</p>
                                <Button type="link" href={`/caballo/${caballo.id}`}>
                                    Ver Detalles del Caballo
                                </Button>
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

export default DetalleUsuario;
