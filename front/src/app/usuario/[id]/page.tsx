'use client';
// pages/usuario/[id].tsx

import {
    Button,
    Card,
    Checkbox,
    Collapse,
    Form,
    InputNumber,
    message,
    Modal,
    Select,
    Spin,
    Table,
    Tabs,
    Input,
    DatePicker
} from 'antd';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Router, { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';

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
    mes: number;
    año: number;
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
    pagado: boolean;
    created_at: string;
    updated_at: string;
    horse_name?: string | null;
    mes: number;
    año: number;
}

const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const InstallmentsTable: React.FC<{ buyerInstallments: any[] }> = ({ buyerInstallments }) => {
    const router = useRouter();
    const [installments, setInstallments] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const [payModalVisible, setPayModalVisible] = useState(false);
    const [currentInstallment, setCurrentInstallment] = useState<any>(null);
    const [payAmount, setPayAmount] = useState<number>(0);
    const [deductFromBalance, setDeductFromBalance] = useState<boolean>(false);

    const openPayModal = (installment: any) => {
        setCurrentInstallment(installment);
        setPayAmount(installment.amount); // default to full installment amount
        setDeductFromBalance(false);
        setPayModalVisible(true);
    };

    const handleConfirmPay = async () => {
        if (!currentInstallment) return;
        try {
            const response = await axios.post(
                `http://localhost:8000/installments/pay/${currentInstallment.id}`,
                {
                    amount: parseFloat(payAmount.toFixed(2)),
                    deduct_from_balance: deductFromBalance,
                }
            );
            if (response.status === 200) {
                message.success('Cuota pagada exitosamente');
                setPayModalVisible(false);
                router.refresh();
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
        <>
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
                            record.status !== 'PAGADO' ? (
                                <Button
                                    type="primary"
                                    onClick={() => openPayModal(record)}
                                >
                                    Pagar
                                </Button>
                            ) : null,
                    },

                ]}
                rowKey="id"
            />
            <Modal
                title="Pagar Cuota"
                visible={payModalVisible}
                onOk={handleConfirmPay}
                onCancel={() => setPayModalVisible(false)}
                okText="Confirmar Pago"
            >
                <Form layout="vertical">
                    <Form.Item label="Monto a pagar">
                        <InputNumber
                            min={0}
                            max={currentInstallment?.amount || 0}
                            value={payAmount}
                            onChange={(value) => setPayAmount(value || 0)}
                            formatter={(value) => `$ ${value}`}
                            parser={(value) =>
                                value ? parseFloat(value.replace(/\$\s?|(,*)/g, '')) : 0
                            }
                            precision={2}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Checkbox
                            checked={deductFromBalance}
                            onChange={(e) => setDeductFromBalance(e.target.checked)}
                            defaultChecked={true}
                        >
                            Deducir del balance del usuario
                        </Checkbox>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

const DetalleUsuario: React.FC = () => {
    const router = useRouter();
    const { id } = useParams();

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
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    const handleMonthChange = (month: number | null) => {
        setSelectedMonth(month);
    };

    const handleYearChange = (year: number | null) => {
        setSelectedYear(year);
    };

    // Add filter state for transaction search
    const [filterType, setFilterType] = useState<string | undefined>(undefined);
    const [filterConcept, setFilterConcept] = useState<string>('');
    const [filterDate, setFilterDate] = useState<any>(null);

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

            const horseBuyersWithData = await Promise.all(
                filteredHorseBuyers.map(async (horseBuyer) => {
                    try {
                        // Fetch horse details
                        const horseResponse = await axios.get(
                            `http://localhost:8000/horses/${horseBuyer.horse_id}`
                        );
                        // Fetch installments for this horse buyer
                        const installmentsResponse = await axios.get(
                            `http://localhost:8000/horse-buyers/${horseBuyer.id}`
                        );
                        installmentsResponse.data = installmentsResponse.data.installments;
                        return {
                            ...horseBuyer,
                            horse: horseResponse.data,
                            installments: installmentsResponse.data
                        };
                    } catch (error) {
                        console.error(`Error fetching data for horse ${horseBuyer.horse_id}`, error);
                        return { ...horseBuyer, horse: null, installments: [] };
                    }
                })
            );

            setHorseBuyers(horseBuyersWithData);
            setSelectedHorseBuyerId(horseBuyersWithData[0]?.id ?? null);
        } catch (error) {
            console.error('Error al cargar compradores de caballos', error);
            setError('Error al cargar compradores de caballos.');
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
            const response = await fetch(`http://localhost:8000/transactions?skip=0&limit=999999999999&paid_user_id=${userId}`);
            if (!response.ok) {
                throw new Error('Error al cargar transacciones.');
            }
            const allTransactions = (await response.json()) as Transaction[];
            // Filter transactions related to the user
            const userHorseIds = (horseBuyers || []).map((buyer) => buyer.horse_id);

            console.log('allTransactions', allTransactions);
            console.log('userHorseIds', userHorseIds);

            // Filter the transactions
            const userTransactions = allTransactions.filter((transaction) => {
                // Include direct user INGRESO/EGRESO/PREMIO/PAGO
                if (transaction.user_id === userId || transaction.type === 'EGRESO' || transaction.type === 'PREMIO') {
                    return true;
                }
                // Include transactions for user’s horses (INGRESO/EGRESO/PREMIO)
                if (
                    transaction.horse_id &&
                    userHorseIds.includes(transaction.horse_id) &&
                    ['INGRESO', 'EGRESO', 'PREMIO'].includes(transaction.type)
                ) {
                    return true;
                }
                // Include PAGO if you want all users (or if user is admin - adjust as needed)
                if (transaction.type === 'PAGO') {
                    return true;
                }
                return false;
            })
                .map((transaction) => {
                    if (transaction.horse_id && userHorseIds.includes(transaction.horse_id)) {
                        const hb = horseBuyers.find((h) => h.horse_id === transaction.horse_id);
                        if (hb) {
                            return {
                                ...transaction,
                                user_portion: transaction.total_amount * (hb.percentage / 100),
                            };
                        }
                    }
                    return transaction;
                });

            console.log('userTransactions', userTransactions);

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

    // Handler to mark egreso as paid
    const handleMarkEgresoPaid = async (transactionId: number) => {
        try {
            setLoadingTransactions(true);
            const response = await fetch(
                `http://localhost:8000/transaction/egresoPaid/`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ transaction_id: transactionId, user_id: usuario?.id })
                }
            );
            
            if (!response.ok) {
                throw new Error(`Error marking egreso as paid ${response.statusText} (${transactionId} ${usuario?.id})`);
            }
            message.success('Egreso marcado como pagado');
            cargarTransactions(usuario?.id!);
        } catch (error) {
            console.error('Error marcando egreso como pagado', error);
            message.error('Error marcando egreso como pagado');
        } finally {
            setLoadingTransactions(false);
        }
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

        // Filter by selected month/year
        let filteredTransactions = transactions;
        if (transactionsSortedInfo?.month) {
            filteredTransactions = filteredTransactions.filter(
                (t) => t.mes === transactionsSortedInfo.month
            );
        }
        if (transactionsSortedInfo?.year) {
            filteredTransactions = filteredTransactions.filter(
                (t) => t.año === transactionsSortedInfo.year
            );
        }

        // Prepare data
        let data = filteredTransactions.map((transaction) => ({
            Tipo: transaction.type,
            Concepto: transaction.concept,
            Monto: `$${transaction.total_amount.toLocaleString()}`,
            Caballo: transaction.horse_name || '-',
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

    const exportAccountStatusToPDF = () => {
        const doc = new jsPDF();
        let yPos = 10;
    
        // Initialize totals
        let totalEgresos = 0;
        let totalCuotas = 0;
        
        // Initialize arrays to collect all expenses and installments
        let allEgresos: any[] = [];
        let allInstallments: any[] = [];
    
        // Get user's balance
        const saldoUser = usuario?.balance || 0;
        
        horseBuyers.forEach((horseBuyer) => {
            // Get all unpaid expenses (including current month's)
            const unpaidEgresos = transactions.filter(t =>
                t.type === 'EGRESO' &&
                t.pagado === false &&
                t.horse_id === horseBuyer.horse_id
            );
    
            const unpaidInstallments = horseBuyer.installments?.filter(inst =>
                inst.status === 'VENCIDO' || inst.status === 'PARCIAL' || 
                inst.status === 'OVERDUE' || inst.status === 'PARTIAL' || 
                (inst.mes === new Date().getMonth() + 1 && 
                 inst.año === new Date().getFullYear() && 
                 (inst.status === 'PENDIENTE' || inst.status === 'PENDING'))
            ) || [];
    
            // Calculate totals for this horse
            const sumEgresos = unpaidEgresos.reduce((acc, eg) => acc + eg.total_amount, 0);
            const sumInstallments = unpaidInstallments.reduce((acc, inst) => acc + inst.amount, 0);
            totalEgresos += sumEgresos;
            totalCuotas += sumInstallments;
    
            // Format expenses with horse names
            const formattedEgresos = unpaidEgresos.map(eg => ({
                ...eg,
                horseName: horseBuyer.horse?.name || 'Sin nombre'
            }));
            
            // Add to master lists
            allEgresos = [...allEgresos, ...formattedEgresos];
            
            // Add installments with horse name
            const installmentsWithHorse = unpaidInstallments.map(inst => ({
                ...inst,
                horseName: horseBuyer.horse?.name || 'Sin nombre'
            }));
            
            allInstallments = [...allInstallments, ...installmentsWithHorse];
        });
        
        // Add title to PDF
        doc.setFontSize(16);
        doc.text('Estado de Cuenta', 10, yPos);
        yPos += 15;
    
        // Add user balance as a separate entry at the beginning
        if (saldoUser > 0) {
            // Add saldo entry as first item in tables
            allEgresos = [{
                type: 'SALDO',
                concept: 'Saldo de cuenta',
                total_amount: saldoUser,
                horseName: '-',
                mes: new Date().getMonth() + 1,
                año: new Date().getFullYear()
            }, ...allEgresos];
        }
        
        // Create one consolidated table for all egresos
        if (allEgresos.length > 0) {
            doc.setFontSize(14);
            doc.text('Egresos Pendientes:', 10, yPos);
            yPos += 8;
            
            const egresosData = allEgresos.map(eg => [
                eg.type,
                eg.horseName,
                eg.concept || '-',
                `$${eg.total_amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
                `${monthNames[eg.mes - 1]} ${eg.año}`
            ]);
    
            (doc as any).autoTable({
                startY: yPos,
                head: [['Type','Caballo', 'Concepto', 'Monto', 'Fecha']],
                body: egresosData,
                theme: 'plain'
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }
        
        // Create one consolidated table for all installments
        if (allInstallments.length > 0) {
            doc.setFontSize(14);
            doc.text('Cuotas Pendientes:', 10, yPos);
            yPos += 8;
            
            const installmentsData = allInstallments.map(inst => [
                inst.horseName,
                `${monthNames[inst.mes - 1]} ${inst.año}`,
                `$${inst.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
                inst.status
            ]);
    
            (doc as any).autoTable({
                startY: yPos,
                head: [['Caballo', 'Mes/Año', 'Monto', 'Estado']],
                body: installmentsData,
                theme: 'plain'
            });
            yPos = (doc as any).lastAutoTable.finalY + 15;
        }
    
        // Add totals at the end
        doc.setFontSize(14);
        doc.text('Resumen General', 10, yPos);
        yPos += 10;
    
        doc.setFontSize(12);
        const formatWithDots = (value: number) =>
            value
            .toFixed(2)
            .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        doc.text(`Saldo Actual: $${formatWithDots(saldoUser)}`, 10, yPos);
        yPos += 10;
        doc.text(`Total Egresos: $${formatWithDots(totalEgresos)}`, 10, yPos);
        yPos += 10;
        doc.text(`Total Cuotas: $${formatWithDots(totalCuotas)}`, 10, yPos);
        yPos += 10;
        doc.text(`Gran Total: $${formatWithDots((totalEgresos + totalCuotas) - saldoUser)}`, 10, yPos);
    
        doc.save('estado_de_cuenta.pdf');
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
                <p>Saldo: ${String(usuario.balance).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</p>

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
                                        {horseBuyer.horse?.total_value?.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '0.00'}
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
                        <div className="mb-4 flex space-x-2">
                            <Select
                                placeholder="Tipo"
                                allowClear
                                value={filterType}
                                onChange={(value) => setFilterType(value)}
                                className="w-48"
                            >
                                <Option value="INGRESO">Ingreso</Option>
                                <Option value="EGRESO">Egreso</Option>
                                <Option value="PREMIO">Premio</Option>
                                <Option value="PAGO">Pago</Option>
                            </Select>
                            <Input
                                placeholder="Concepto"
                                value={filterConcept}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterConcept(e.target.value)}
                                className="w-64"
                            />
                            <DatePicker
                                placeholder="Fecha"
                                value={filterDate}
                                onChange={(date) => setFilterDate(date)}
                            />
                            <Button onClick={() => { setFilterType(undefined); setFilterConcept(''); setFilterDate(null); }}>
                                Limpiar Filtros
                            </Button>
                        </div>
                        <div className="mb-4 flex justify-between">
                            <Button onClick={() => cargarTransactions(usuario.id)}>
                                Actualizar
                            </Button>
                            <Select
                                placeholder="Seleccionar Mes"
                                onChange={(value) => setTransactionsSortedInfo({ ...transactionsSortedInfo, columnKey: 'fecha', month: value })}
                                className="w-64"
                            >
                                {monthNames.map((month, index) => (
                                    <Option key={index + 1} value={index + 1}>
                                        {month}
                                    </Option>
                                ))}
                            </Select>
                            <Select
                                placeholder="Seleccionar Año"
                                onChange={(value) => setTransactionsSortedInfo({ ...transactionsSortedInfo, columnKey: 'fecha', year: value })}
                                className="w-64"
                            >
                                {[...new Set(transactions.map(transaction => transaction.año))].map(year => (
                                    <Option key={year} value={year}>
                                        {year}
                                    </Option>
                                ))}
                            </Select>
                            <button
                                onClick={() => setTransactionsSortedInfo({ ...transactionsSortedInfo, month: undefined, year: undefined })}
                                className="ml-2 px-2 py-1 bg-gray-200 rounded"
                            >
                                Quitar Filtros
                            </button>
                        </div>
                        {loadingTransactions ? (
                            <Spin tip="Cargando transacciones..." />
                        ) : transactions.length > 0 ? (
                            <Table
                                dataSource={
                                    transactions.filter(transaction => {
                                        // filter by type
                                        if (filterType && transaction.type !== filterType) return false;
                                        // filter by concept substring
                                        if (filterConcept && !transaction.concept?.toLowerCase().includes(filterConcept.toLowerCase())) return false;
                                        // filter by exact date
                                        if (filterDate && !dayjs(transaction.date).isSame(filterDate, 'day')) return false;
                                        // filter by month/year selectors
                                        const { month, year } = transactionsSortedInfo;
                                        if (month && transaction.mes !== month) return false;
                                        if (year && transaction.año !== year) return false;
                                        return true;
                                    })
                                }
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
                                        render: (amount: number) =>
                                            `$${amount
                                                .toFixed(2)
                                                .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`,
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
                                        sorter: (a: Transaction, b: Transaction) => {
                                            const dateA = new Date(a.año, a.mes - 1).getTime();
                                            const dateB = new Date(b.año, b.mes - 1).getTime();

                                            if (selectedMonth !== null && selectedYear !== null) {
                                                if (a.mes === selectedMonth && a.año === selectedYear) return -1;
                                                if (b.mes === selectedMonth && b.año === selectedYear) return 1;
                                            } else if (selectedMonth !== null) {
                                                if (a.mes === selectedMonth) return -1;
                                                if (b.mes === selectedMonth) return 1;
                                            } else if (selectedYear !== null) {
                                                if (a.año === selectedYear) return -1;
                                                if (b.año === selectedYear) return 1;
                                            }

                                            return dateB - dateA;
                                        },
                                        sortOrder: transactionsSortedInfo.columnKey === 'fecha' && transactionsSortedInfo.order,
                                    },
                                    // Add action column for EGRESO
                                    {
                                        title: 'Acciones',
                                        key: 'acciones',
                                        render: (_: any, record: Transaction) =>
                                            record.type === 'EGRESO' && !record.pagado ? (
                                                <Button type="link" onClick={() => handleMarkEgresoPaid(record.id)}>
                                                    Marcar Pagado
                                                </Button>
                                            ) : null,
                                    },
                                ]}
                                rowKey="id"
                                onChange={handleTransactionsTableChange}
                            />
                        ) : (
                            <p>No hay transacciones para este usuario.</p>
                        )}
                    </TabPane>
                    // Add this inside the Tabs component
                    <TabPane tab="Estado de Cuenta" key="4">
                        <div className="mb-4 flex justify-end">
                            <Button
                                type="primary"
                                onClick={exportAccountStatusToPDF}
                            >
                                Exportar a PDF
                            </Button>
                        </div>

                        {horseBuyers.map((horseBuyer) => {
                            //console.log('horseBuyer', horseBuyer);
                            const unpaidEgresos = transactions.filter(t =>
                                t.type === 'EGRESO' &&
                                t.pagado === false &&
                                t.horse_id === horseBuyer.horse_id
                            );

                            const unpaidInstallments = horseBuyer.installments?.filter(inst =>
                                inst.status === 'VENCIDO' || inst.status === 'PARCIAL' || 
                                inst.status === 'OVERDUE' || inst.status === 'PARTIAL' || 
                                (inst.mes === new Date().getMonth() + 1 && 
                                 inst.año === new Date().getFullYear() && 
                                 (inst.status === 'PENDIENTE' || inst.status === 'PENDING'))
                            ) || [];

                            return (
                                <Collapse key={horseBuyer.id} className="mb-4">
                                    <Collapse.Panel
                                        header={horseBuyer.horse?.name || 'Caballo sin nombre'}
                                        key={horseBuyer.id}
                                    >
                                        <div className="mb-6">
                                            <h4 className="font-bold mb-2">Egresos Pendientes</h4>
                                            {unpaidEgresos.length > 0 ? (
                                                <Table
                                                    dataSource={unpaidEgresos}
                                                    columns={[
                                                        { title: 'Concepto', dataIndex: 'concept' },
                                                        {
                                                            title: 'Monto',
                                                            render: (_, t) => `$${t.total_amount
                                                                .toFixed(2)
                                                                .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
                                                        },
                                                        {
                                                            title: 'Fecha',
                                                            render: (_, t) => `${monthNames[t.mes - 1]} ${t.año}`
                                                        }
                                                    ]}
                                                    rowKey="id"
                                                    pagination={false}
                                                />
                                            ) : (
                                                <p>No hay egresos pendientes para este caballo.</p>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="font-bold mb-2">Cuotas Pendientes</h4>
                                            {unpaidInstallments.length > 0 ? (
                                                <>
                                                    <Table
                                                        dataSource={unpaidInstallments}
                                                        columns={[
                                                            {
                                                                title: 'Mes/Año',
                                                                render: (_, inst) => `${monthNames[inst.mes - 1]} ${inst.año}`
                                                            },
                                                            {
                                                                title: 'Monto',
                                                                dataIndex: 'amount',
                                                                render: (a: number) => `$${a}`
                                                            },
                                                            {
                                                                title: 'Monto Pagado',
                                                                dataIndex: 'amount_paid',
                                                                render: (a: number) => `$${a}`
                                                            },
                                                            {
                                                                title: 'Pendiente',
                                                                render: (inst: any) => `$${(inst.amount - inst.amount_paid).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
                                                            },
                                                            {
                                                                title: 'Estado',
                                                                dataIndex: 'status'
                                                            }
                                                        ]}
                                                        rowKey="id"
                                                        pagination={false}
                                                    />
                                                    <p className="mt-2 font-bold">
                                                        {`Total Pendiente: $${unpaidInstallments
                                                            .reduce((sum, inst) => sum + (inst.amount - inst.amount_paid), 0)
                                                            .toFixed(2)}`}
                                                    </p>
                                                </>
                                            ) : (
                                                <p>No hay cuotas pendientes para este caballo.</p>
                                            )}
                                        </div>
                                    </Collapse.Panel>
                                </Collapse>
                            );
                        })}
                    </TabPane>
                </Tabs>
            </Card>
        </div>
    );
};

export default DetalleUsuario;
