// pages/informe.tsx
"use client"; // Ensure this directive is present

import {
    Button,
    Card,
    DatePicker,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Spin,
} from 'antd';
import type { Dayjs } from 'dayjs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
    const [selectedMonthYear, setSelectedMonthYear] = useState<Dayjs | null>(null);
    const [horseData, setHorseData] = useState<Horse | null>(null);

    useEffect(() => {
        fetchHorses();
    }, []);

    const fetchHorses = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/horses/');
            if (!response.ok) {
                throw new Error('Error al cargar los caballos.');
            }
            const data: Horse[] = await response.json();
            setHorses(data);
        } catch (error: any) {
            console.error('Error fetching horses:', error);
            message.error('Error al cargar los caballos');
        } finally {
            setLoading(false);
        }
    };

    const fetchHorseData = async (horseId: number) => {
        setLoading(true);
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
                    console.error(`Error fetching user data for buyer_id ${buyer.buyer_id}:`, err);
                    return { ...buyer, buyer_name: 'Nombre no disponible' };
                }
            });

            horseData.buyers = await Promise.all(buyerPromises);
            setHorseData(horseData);
        } catch (error: any) {
            console.error('Error al cargar datos del caballo:', error);
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
            const month = selectedMonthYear.month() + 1; // dayjs months are 0-based
            const year = selectedMonthYear.year();

            // Fetch all transactions for the selected horse, month, and year
            const transactionsResponse = await fetch(
                `http://localhost:8000/transactions/?horse_id=${selectedHorseId}&mes=${month}&año=${year}`
            );
            if (!transactionsResponse.ok) {
                throw new Error('Error al cargar transacciones.');
            }
            const transactions: Transaction[] = await transactionsResponse.json();

            // For each buyer, generate a report
            for (const buyer of horseData.buyers) {
                // Fetch installment for the buyer for the selected month and year
                const installmentsResponse = await fetch(
                    `http://localhost:8000/horse-buyers/${buyer.id}/installments?month=${month}&year=${year}`
                );
                if (!installmentsResponse.ok) {
                    throw new Error(`Error al cargar cuotas para el comprador ${buyer.id}.`);
                }
                const installments: Installment[] = await installmentsResponse.json();
                const installment: Installment | undefined = installments[0];

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
                                `$${installment.amount.toFixed(2)}`,
                                `$${installment.amount_paid.toFixed(2)}`,
                                installment.status,
                            ],
                        ],
                        theme: 'striped',
                        styles: { halign: 'left' },
                        headStyles: { fillColor: [22, 160, 133] },
                    });
                    yPosition = doc.lastAutoTable.finalY + 10;
                } else {
                    doc.text('No hay cuota para este mes.', 14, yPosition);
                    yPosition += 10;
                }

                // Transactions Information
                const buyerTransactions = transactions.filter(
                    (t) =>
                        (t.user_id === buyer.id || t.horse_id === selectedHorseId) &&
                        t.mes === month &&
                        t.año === year
                );

                if (buyerTransactions.length > 0) {
                    doc.text('Transacciones:', 14, yPosition);
                    yPosition += 6;

                    doc.autoTable({
                        startY: yPosition,
                        head: [['Tipo', 'Concepto', 'Monto', 'Monto (%)']],
                        body: buyerTransactions.map((t) => [
                            t.type,
                            t.concept || '-',
                            `$${t.total_amount.toLocaleString()}`,
                            t.type === 'PREMIO' || t.type === 'EGRESO'
                                ? `$${((buyer.percentage / 100) * t.total_amount).toFixed(2)}`
                                : '-',
                        ]),
                        theme: 'striped',
                        styles: { halign: 'left' },
                        headStyles: { fillColor: [22, 160, 133] },
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
                    }
                    // PAGO transactions are not included in the calculation
                }
                if (installment) {
                    total -= installment.amount - installment.amount_paid;
                }

                // Buyer's balance
                const buyerBalance = buyer.balance;

                doc.text(`Balance del Comprador: $${buyerBalance.toFixed(2)}`, 14, yPosition);
                yPosition += 6;

                total += buyerBalance;
                // Display Total
                doc.text(`Total: $${Number(total.toFixed(2)) * -1}`, 14, yPosition);

                // Save or Download PDF
                doc.save(
                    `Informe_${buyer.buyer_name || 'Usuario'}_${horseData.name}_${month}_${year}.pdf`
                );
            }

            message.success('Informes generados exitosamente');
        } catch (error: any) {
            console.error('Error al generar los informes:', error);
            message.error(error.message || 'Error al generar los informes');
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
                                showSearch
                                optionFilterProp="children"
                                filterOption={(input, option) =>
                                    option?.label?.toString().toLowerCase().includes(input.toLowerCase())
                                }
                                allowClear
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
                                allowClear
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" disabled={!selectedHorseId || !selectedMonthYear}>
                                Generar Informes
                            </Button>
                        </Form.Item>
                    </Form>
                )}
            </Card>
        </div>
    );
};

// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default InformePage;
