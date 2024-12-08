'use client'
// pages/detalleUsuario.tsx

import {
    Button,
    Card,
    message,
    Select,
    Spin,
    Table,
    Tabs,
} from 'antd';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Router, { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { TabPane } = Tabs;
const { Option } = Select;

interface Horse {
    id: number;
    name: string;
    total_value: number;
    [key: string]: any;
}

interface Installment {
    id: number;
    installment_id: number;
    amount: number;
    amount_paid: number;
    status: string;
    last_payment_date: string | null;
    [key: string]: any;
}

interface HorseBuyer {
    id: number;
    horse_id: number;
    buyer_id: number;
    percentage: number;
    join_date: string;
    horse?: Horse;
    installments?: Installment[];
    [key: string]: any;
}

interface User {
    id: number;
    name: string;
    email: string;
    dni: string;
    balance: number;
    [key: string]: any;
}

interface Transaction {
    id: number;
    type: string;
    concept: string;
    total_amount: number;
    notes?: string;
    horse_id?: number;
    user_id?: number;
    date: string;
    created_at: string;
    updated_at: string;
    horse_name?: string;
    mes: number;
    año: number;
}

const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const InstallmentsTable: React.FC<{ buyerInstallments: any[] }> = ({ buyerInstallments }) => {
    const [installments, setInstallments] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const handlePayInstallment = async (installmentId: number) => {
        try {
            const response = await axios.post(
                `http://localhost:8000/installments/pay/${installmentId}`
            );
            if (response.status === 200) {
                message.success('Cuota pagada exitosamente');
                Router.reload()
            } else {
                message.error('Error al pagar la cuota');
            }
        } catch (error) {
            console.error('Error al pagar la cuota', error);
            message.error('Error al pagar la cuota');
        }
    };

    useEffect(() => {
        const fetchInstallmentsDetails = async () => {
            setLoading(true);
            try {
                const detailedInstallments = await Promise.all(
                    buyerInstallments.map(async (installment) => {
                        const response = await axios.get(
                            `http://localhost:8000/installments/${installment.installment_id}`
                        );
                        return {
                            ...installment,
                            mes: response.data.mes,
                            año: response.data.año,
                        };
                    })
                );
                setInstallments(detailedInstallments);
            } catch (error) {
                console.error('Error fetching installment details:', error);
                message.error('Error al cargar detalles de las cuotas');
            } finally {
                setLoading(false);
            }
        };

        fetchInstallmentsDetails();
    }, [buyerInstallments]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Spin tip="Cargando cuotas..." />
            </div>
        );
    }

    return (
        <Table
            dataSource={installments}
            columns={[
                {
                    title: 'ID Cuota',
                    dataIndex: 'installment_id',
                    key: 'installment_id',
                    sorter: (a, b) => a.installment_id - b.installment_id,
                },
                {
                    title: 'Mes',
                    dataIndex: 'mes',
                    key: 'mes',
                    render: (mes: number) => monthNames[mes - 1], // Map `mes` to month name
                    sorter: (a, b) => a.mes - b.mes,
                },
                {
                    title: 'Año',
                    dataIndex: 'año',
                    key: 'año',
                    sorter: (a, b) => a.año - b.año,
                },
                {
                    title: 'Monto',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (amount: number) => `$${amount.toFixed(2)}`,
                    sorter: (a, b) => a.amount - b.amount,
                },
                {
                    title: 'Monto Pagado',
                    dataIndex: 'amount_paid',
                    key: 'amount_paid',
                    render: (amount: number) => `$${amount.toFixed(2)}`,
                    sorter: (a, b) => a.amount_paid - b.amount_paid,
                },
                {
                    title: 'Estado',
                    dataIndex: 'status',
                    key: 'status',
                    sorter: (a, b) => a.status.localeCompare(b.status),
                },
                {
                    title: 'Último Pago',
                    dataIndex: 'last_payment_date',
                    key: 'last_payment_date',
                    render: (date: string | null) =>
                        date ? new Date(date).toLocaleDateString() : '-',
                    sorter: (a, b) => {
                        const dateA = a.last_payment_date
                            ? new Date(a.last_payment_date).getTime()
                            : 0;
                        const dateB = b.last_payment_date
                            ? new Date(b.last_payment_date).getTime()
                            : 0;
                        return dateA - dateB;
                    },
                },
                {
                    title: 'Acciones',
                    key: 'acciones',
                    render: (text: any, record: Installment) =>
                        record.status === 'PENDIENTE' ? (
                            <Button
                                type="primary"
                                onClick={() => handlePayInstallment(record.id)}
                            >
                                Pagar
                            </Button>
                        ) : null,
                },

            ]}
            rowKey="id"
        />
    );
};

const DetalleUsuario: React.FC = () => {
    const router = useRouter();
    const { id } = router.query;

    const [usuario, setUsuario] = useState<User | null>(null);
    const [horseBuyers, setHorseBuyers] = useState<HorseBuyer[]>([]);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [selectedHorseBuyerId, setSelectedHorseBuyerId] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingUser, setLoadingUser] = useState<boolean>(true);
    const [loadingHorseBuyers, setLoadingHorseBuyers] = useState<boolean>(true);
    const [loadingInstallments, setLoadingInstallments] = useState<boolean>(false);
    const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // State for sorting and filtering
    const [installmentsSortedInfo, setInstallmentsSortedInfo] = useState<any>({});
    const [transactionsSortedInfo, setTransactionsSortedInfo] = useState<any>({});

    const [installmentsWithDetails, setInstallmentsWithDetails] = useState<Installment[]>([]);


    // Fetch user details
    useEffect(() => {
        if (id) {
            cargarUsuario(id as string);
        }
    }, [id]);

    // Fetch horse buyers, installments, and transactions when the user data is available
    useEffect(() => {
        if (usuario) {
            cargarHorseBuyers(usuario.id);
            cargarTransactions(usuario.id);
        }
    }, [usuario]);

    // Fetch installments when a horse buyer is selected
    useEffect(() => {
        if (selectedHorseBuyerId !== null) {
            cargarInstallments(selectedHorseBuyerId);
        }
    }, [selectedHorseBuyerId]);

    const cargarUsuario = async (userId: string) => {
        setLoadingUser(true);
        setError(null);
        try {
            const response = await axios.get(`http://localhost:8000/users/${userId}`);
            setUsuario(response.data);
        } catch (error) {
            console.error('Error al cargar usuario', error);
            setError('Error al cargar datos del usuario.');
        } finally {
            setLoadingUser(false);
        }
    };

    const cargarHorseBuyers = async (userId: number) => {
        setLoadingHorseBuyers(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:8000/horse-buyers/');
            const filteredHorseBuyers: HorseBuyer[] = response.data.filter(
                (buyer: HorseBuyer) => buyer.buyer_id === userId
            );

            // Fetch horse data for each horseBuyer in parallel
            const horseBuyerPromises = filteredHorseBuyers.map(async (horseBuyer) => {
                try {
                    const horseResponse = await axios.get(
                        `http://localhost:8000/horses/${horseBuyer.horse_id}`
                    );
                    return { ...horseBuyer, horse: horseResponse.data };
                } catch (error) {
                    console.error(
                        `Error fetching horse data for horseBuyer id ${horseBuyer.id}`,
                        error
                    );
                    return { ...horseBuyer, horse: null };
                }
            });

            const horseBuyersWithHorses = await Promise.all(horseBuyerPromises);
            setHorseBuyers(horseBuyersWithHorses);

            // Set first horse buyer as selected if available
            if (horseBuyersWithHorses.length > 0) {
                setSelectedHorseBuyerId(horseBuyersWithHorses[0].id);
            }
        } catch (error) {
            console.error('Error al cargar compradores de caballos', error);
            setError('Error al cargar compradores de caballos.');
            setHorseBuyers([]);
        } finally {
            setLoadingHorseBuyers(false);
        }
    };

    const cargarInstallments = async (horseBuyerId: number) => {
        setLoadingInstallments(true);
        setError(null);
        try {
            const response = await axios.get(
                `http://localhost:8000/horse-buyers/${horseBuyerId}`
            );
            setInstallments(response.data.installments || []);
        } catch (error) {
            console.error('Error al cargar cuotas', error);
            setError('Error al cargar cuotas.');
            setInstallments([]);
        } finally {
            setLoadingInstallments(false);
        }
    };



    const cargarTransactions = async (userId: number) => {
        setLoadingTransactions(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:8000/transactions/');
            const allTransactions: Transaction[] = response.data;

            // Filter transactions related to the user
            const userHorseIds = horseBuyers.map((buyer) => buyer.horse_id);

            // Filter the transactions
            const userTransactions = allTransactions.filter((transaction) => {
                return (
                    transaction.user_id === userId ||
                    (transaction.horse_id && userHorseIds.includes(transaction.horse_id))
                );
            });

            // Fetch horse names for transactions that involve a horse
            const horseIds = allTransactions
                .filter((t) => t.horse_id)
                .map((t) => t.horse_id) as number[];

            // Remove duplicates
            const uniqueHorseIds = Array.from(new Set(horseIds));

            const horsePromises = uniqueHorseIds.map(async (horseId) => {
                try {
                    const horseResponse = await axios.get(
                        `http://localhost:8000/horses/${horseId}`
                    );
                    return { id: horseId, name: horseResponse.data.name };
                } catch (error) {
                    console.error(`Error fetching horse data for horse id ${horseId}`, error);
                    return { id: horseId, name: 'Nombre no disponible' };
                }
            });

            const horses = await Promise.all(horsePromises);
            const horseMap = horses.reduce<{ [key: number]: string }>((map, horse) => {
                map[horse.id] = horse.name;
                return map;
            }, {});

            // Attach horse names to transactions
            const transactionsWithHorseNames = userTransactions.map((transaction) => ({
                ...transaction,
                horse_name: transaction.horse_id ? horseMap[transaction.horse_id] : null,
            }));

            setTransactions(transactionsWithHorseNames);
        } catch (error) {
            console.error('Error al cargar transacciones', error);
            setError('Error al cargar transacciones.');
        } finally {
            setLoadingTransactions(false);
        }
    };

    const eliminarUsuario = async () => {
        try {
            await axios.delete(`http://localhost:8000/users/${id}`);
            message.success('Usuario eliminado correctamente');
            router.push('/usuarios');
        } catch (error) {
            console.error('Error al eliminar usuario', error);
            message.error('Error al eliminar usuario');
        }
    };

    // Handle table changes for installments
    const handleInstallmentsTableChange = (pagination: any, filters: any, sorter: any) => {
        setInstallmentsSortedInfo(sorter);
    };

    // Handle table changes for transactions
    const handleTransactionsTableChange = (pagination: any, filters: any, sorter: any) => {
        setTransactionsSortedInfo(sorter);
    };

    // Export installments to PDF
    const exportInstallmentsToPDF = () => {
        const doc = new jsPDF();

        // Prepare data
        let data = installments.map((installment) => ({
            Cuota: installment.installment_id,
            Monto: `$${(installment.amount || 0).toFixed(2)}`,
            'Monto Pagado': `$${(installment.amount_paid || 0).toFixed(2)}`,
            Estado: installment.status,
            'Último Pago': installment.last_payment_date
                ? new Date(installment.last_payment_date).toLocaleDateString()
                : '-',
        }));

        // Apply sorting
        if (installmentsSortedInfo && installmentsSortedInfo.columnKey) {
            data.sort((a: any, b: any) => {
                const { columnKey, order } = installmentsSortedInfo;
                let comparison = 0;
                if (a[columnKey] > b[columnKey]) {
                    comparison = 1;
                } else if (a[columnKey] < b[columnKey]) {
                    comparison = -1;
                }
                return order === 'descend' ? -comparison : comparison;
            });
        }

        doc.autoTable({
            head: [['Cuota', 'Monto', 'Monto Pagado', 'Estado', 'Último Pago']],
            body: data.map((item) => [
                item.Cuota,
                item.Monto,
                item['Monto Pagado'],
                item.Estado,
                item['Último Pago'],
            ]),
        });

        doc.save('cuotas.pdf');
    };
    // Export transactions to PDF
    const exportTransactionsToPDF = () => {
        const doc = new jsPDF();

        // Prepare data
        let data = transactions.map((transaction) => ({
            Tipo: transaction.type,
            Concepto: transaction.concept,
            Monto: `$${transaction.total_amount.toLocaleString()}`,
            Caballo: transaction.horse_name || '-',
            Fecha: new Date(transaction.date).toLocaleDateString(),
        }));

        // Apply sorting
        if (transactionsSortedInfo && transactionsSortedInfo.columnKey) {
            data.sort((a: any, b: any) => {
                const { columnKey, order } = transactionsSortedInfo;
                let comparison = 0;
                if (a[columnKey] > b[columnKey]) {
                    comparison = 1;
                } else if (a[columnKey] < b[columnKey]) {
                    comparison = -1;
                }
                return order === 'descend' ? -comparison : comparison;
            });
        }

        doc.autoTable({
            head: [['Tipo', 'Concepto', 'Monto', 'Caballo', 'Fecha']],
            body: data.map((item) => [
                item.Tipo,
                item.Concepto,
                item.Monto,
                item.Caballo,
                item.Fecha,
            ]),
        });

        doc.save('transacciones.pdf');
    };

    if (loadingUser) {
        return (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Spin tip="Cargando usuario..." />
            </div>
        );
    }

    if (error) {
        return <p>{error}</p>;
    }

    if (!usuario) {
        return <p>Usuario no encontrado.</p>;
    }


    return (
        <div className="p-6">
            <Card
                title={`Perfil de ${usuario.name || ''}`}
                extra={
                    <Button onClick={eliminarUsuario} danger>
                        Eliminar
                    </Button>
                }
            >
                <p>Email: {usuario.email}</p>
                <p>DNI: {usuario.dni}</p>
                <p>Balance: ${usuario.balance?.toFixed(2) || '0.00'}</p>

                <Tabs defaultActiveKey="1">
                    <TabPane tab="Caballos" key="1">
                        {loadingHorseBuyers ? (
                            <Spin tip="Cargando caballos..." />
                        ) : horseBuyers.length > 0 ? (
                            horseBuyers.map((horseBuyer) => (
                                <Card
                                    key={horseBuyer.id}
                                    title={horseBuyer.horse?.name || 'Nombre no disponible'}
                                    className="mb-2"
                                >
                                    <p>
                                        Valor del Caballo: $
                                        {horseBuyer.horse?.total_value?.toFixed(2) || '0.00'}
                                    </p>
                                    <p>
                                        Porcentaje de Propiedad: {horseBuyer.percentage ?? 0}% (
                                        {horseBuyer.percentage && horseBuyer.horse?.total_value
                                            ? (
                                                (horseBuyer.percentage / 100) *
                                                horseBuyer.horse.total_value
                                            ).toFixed(2)
                                            : '0.00'}
                                        )
                                    </p>
                                    <p>
                                        Fecha de Compra:{' '}
                                        {new Date(horseBuyer.join_date).toLocaleDateString()}
                                    </p>
                                    <Button
                                        type="link"
                                        onClick={() => router.push(`/caballo/${horseBuyer.horse?.id}`)}
                                    >
                                        Ver Detalles del Caballo
                                    </Button>
                                </Card>
                            ))
                        ) : (
                            <p>No hay caballos asociados a este usuario.</p>
                        )}
                    </TabPane>
                    <TabPane tab="Cuotas" key="2">
                        <div className="mb-4 flex justify-between">
                            <Select
                                placeholder="Seleccionar Caballo"
                                value={selectedHorseBuyerId || undefined}
                                onChange={(value) => setSelectedHorseBuyerId(value)}
                                className="w-64"
                            >
                                {horseBuyers.map((horseBuyer) => (
                                    <Option key={horseBuyer.id} value={horseBuyer.id}>
                                        {horseBuyer.horse?.name || 'Caballo sin nombre'}
                                    </Option>
                                ))}
                            </Select>
                            <Button type="primary" onClick={exportInstallmentsToPDF}>
                                Exportar Cuotas a PDF
                            </Button>
                        </div>

                        <InstallmentsTable buyerInstallments={installments} />
                    </TabPane>
                    <TabPane tab="Transacciones" key="3">
                        <div className="mb-4 flex justify-end">
                            <Button type="primary" onClick={exportTransactionsToPDF}>
                                Exportar Transacciones a PDF
                            </Button>
                        </div>
                        {loadingTransactions ? (
                            <Spin tip="Cargando transacciones..." />
                        ) : transactions.length > 0 ? (
                            <Table
                                dataSource={transactions}
                                columns={[
                                    {
                                        title: 'Tipo',
                                        dataIndex: 'type',
                                        key: 'type',
                                        sorter: (a: Transaction, b: Transaction) =>
                                            a.type.localeCompare(b.type),
                                        sortOrder:
                                            transactionsSortedInfo.columnKey === 'type' &&
                                            transactionsSortedInfo.order,
                                    },
                                    {
                                        title: 'Concepto',
                                        dataIndex: 'concept',
                                        key: 'concept',
                                        sorter: (a: Transaction, b: Transaction) =>
                                            (a.concept || '').localeCompare(b.concept || ''),
                                        sortOrder:
                                            transactionsSortedInfo.columnKey === 'concept' &&
                                            transactionsSortedInfo.order,
                                    },
                                    {
                                        title: 'Monto total',
                                        dataIndex: 'total_amount',
                                        key: 'total_amount',
                                        render: (amount: number) => `$${amount.toLocaleString()}`,
                                        sorter: (a: Transaction, b: Transaction) =>
                                            a.total_amount - b.total_amount,
                                        sortOrder:
                                            transactionsSortedInfo.columnKey === 'total_amount' &&
                                            transactionsSortedInfo.order,
                                    },
                                    {
                                        title: 'Caballo',
                                        dataIndex: 'horse_name',
                                        key: 'horse_name',
                                        render: (text: string) => text || '-',
                                        sorter: (a: Transaction, b: Transaction) =>
                                            (a.horse_name || '').localeCompare(b.horse_name || ''),
                                        sortOrder:
                                            transactionsSortedInfo.columnKey === 'horse_name' &&
                                            transactionsSortedInfo.order,
                                    },
                                    {
                                        title: 'Fecha',
                                        key: 'fecha',
                                        render: (record: Transaction) => {
                                            const month = record.mes; // Assuming `mes` is an integer (1-12)
                                            const year = record.año; // Assuming `año` is the year
                                            if (!month || !year) return '-'; // Fallback if `mes` or `año` is missing
                                            return `${monthNames[month - 1]} ${year}`; // Map month and append year
                                        },
                                        sorter: (a: Transaction, b: Transaction) =>
                                            new Date(b.año, b.mes - 1).getTime() - new Date(a.año, a.mes - 1).getTime(),
                                        sortOrder: transactionsSortedInfo.columnKey === 'fecha' && transactionsSortedInfo.order,
                                    },
                                ]}
                                rowKey="id"
                                onChange={handleTransactionsTableChange}
                            />
                        ) : (
                            <p>No hay transacciones para este usuario.</p>
                        )}
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default DetalleUsuario;
