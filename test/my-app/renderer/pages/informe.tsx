// pages/informe.tsx

import {
    Button,
    Card,
    DatePicker,
    Form,
    message,
    Select,
    Spin,
} from 'antd';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment';
import React, { useEffect, useState } from 'react';

const { Option } = Select;
const { MonthPicker } = DatePicker;

interface User {
    id: number;
    name: string;
    email: string;
    dni: string | null;
    balance: number;
    is_admin: boolean | null;
    created_at: string;
    updated_at: string;
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

interface Installment {
    id: number;
    horse_buyer_id: number;
    installment_id: number;
    amount: number;
    amount_paid: number;
    status: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO';
    last_payment_date: string | null;
    created_at: string;
    updated_at: string;
    payments: any[];
}

interface Transaction {
    id: number;
    type: 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';
    concept: string | null;
    total_amount: number;
    date: string;
    user_id?: number;
    horse_id?: number;
    mes: number;
    año: number;
    created_at: string;
    updated_at: string;
}

const InformePage: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [horses, setHorses] = useState<Horse[]>([]);
    const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
    const [selectedMonthYear, setSelectedMonthYear] = useState<moment.Moment | null>(null);
    const [horseData, setHorseData] = useState<Horse | null>(null);

    useEffect(() => {
        fetchHorses();
    }, []);

    const fetchHorses = async () => {
        setLoading(true);
        try {
            const horsesRes = await axios.get('http://localhost:8000/horses/');
            setHorses(horsesRes.data);
        } catch (error) {
            console.error('Error fetching horses', error);
            message.error('Error al cargar los caballos');
        } finally {
            setLoading(false);
        }
    };

    const fetchHorseData = async (horseId: number) => {
        setLoading(true);
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
            setHorseData(horseData);
        } catch (error) {
            console.error('Error al cargar datos del caballo', error);
            message.error('Error al cargar datos del caballo');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateReports = async () => {
        if (!selectedHorseId || !selectedMonthYear || !horseData) {
            message.error('Por favor seleccione un caballo y un mes/año');
            return;
        }

        setLoading(true);

        try {
            const month = selectedMonthYear.month() + 1; // moment months are 0-based
            const year = selectedMonthYear.year();

            // Fetch all transactions for the selected horse, month, and year
            const transactionsRes = await axios.get('http://localhost:8000/transactions/', {
                params: {
                    horse_id: selectedHorseId,
                    mes: month,
                    año: year,
                },
            });
            const transactions: Transaction[] = transactionsRes.data;

            // For each buyer, generate a report
            for (const buyer of horseData.buyers) {
                // Fetch installment for the buyer for the selected month and year
                const installmentsRes = await axios.get(
                    `http://localhost:8000/horse-buyers/${buyer.id}/installments`,
                    {
                        params: {
                            month: month, // Pass the selected month as a query parameter
                            year: year,   // Pass the selected year as a query parameter
                        },
                    }
                );
                // The API already filters the installments, so no need for additional filtering
                const installment: Installment = installmentsRes.data[0];

                // Generate PDF
                const doc = new jsPDF();

                // Header
                doc.setFontSize(16);
                doc.text(`Informe para ${buyer.buyer_name || 'Nombre no disponible'}`, 14, 20);
                doc.setFontSize(12);
                doc.text(`Caballo: ${horseData.name}`, 14, 30);
                doc.text(`Mes/Año: ${selectedMonthYear.format('MMMM YYYY')}`, 14, 36);

                let yPosition = 50;

                // Installment Information
                if (installment) {
                    doc.text('Cuota:', 14, yPosition);
                    yPosition += 6;
                    doc.autoTable({
                        startY: yPosition,
                        head: [['Cuota', 'Monto', 'Monto Pagado', 'Estado']],
                        body: [
                            [
                                installment.installment_id,
                                `$${installment.amount}`,
                                `$${installment.amount_paid}`,
                                installment.status,
                            ],
                        ],
                    });
                    yPosition = doc.lastAutoTable.finalY + 10;
                } else {
                    doc.text('No hay cuota para este mes.', 14, yPosition);
                    yPosition += 10;
                }

                // Transactions Information
                const buyerTransactions = transactions.filter(
                    (t) => t.mes === month && t.año === year
                );

                if (buyerTransactions.length > 0) {
                    const parte = (buyer, transaction) => (buyer.percentage / 100) * transaction.total_amount;

                    doc.text('Transacciones:', 14, yPosition);
                    yPosition += 6;

                    doc.autoTable({
                        startY: yPosition,
                        head: [['Tipo', 'Concepto', 'Monto', 'Monto (%)']],
                        body: buyerTransactions.map((t) => [
                            t.type,
                            t.concept || '-',
                            `$${t.total_amount.toLocaleString()}`,
                            t.type === "PREMIO" || t.type === "EGRESO"
                                ? `$${parte(buyer, t).toFixed(2)}`
                                : '-'
                        ]),
                    });

                    yPosition = doc.lastAutoTable.finalY + 10;
                } else {
                    doc.text('No hay transacciones para este mes.', 14, yPosition);
                    yPosition += 10;
                }


                // Total Calculation
                let total = 0;

                // Calculate buyer's share of transactions
                for (const t of buyerTransactions) {
                    const share = (buyer.percentage / 100) * t.total_amount;
                    if (t.type === 'PREMIO') {
                        total += share;
                    } else if (t.type === 'EGRESO') {
                        total -= share;
                    } else if (t.type === 'INGRESO') {
                        total += t.total_amount;
                    } else {

                    }
                    // PAGO transactions are not included in the calculation
                }
                if (installment) {
                    total -= (installment.amount - installment.amount_paid);
                }

                // Buyer's balance
                const buyerBalance = buyer.balance;

                // Display Total
                doc.text(`Total: $${total.toFixed(2)}`, 14, yPosition);
                yPosition += 6;
                doc.text(`Balance del Comprador: $${buyerBalance.toFixed(2)}`, 14, yPosition);

                // Save or Download PDF
                doc.save(`Informe_${buyer.buyer_name || 'Usuario'}_${horseData.name}_${month}_${year}.pdf`);
            }

            message.success('Informes generados exitosamente');
        } catch (error) {
            console.error('Error al generar los informes', error);
            message.error('Error al generar los informes');
        } finally {
            setLoading(false);
        }
    };

    const onFinish = async (values: any) => {
        if (!selectedHorseId) {
            message.error('Por favor seleccione un caballo');
            return;
        }

        await fetchHorseData(selectedHorseId);
        handleGenerateReports();
    };

    return (
        <div className="p-6">
            <Card title="Generar Informe">
                {loading ? (
                    <Spin tip="Cargando datos..." />
                ) : (
                    <Form layout="vertical" onFinish={onFinish}>
                        <Form.Item label="Seleccione un caballo" required>
                            <Select
                                placeholder="Seleccione un caballo"
                                onChange={(value) => setSelectedHorseId(value)}
                                style={{ width: '100%' }}
                            >
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item label="Seleccione Mes y Año" required>
                            <MonthPicker
                                onChange={(date) => setSelectedMonthYear(date)}
                                format="MMMM YYYY"
                                style={{ width: '100%' }}
                                placeholder="Seleccione Mes y Año"
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit">
                                Generar Informes
                            </Button>
                        </Form.Item>
                    </Form>
                )}
            </Card>
        </div>
    );
};

export default InformePage;
