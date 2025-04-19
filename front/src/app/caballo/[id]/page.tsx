// pages/caballo/[id].tsx
"use client";

import {
    Button,
    Card,
    message,
    Select,
    Spin,
    Table,
    Tabs,
    Input,
} from 'antd';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useParams, useRouter } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';

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
    mes: number;
    año: number;
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
    starting_billing_year: number;
    creation_date: string;
    total_percentage: number;
    buyers: HorseBuyer[];
    transactions?: Transaction[];
    installments?: any[];
}

interface MonthlySummary {
    month: string;
    totalAmount: number;
    totalPaid: number;
}

interface BuyerSummary {
    buyer: HorseBuyer;
    monthlyPayments: {
        [monthKey: string]: {
            paid: number;
            total: number;
            status: 'paid' | 'overdue' | 'pending';
        };
    };
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
    user_name?: string | null; // Allow null and undefined
    mes: number;
    año: number;
    fecha_de_pago: string | null;
    fecha_de_efectividad: string | null;
    pagado: boolean | null;
}


const DetalleCaballo: React.FC = () => {
    const router = useRouter();
    const { id } = useParams();
    const [caballo, setCaballo] = useState<Horse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);

    // State for sorting and filtering
    const [installmentsSortedInfo, setInstallmentsSortedInfo] = useState<any>({});
    const [transactionsSortedInfo, setTransactionsSortedInfo] = useState<any>({});
    const [selectedTransactionMonth, setSelectedTransactionMonth] = useState<number | null>(null);
    const [selectedTransactionUser, setSelectedTransactionUser] = useState<number | null>(null);
    const [selectedTransactionType, setSelectedTransactionType] = useState<string | null>(null);
    const [selectedTransactionConcept, setSelectedTransactionConcept] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            //console.log('ID:', id);
            cargarCaballo(id as string);
            cargarTransactions(id as string);
        }
    }, [id]);

    const cargarCaballo = async (horseId: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:8000/horses/${horseId}`);
            if (!response.ok) {
                throw new Error('Error al cargar datos del caballo.');
            }
            const horseData: Horse = await response.json();

            // Fetch buyer names
            const buyerPromises = horseData.buyers.map(async (buyer) => {
                try {
                    const userResponse = await fetch(`http://localhost:8000/users/${buyer.buyer_id}`);
                    if (!userResponse.ok) {
                        throw new Error('Error al obtener datos del usuario.');
                    }
                    const userData = await userResponse.json();
                    return { ...buyer, buyer_name: userData.name };
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
        } catch (error: any) {
            console.error('Error al cargar caballo:', error);
            setError('Error al cargar datos del caballo.');
            message.error('Error al cargar datos del caballo.');
        } finally {
            setLoading(false);
        }
    };

    const cargarTransactions = async (horseId: string) => {
        setLoadingTransactions(true);
        try {
            await fetch(`http://localhost:8000/installments/check-overdue/`);
            const response = await fetch('http://localhost:8000/transactions/');
            if (!response.ok) {
                throw new Error('Error al cargar transacciones.');
            }
            const allTransactions: Transaction[] = await response.json();

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
                    const userResponse = await fetch(`http://localhost:8000/users/${userId}`);
                    if (!userResponse.ok) {
                        throw new Error('Error al obtener datos del usuario.');
                    }
                    const userData = await userResponse.json();
                    return { id: userId, name: userData.name };
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
        } catch (error: any) {
            console.error('Error al cargar transacciones:', error);
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
            //numer to string based on monthNames
            Mes: monthNames[installment.mes - 1] + ' ' + installment.año,
            Monto: `$${(installment.amount || 0).toFixed(2)}`,
            'Monto Pagado': `$${(installment.amount_paid || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
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

        doc.save(`cuotas - ${caballo?.name || 'Caballo'} - ${installmentsSortedInfo.horse_buyer_id} - ${new Date().toLocaleDateString()}`);
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
            Fecha: `${monthNames[transaction.mes - 1]} ${transaction.año}`,
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

    const getMonthlySummaryData = () => {
        if (!caballo) return { buyers: [], months: [] };

        // Generate month sequence based on horse's installments
        const months: string[] = [];
        const currentDate = new Date();
        const startMonth = caballo.starting_billing_month;
        const startYear = caballo.starting_billing_year;

        for (let i = 0; i < caballo.number_of_installments; i++) {
            const monthIndex = (startMonth + i) % 12;
            const year = startYear + Math.floor((startMonth + i) / 12);
            months.push(`${monthNames[monthIndex]} ${year}`);
        }

        // Calculate buyer summaries
        const buyerSummaries: BuyerSummary[] = caballo.buyers.map(buyer => {
            const monthlyPayments: Record<string, any> = {};

            // Ensure monthlyPayments is empty and accumulate installments per month
            //console.log(buyer);
            buyer.installments.forEach(installment => {
                console.log(`  - Installment: ${installment.mes}/${installment.año}, Paid: ${installment.amount_paid}, Total: ${installment.amount}`);
                const monthKey = `${monthNames[installment.mes - 1]} ${installment.año}`;
                console.log(monthKey, buyer.buyer_name, installment.installment_id);
                const status = installment.status === 'VENCIDO' ? 'overdue' :
                    installment.amount_paid >= installment.amount ? 'paid' : 'pending';

                if (!monthlyPayments[monthKey]) {
                    monthlyPayments[monthKey] = { paid: 0, total: 0, status: 'pending' };
                }
                monthlyPayments[monthKey].paid += installment.amount_paid;
                monthlyPayments[monthKey].total += installment.amount;
                monthlyPayments[monthKey].status = monthlyPayments[monthKey].paid >= monthlyPayments[monthKey].total
                    ? 'paid'
                    : status;
            });
            console.log('Monthly Payments:', buyer);


            return { buyer, monthlyPayments };
        });
        //console.log('Buyer Summaries:', buyerSummaries);

        return { buyerSummaries, months };
    };

    const [summaryData, setSummaryData] = useState<{ buyerSummaries: BuyerSummary[], months: string[] }>({ buyerSummaries: [], months: [] });

    const reloadSummaryData = () => {
        const newData = getMonthlySummaryData();
        setSummaryData(newData);
    };


    useEffect(() => {
        reloadSummaryData();
    }, [caballo]);

    const renderSummaryTable = () => {
        const { buyerSummaries, months } = summaryData;

        const columns = [
            {
                title: 'Comprador',
                dataIndex: ['buyer', 'buyer_name'],
                key: 'buyer',
            },
            {
                title: 'Porcentaje',
                dataIndex: ['buyer', 'percentage'],
                key: 'percentage',
                render: (val: number) => `${val}%`,
            },
            ...months.map(month => ({
                title: month,
                key: month,
                render: (_: any, record: BuyerSummary) => {
                    const payment = record.monthlyPayments[month];
                    if (!payment) return '-';

                    const color = payment.status === 'paid' ? 'green' :
                        payment.status === 'overdue' ? 'red' : 'inherit';

                    return (
                        <span style={{ color }}>
                            ${payment.paid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} / ${payment.total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        </span>
                    );
                },
            })),
        ];

        // Calculate totals
        const totals: any = { buyer: 'TOTALES', percentage: 'pagado // debido // total' };
        months.forEach(month => {
            totals[month] = {
                paid: buyerSummaries.reduce((sum, bs) =>
                    sum + (bs.monthlyPayments[month]?.paid || 0), 0),
                total: buyerSummaries.reduce((sum, bs) =>
                    sum + (bs.monthlyPayments[month]?.total || 0), 0)
            };
        });

        return (
            <>
                <Button onClick={reloadSummaryData} className="mb-4">
                    Actualizar Tabla
                </Button>
                <Table
                    columns={columns}
                    dataSource={buyerSummaries}
                    pagination={false}
                    summary={() => (
                        <Table.Summary.Row>
                            {columns.map((col, index) => {
                                if (index === 0) return <td key={col.key}>{totals.buyer}</td>;
                                if (index === 1) return <td key={col.key}>{totals.percentage}</td>;

                                const month = col.title as string;
                                return (
                                    <td key={col.key}>
                                        ${totals[month].paid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /
                                        ${(totals[month].total - totals[month].paid).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} /
                                        ${totals[month].total.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                    </td>
                                );
                            })}
                        </Table.Summary.Row>
                    )}
                />
            </>
        );
    };

    const uniqueUsers = React.useMemo(() => {
        const userMap = new Map<number, string>();
        transactions.forEach(t => {
            if (t.user_id) {
                userMap.set(t.user_id, t.user_name || 'Nombre no disponible');
            }
        });
        return Array.from(userMap, ([id, name]) => ({ id, name }));
    }, [transactions]);

    const filteredTransactions = React.useMemo(() => {
        return transactions.filter(t => {
            const matchesType = selectedTransactionType ? t.type === selectedTransactionType : true;
            const matchesMonth = selectedTransactionMonth ? t.mes === selectedTransactionMonth : true;
            const matchesConcept = selectedTransactionConcept ? t.concept?.includes(selectedTransactionConcept) : true;
            return matchesType && matchesMonth && matchesConcept;
        });
    }, [transactions, selectedTransactionType, selectedTransactionMonth, selectedTransactionConcept]);

    const exportSummaryToPDF = () => {
        const doc = new jsPDF('landscape', 'pt', 'a4');
        const { buyerSummaries, months } = getMonthlySummaryData();

        // Prepare headers
        const headers = ['Comprador', 'Porcentaje', ...months];

        // Prepare data
        const data = buyerSummaries.map(bs => [
            bs.buyer.buyer_name,
            `${bs.buyer.percentage}%`,
            ...months.map(month => {
                const payment = bs.monthlyPayments[month];
                return payment ?
                    `${payment.paid.toFixed(2)}/${payment.total.toFixed(2)}` :
                    '-';
            })
        ]);

        // Add totals row
        data.push([
            'TOTALES',
            '',
            ...months.map(month => {
                const totalPaid = buyerSummaries.reduce((sum, bs) =>
                    sum + (bs.monthlyPayments[month]?.paid || 0), 0);
                const totalAmount = buyerSummaries.reduce((sum, bs) =>
                    sum + (bs.monthlyPayments[month]?.total || 0), 0);
                return `${totalPaid.toFixed(2)}/${(totalAmount - totalPaid).toFixed(2)}/${totalAmount.toFixed(2)}`;
            })
        ]);

        doc.autoTable({
            head: [headers],
            body: data,
            theme: 'grid',
            styles: {
                cellPadding: 3,
                fontSize: 8,
            },
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 20 }
        });

        doc.save('resumen_caballo.pdf');
    };

    const handlePayEgreso = (transactionId: number) => {
        // Implement the logic to handle the payment of EGRESO transactions
        console.log(`Paying EGRESO transaction with ID: ${transactionId}`);
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
        <Suspense fallback={<Spin />}>
            <div className="p-6">
                <Card title={`Detalles de ${caballo.name}`}>
                    <p>Valor Total: ${caballo.total_value.toLocaleString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</p>
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
                                            onClick={() => router.push(`/usuario/${comprador.buyer_id}`)}
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
                                                title: 'Cuota',
                                                dataIndex: 'mes',
                                                render: (_: any, installment: Installment) =>
                                                    (monthNames[installment.mes - 1] || '') + ' ' + installment.año,
                                                key: 'mes',
                                                sorter: (a: Installment, b: Installment) =>
                                                    a.installment_id - b.installment_id,
                                                sortOrder:
                                                    installmentsSortedInfo.columnKey === 'mes' &&
                                                    installmentsSortedInfo.order,
                                            },
                                            {
                                                title: 'Monto',
                                                dataIndex: 'amount',
                                                key: 'amount',
                                                render: (amount: number) => `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
                                                sorter: (a: Installment, b: Installment) => a.amount - b.amount,
                                                sortOrder:
                                                    installmentsSortedInfo.columnKey === 'amount' &&
                                                    installmentsSortedInfo.order,
                                            },
                                            {
                                                title: 'Monto Pagado',
                                                dataIndex: 'amount_paid',
                                                key: 'amount_paid',
                                                render: (amount: number) => `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
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
                        <TabPane tab="Resumen" key="3">
                            <div className="mb-4 flex justify-end gap-4">
                                <Button type="primary" onClick={exportSummaryToPDF}>
                                    Exportar Resumen a PDF
                                </Button>
                            </div>
                            {renderSummaryTable()}
                        </TabPane>
                        <TabPane tab="Transacciones" key="4">
                            <div className="mb-4 flex justify-between">
                                <div className="flex gap-2">
                                    <Select
                                        placeholder="Filtrar por Mes"
                                        style={{ width: 150 }}
                                        value={selectedTransactionMonth !== null ? selectedTransactionMonth : undefined}
                                        onChange={(value) => setSelectedTransactionMonth(value)}
                                        allowClear
                                    >
                                        {monthNames.map((month, index) => (
                                            <Select.Option key={index + 1} value={index + 1}>
                                                {month}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <Select
                                        placeholder="Filtrar por Usuario"
                                        style={{ width: 150 }}
                                        value={selectedTransactionUser !== null ? selectedTransactionUser : undefined}
                                        onChange={(value) => setSelectedTransactionUser(value)}
                                        allowClear
                                    >
                                        {uniqueUsers.map(user => (
                                            <Select.Option key={user.id} value={user.id}>
                                                {user.name}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <Select
                                        placeholder="Filtrar por Tipo"
                                        style={{ width: 150 }}
                                        value={selectedTransactionType || undefined}
                                        onChange={(value) => setSelectedTransactionType(value)}
                                        allowClear
                                    >
                                        {['INGRESO', 'EGRESO', 'PREMIO', 'PAGO'].map(type => (
                                            <Select.Option key={type} value={type}>
                                                {type}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                    <Input
                                        placeholder="Filtrar por Concepto"
                                        style={{ width: 150 }}
                                        value={selectedTransactionConcept || ''}
                                        onChange={(e) => setSelectedTransactionConcept(e.target.value)}
                                        allowClear
                                    />
                                </div>
                                <Button type="primary" onClick={exportTransactionsToPDF}>
                                    Exportar Transacciones a PDF
                                </Button>
                            </div>

                            {loadingTransactions ? (
                                <Spin tip="Cargando transacciones..." />
                            ) : filteredTransactions.length > 0 ? (
                                <Table
                                    dataSource={filteredTransactions}
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
                                            render: (amount: number) => `$${amount.toLocaleString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
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
                                        {
                                            title: 'Mes',
                                            dataIndex: 'mes',
                                            key: 'mes',
                                            render: (mes: number) => monthNames[mes - 1],
                                            sorter: (a: Transaction, b: Transaction) => a.mes - b.mes,
                                        },
                                        {
                                            title: 'Año',
                                            dataIndex: 'año',
                                            key: 'año',
                                            sorter: (a: Transaction, b: Transaction) => a.año - b.año,
                                        },
                                        {
                                            title: 'Fecha Pago',
                                            dataIndex: 'fecha_de_pago',
                                            key: 'fecha_de_pago',
                                            render: (date: string | null) => date ? new Date(date).toLocaleDateString() : '-',
                                        },
                                        {
                                            title: 'Pagado',
                                            dataIndex: 'pagado',
                                            key: 'pagado',
                                            render: (pagado: boolean | null) => pagado ? 'Sí' : 'No',
                                        }
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
        </Suspense>
    );
};

export default DetalleCaballo;
