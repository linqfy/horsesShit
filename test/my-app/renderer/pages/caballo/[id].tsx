// pages/detalleCaballo.tsx

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
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { TabPane } = Tabs;
const { Option } = Select;
const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface Installment {
    id: number;
    horse_buyer_id: number;
    installment_id: number;
    amount: number;
    amount_paid: number;
    status: string;
    last_payment_date: string | null;
    created_at: string;
    updated_at: string;
    payments: any[];
}

interface HorseBuyer {
    id: number;
    horse_id: number;
    buyer_id: number;
    percentage: number;
    active: boolean;
    join_date: string;
    updated_at: string;
    balance: number;
    installments: Installment[];
    buyer_name?: string;
}

interface Horse {
    id: number;
    name: string;
    information: string | null;
    image_url: string | null;
    total_value: number;
    number_of_installments: number;
    starting_billing_month: number;
    creation_date: string;
    total_percentage: number;
    buyers: HorseBuyer[];
    transactions?: Transaction[];
    installments?: any[];
}

interface Transaction {
    id: number;
    type: 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';
    concept: string | null;
    total_amount: number;
    notes?: string | null;
    horse_id?: number;
    user_id?: number;
    date: string;
    created_at: string;
    updated_at: string;
    user_name?: string;
    mes: number;
    año: number;

}

const DetalleCaballo: React.FC = () => {
    const router = useRouter();
    const { id } = router.query;
    const [caballo, setCaballo] = useState<Horse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);

    // State for sorting and filtering
    const [installmentsSortedInfo, setInstallmentsSortedInfo] = useState<any>({});
    const [transactionsSortedInfo, setTransactionsSortedInfo] = useState<any>({});

    useEffect(() => {
        if (id) {
            cargarCaballo(id as string);
            cargarTransactions(id as string);
        }
    }, [id]);

    const cargarCaballo = async (horseId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`http://localhost:8000/horses/${horseId}`);
            const horseData: Horse = response.data;

            // Fetch buyer names
            const buyerPromises = horseData.buyers.map(async (buyer) => {
                try {
                    const userResponse = await axios.get(`http://localhost:8000/users/${buyer.buyer_id}`);
                    return { ...buyer, buyer_name: userResponse.data.name };
                } catch (err) {
                    console.error(`Error fetching user data for buyer_id ${buyer.buyer_id}`, err);
                    return { ...buyer, buyer_name: 'Nombre no disponible' };
                }
            });

            horseData.buyers = await Promise.all(buyerPromises);
            setCaballo(horseData);

            // Set default selected buyer (first buyer)
            if (horseData.buyers.length > 0) {
                setSelectedBuyerId(horseData.buyers[0].id);
            }
        } catch (error) {
            console.error('Error al cargar caballo', error);
            setError('Error al cargar datos del caballo.');
        } finally {
            setLoading(false);
        }
    };

    const cargarTransactions = async (horseId: string) => {
        setLoadingTransactions(true);
        try {
            const response = await axios.get('http://localhost:8000/transactions/');
            const allTransactions: Transaction[] = response.data;

            // Filter transactions related to the horse
            const horseTransactions = allTransactions.filter(
                (transaction) => transaction.horse_id === parseInt(horseId)
            );

            // Fetch user names for transactions that involve a user
            const userIds = horseTransactions
                .filter((t) => t.user_id)
                .map((t) => t.user_id) as number[];

            // Remove duplicates
            const uniqueUserIds = Array.from(new Set(userIds));

            const userPromises = uniqueUserIds.map(async (userId) => {
                try {
                    const userResponse = await axios.get(`http://localhost:8000/users/${userId}`);
                    return { id: userId, name: userResponse.data.name };
                } catch (error) {
                    console.error(`Error fetching user data for user id ${userId}`, error);
                    return { id: userId, name: 'Nombre no disponible' };
                }
            });

            const users = await Promise.all(userPromises);
            const userMap = users.reduce<{ [key: number]: string }>((map, user) => {
                map[user.id] = user.name;
                return map;
            }, {});

            // Attach user names to transactions
            const transactionsWithUserNames = horseTransactions.map((transaction) => ({
                ...transaction,
                user_name: transaction.user_id ? userMap[transaction.user_id] : null,
            }));

            setTransactions(transactionsWithUserNames);
        } catch (error) {
            console.error('Error al cargar transacciones', error);
            message.error('Error al cargar transacciones');
        } finally {
            setLoadingTransactions(false);
        }
    };

    // Filter installments based on selected buyer
    const getFilteredInstallments = (): Installment[] => {
        if (!caballo || !selectedBuyerId) return [];
        const selectedBuyer = caballo.buyers.find((buyer) => buyer.id === selectedBuyerId);
        return selectedBuyer?.installments || [];
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
        let data = getFilteredInstallments().map((installment) => ({
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
            Concepto: transaction.concept || '',
            Monto: `$${transaction.total_amount.toLocaleString()}`,
            Usuario: transaction.user_name || '-',
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
            head: [['Tipo', 'Concepto', 'Monto', 'Usuario', 'Fecha']],
            body: data.map((item) => [
                item.Tipo,
                item.Concepto,
                item.Monto,
                item.Usuario,
                item.Fecha,
            ]),
        });

        doc.save('transacciones.pdf');
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Spin tip="Cargando caballo..." />
            </div>
        );
    }

    if (error) {
        return <p>{error}</p>;
    }

    if (!caballo) {
        return <p>Caballo no encontrado.</p>;
    }

    return (
        <div className="p-6">
            <Card title={`Detalles de ${caballo.name}`}>
                <p>Valor Total: ${caballo.total_value.toLocaleString()}</p>
                <p>Información: {caballo.information || '-'}</p>
                <Tabs defaultActiveKey="1">
                    <TabPane tab="Compradores" key="1">
                        {caballo.buyers.length > 0 ? (
                            caballo.buyers.map((comprador) => (
                                <Card key={comprador.id} className="mb-2">
                                    <p>Nombre: {comprador.buyer_name || 'Nombre no disponible'}</p>
                                    <p>Porcentaje: {comprador.percentage}%</p>
                                    <Button
                                        type="link"
                                        onClick={() => router.push(`/detalle-usuario/${comprador.buyer_id}`)}
                                    >
                                        Ver Detalles del Usuario
                                    </Button>
                                </Card>
                            ))
                        ) : (
                            <p>No hay compradores para este caballo.</p>
                        )}
                    </TabPane>
                    <TabPane tab="Cuotas" key="2">
                        {caballo.buyers.length > 0 ? (
                            <>
                                <div className="mb-4 flex justify-between">
                                    <Select
                                        placeholder="Seleccionar Comprador"
                                        value={selectedBuyerId}
                                        onChange={(value) => setSelectedBuyerId(value)}
                                        style={{ width: 200 }}
                                    >
                                        {caballo.buyers.map((buyer) => (
                                            <Option key={buyer.id} value={buyer.id}>
                                                {buyer.buyer_name || 'Nombre no disponible'}
                                            </Option>
                                        ))}
                                    </Select>
                                    <Button type="primary" onClick={exportInstallmentsToPDF}>
                                        Exportar Cuotas a PDF
                                    </Button>
                                </div>
                                <Table
                                    dataSource={getFilteredInstallments()}
                                    columns={[
                                        {
                                            title: 'ID Cuota',
                                            dataIndex: 'installment_id',
                                            key: 'installment_id',
                                            sorter: (a: Installment, b: Installment) =>
                                                a.installment_id - b.installment_id,
                                            sortOrder:
                                                installmentsSortedInfo.columnKey === 'installment_id' &&
                                                installmentsSortedInfo.order,
                                        },
                                        {
                                            title: 'Monto',
                                            dataIndex: 'amount',
                                            key: 'amount',
                                            render: (amount: number) => `$${amount.toFixed(2)}`,
                                            sorter: (a: Installment, b: Installment) => a.amount - b.amount,
                                            sortOrder:
                                                installmentsSortedInfo.columnKey === 'amount' &&
                                                installmentsSortedInfo.order,
                                        },
                                        {
                                            title: 'Monto Pagado',
                                            dataIndex: 'amount_paid',
                                            key: 'amount_paid',
                                            render: (amount: number) => `$${amount.toFixed(2)}`,
                                            sorter: (a: Installment, b: Installment) =>
                                                a.amount_paid - b.amount_paid,
                                            sortOrder:
                                                installmentsSortedInfo.columnKey === 'amount_paid' &&
                                                installmentsSortedInfo.order,
                                        },
                                        {
                                            title: 'Estado',
                                            dataIndex: 'status',
                                            key: 'status',
                                            sorter: (a: Installment, b: Installment) =>
                                                a.status.localeCompare(b.status),
                                            sortOrder:
                                                installmentsSortedInfo.columnKey === 'status' &&
                                                installmentsSortedInfo.order,
                                        },
                                        {
                                            title: 'Último Pago',
                                            dataIndex: 'last_payment_date',
                                            key: 'last_payment_date',
                                            render: (date: string | null) =>
                                                date ? new Date(date).toLocaleDateString() : '-',
                                            sorter: (a: Installment, b: Installment) => {
                                                const dateA = a.last_payment_date
                                                    ? new Date(a.last_payment_date).getTime()
                                                    : 0;
                                                const dateB = b.last_payment_date
                                                    ? new Date(b.last_payment_date).getTime()
                                                    : 0;
                                                return dateA - dateB;
                                            },
                                            sortOrder:
                                                installmentsSortedInfo.columnKey === 'last_payment_date' &&
                                                installmentsSortedInfo.order,
                                        },
                                    ]}
                                    rowKey="id"
                                    onChange={handleInstallmentsTableChange}
                                />
                            </>
                        ) : (
                            <p>No hay compradores para mostrar cuotas.</p>
                        )}
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
                                        title: 'Monto',
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
                                        title: 'Usuario',
                                        dataIndex: 'user_name',
                                        key: 'user_name',
                                        render: (text: string, record: Transaction) =>
                                            record.user_id ? (
                                                <Button
                                                    type="link"
                                                    onClick={() => router.push(`/usuario/${record.user_id}`)}
                                                >
                                                    {text}
                                                </Button>
                                            ) : (
                                                '-'
                                            ),
                                        sorter: (a: Transaction, b: Transaction) =>
                                            (a.user_name || '').localeCompare(b.user_name || ''),
                                        sortOrder:
                                            transactionsSortedInfo.columnKey === 'user_name' &&
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
                            <p>No hay transacciones para este caballo.</p>
                        )}
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default DetalleCaballo;
