import { Button, Card, Select, Table, Tabs } from 'antd';
import axios from 'axios';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { TabPane } = Tabs;
const { Option } = Select;

const DetalleUsuario = () => {
    const router = useRouter();
    const { id } = router.query;
    const [usuario, setUsuario] = useState(null);
    const [horseBuyers, setHorseBuyers] = useState([]);
    const [instalments, setInstalments] = useState([]);
    const [selectedHorseBuyerId, setSelectedHorseBuyerId] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch user details
    useEffect(() => {
        if (id) {
            cargarUsuario(id);
            cargarHorseBuyers(id);
        }
    }, [id]);

    // Fetch installments when a horse buyer is selected
    useEffect(() => {
        if (selectedHorseBuyerId) {
            cargarInstalments(selectedHorseBuyerId);
        }
    }, [selectedHorseBuyerId]);

    const cargarUsuario = async (userId) => {
        try {
            const response = await axios.get(`http://localhost:8000/users/${userId}`);
            setUsuario(response.data);
        } catch (error) {
            console.error('Error al cargar usuario', error);
        }
    };

    const cargarHorseBuyers = async (userId) => {
        try {
            // Fetch all horse buyers
            const response = await axios.get('http://localhost:8000/horse-buyers/');
            const parsedUserId = Array.isArray(userId) ? parseInt(userId[0], 10) : parseInt(userId, 10);
            const filteredHorseBuyers = (response.data || []).filter((buyer) => buyer.buyer_id === parsedUserId);

            // Fetch horse data for each horseBuyer
            const horseBuyerPromises = filteredHorseBuyers.map(async (horseBuyer) => {
                try {
                    const horseResponse = await axios.get(`http://localhost:8000/horses/${horseBuyer.horse_id}`);
                    horseBuyer.horse = horseResponse.data; // Attach horse data to horseBuyer
                } catch (error) {
                    console.error(`Error fetching horse data for horseBuyer id ${horseBuyer.id}`, error);
                    horseBuyer.horse = null;
                }
                return horseBuyer;
            });

            // Wait for all horse data to be fetched
            const horseBuyersWithHorses = await Promise.all(horseBuyerPromises);
            setHorseBuyers(horseBuyersWithHorses);

            // Set first horse buyer as selected if available
            if (horseBuyersWithHorses.length > 0) {
                setSelectedHorseBuyerId(horseBuyersWithHorses[0].id);
            }
        } catch (error) {
            console.error('Error al cargar compradores de caballos', error);
            setHorseBuyers([]);
        } finally {
            setLoading(false);
        }
    };


    const cargarInstalments = async (horseBuyerId) => {
        try {
            const response = await axios.get(`http://localhost:8000/horse-buyers/${horseBuyerId}`);
            setInstalments(response.data.installments || []);
        } catch (error) {
            console.error('Error al cargar cuotas', error);
            setInstalments([]);
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

    if (!usuario || loading) return <p>Cargando...</p>;

    return (
        <div className="p-6">
            <Card
                title={`Perfil de ${usuario.name || ''}`}
                extra={<Button onClick={eliminarUsuario}>Eliminar</Button>}
            >
                <p>Email: {usuario.email}</p>
                <p>DNI: {usuario.dni}</p>
                <p>Balance: ${usuario.balance || 0}</p>

                <Tabs defaultActiveKey="1">
                    <TabPane tab="Caballos" key="1">
                        {horseBuyers.length > 0 ? (
                            horseBuyers.map((horseBuyer) => (
                                <Card key={horseBuyer.id} title={horseBuyer.horse?.name || 'Nombre no disponible'} className="mb-2">
                                    <p>Valor del Caballo: ${horseBuyer.horse?.total_value || 0}</p>
                                    <p>Porcentaje de Propiedad: {horseBuyer.percentage || 0}%</p>
                                    <p>Fecha de Ingreso: {new Date(horseBuyer.join_date).toLocaleDateString()}</p>
                                    <Button type="link" href={`/caballo/${horseBuyer.horse?.id}`}>
                                        Ver Detalles del Caballo
                                    </Button>
                                </Card>
                            ))
                        ) : (
                            <p>No hay caballos asociados a este usuario.</p>
                        )}
                    </TabPane>
                    <TabPane tab="Cuotas" key="2">
                        <div className="mb-4">
                            <Select
                                placeholder="Seleccionar Caballo"
                                value={selectedHorseBuyerId}
                                onChange={setSelectedHorseBuyerId}
                                className="w-64"
                            >
                                {horseBuyers.map((horseBuyer) => (
                                    <Option key={horseBuyer.id} value={horseBuyer.id}>
                                        {horseBuyer.horse?.name || 'Caballo sin nombre'}
                                    </Option>
                                ))}
                            </Select>
                        </div>

                        <Table
                            dataSource={instalments}
                            columns={[
                                {
                                    title: 'Cuota',
                                    dataIndex: 'installment_id',
                                    key: 'installment_id'
                                },
                                {
                                    title: 'Monto',
                                    dataIndex: 'amount',
                                    key: 'amount',
                                    render: (amount) => `$${(amount || 0).toFixed(2)}`
                                },
                                {
                                    title: 'Monto Pagado',
                                    dataIndex: 'amount_paid',
                                    key: 'amount_paid',
                                    render: (amount) => `$${(amount || 0).toFixed(2)}`
                                },
                                {
                                    title: 'Estado',
                                    dataIndex: 'status',
                                    key: 'status'
                                },
                                {
                                    title: 'Último Pago',
                                    dataIndex: 'last_payment_date',
                                    key: 'last_payment_date',
                                    render: (date) => date ? new Date(date).toLocaleDateString() : '-'
                                }
                            ]}
                            rowKey="id"
                        />
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default DetalleUsuario;