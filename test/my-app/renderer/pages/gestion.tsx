import {
    Button,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Table,
} from 'antd';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/lib/table/interface';

const { Option } = Select;

interface User {
    id: number;
    name: string;
}

interface Horse {
    id: number;
    name: string;
}

type TransactionType = 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';

interface TransactionFormValues {
    user_id?: number;
    horse_id?: number;
    concept?: string;
    total_amount: number;
    notes?: string;
    mes: number;
    año: number;
}

interface Transaction {
    id: number;
    type: TransactionType;
    concept: string | null;
    total_amount: number;
    notes?: string | null;
    horse_id?: number;
    user_id?: number;
    date: string;
    created_at: string;
    updated_at: string;
    mes: number;
    año: number;
}

const GestionPage: React.FC = () => {
    const router = useRouter();

    const [loading, setLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>([]);
    const [horses, setHorses] = useState<Horse[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [currentType, setCurrentType] = useState<TransactionType>('INGRESO');

    const [sortedInfo, setSortedInfo] = useState<SorterResult<Transaction>>({});
    const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});

    const [form] = Form.useForm();

    const monthOptions = [
        { value: 1, label: 'Enero' },
        { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' },
        { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' },
        { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' },
        { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' },
        { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' },
        { value: 12, label: 'Diciembre' },
    ];

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 25 }, (_, i) => currentYear - 2 + i);

    useEffect(() => {
        fetchUsersAndHorses();
        fetchTransactions();
    }, []);

    const fetchUsersAndHorses = async () => {
        try {
            const [usersResponse, horsesResponse] = await Promise.all([
                axios.get('http://localhost:8000/users/'),
                axios.get('http://localhost:8000/horses/'),
            ]);
            setUsers(usersResponse.data);
            setHorses(horsesResponse.data);
        } catch (error) {
            console.error('Error fetching users and horses', error);
        }
    };

    const fetchTransactions = async () => {
        setTransactionsLoading(true);
        try {
            const response = await axios.get('http://localhost:8000/transactions/');
            setTransactions(response.data);
        } catch (error) {
            console.error('Error fetching transactions', error);
        } finally {
            setTransactionsLoading(false);
        }
    };

    const showModal = (type: TransactionType) => {
        setCurrentType(type);
        form.resetFields();
        const currentDate = new Date();
        form.setFieldsValue({
            mes: currentDate.getMonth() + 1,
            año: currentDate.getFullYear(),
        });
        setModalVisible(true);
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    const handleTransaction = async (values: TransactionFormValues) => {
        setLoading(true);
        try {
            const payload = {
                ...values,
                type: currentType,
            };

            let endpoint = 'http://localhost:8000/transactions/';
            if (currentType === 'PAGO') {
                endpoint = 'http://localhost:8000/transactions/pago/';
            }

            await axios.post(endpoint, payload);
            message.success('Transacción registrada correctamente');
            setModalVisible(false);
            fetchTransactions();
        } catch (error) {
            console.error('Error al registrar transacción', error);
            message.error('No se pudo registrar la transacción');
        } finally {
            setLoading(false);
        }
    };

    const handleTableChange = (
        pagination: any,
        filters: Record<string, FilterValue | null>,
        sorter: SorterResult<Transaction> | SorterResult<Transaction>[]
    ) => {
        setFilteredInfo(filters);
        setSortedInfo(Array.isArray(sorter) ? sorter[0] : sorter);
    };

    const getFilteredSortedData = () => {
        let data = [...transactions];

        // Use the fetched users and horses to populate user_name and horse_name
        data = data.map((t) => {
            const user = t.user_id ? users.find(u => u.id === t.user_id) : undefined;
            const horse = t.horse_id ? horses.find(h => h.id === t.horse_id) : undefined;
            return {
                ...t,
                user_name: user ? user.name : '-',
                horse_name: horse ? horse.name : '-',
            };
        });

        // Apply filters
        Object.entries(filteredInfo).forEach(([key, value]) => {
            if (value) {
                data = data.filter((item) => {
                    if (Array.isArray(value)) {
                        return value.includes(item[key as keyof Transaction]);
                    }
                    return item[key as keyof Transaction] === value;
                });
            }
        });

        // Apply sorting
        if (sortedInfo.columnKey) {
            const { columnKey, order } = sortedInfo;
            data.sort((a, b) => {
                const aValue = a[columnKey as keyof Transaction];
                const bValue = b[columnKey as keyof Transaction];

                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return order === 'ascend' ? aValue - bValue : bValue - aValue;
                }

                if (aValue instanceof Date && bValue instanceof Date) {
                    return order === 'ascend'
                        ? aValue.getTime() - bValue.getTime()
                        : bValue.getTime() - aValue.getTime();
                }

                const aStr = String(aValue || '');
                const bStr = String(bValue || '');
                return order === 'ascend'
                    ? aStr.localeCompare(bStr)
                    : bStr.localeCompare(aStr);
            });
        }

        return data;
    };

    const getUniqueValues = (field: 'año' | 'mes') => {
        const values = new Set(transactions.map(t => t[field]));
        return Array.from(values).sort((a, b) => Number(a) - Number(b));
    };

    const baseFormItems = (
        <>
            <Form.Item
                name="mes"
                label="Mes"
                rules={[{ required: true, message: 'Seleccione el mes' }]}
            >
                <Select placeholder="Seleccione el mes">
                    {monthOptions.map(month => (
                        <Option key={month.value} value={month.value}>
                            {month.label}
                        </Option>
                    ))}
                </Select>
            </Form.Item>
            <Form.Item
                name="año"
                label="Año"
                rules={[{ required: true, message: 'Seleccione el año' }]}
            >
                <Select placeholder="Seleccione el año">
                    {yearOptions.map(year => (
                        <Option key={year} value={year}>
                            {year}
                        </Option>
                    ))}
                </Select>
            </Form.Item>
        </>
    );

    const renderForm = () => {
        const commonFields = (
            <>
                {baseFormItems}
                <Form.Item name="concept" label="Concepto">
                    <Input />
                </Form.Item>
                <Form.Item
                    name="total_amount"
                    label="Monto"
                    rules={[{ required: true, message: 'Ingrese el monto' }]}
                >
                    <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="notes" label="Notas">
                    <Input.TextArea rows={3} />
                </Form.Item>
            </>
        );

        switch (currentType) {
            case 'INGRESO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleTransaction}>
                        <Form.Item
                            name="user_id"
                            label="Usuario"
                            rules={[{ required: true, message: 'Seleccione un usuario' }]}
                        >
                            <Select placeholder="Seleccione un usuario">
                                {users.map((user) => (
                                    <Option key={user.id} value={user.id}>
                                        {user.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {commonFields}
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Ingreso
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'EGRESO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleTransaction}>
                        <Form.Item
                            name="horse_id"
                            label="Caballo"
                            rules={[{ required: true, message: 'Seleccione un caballo' }]}
                        >
                            <Select placeholder="Seleccione un caballo">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {commonFields}
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Egreso
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'PREMIO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleTransaction}>
                        <Form.Item
                            name="horse_id"
                            label="Caballo"
                            rules={[{ required: true, message: 'Seleccione un caballo' }]}
                        >
                            <Select placeholder="Seleccione un caballo">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {commonFields}
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Premio
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'PAGO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleTransaction}>
                        <Form.Item
                            name="user_id"
                            label="Usuario"
                            rules={[{ required: true, message: 'Seleccione un usuario' }]}
                        >
                            <Select placeholder="Seleccione un usuario">
                                {users.map((user) => (
                                    <Option key={user.id} value={user.id}>
                                        {user.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="horse_id"
                            label="Caballo"
                            rules={[{ required: true, message: 'Seleccione un caballo' }]}
                        >
                            <Select placeholder="Seleccione un caballo">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {commonFields}
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Pago
                            </Button>
                        </Form.Item>
                    </Form>
                );
            default:
                return null;
        }
    };

    const columns: ColumnsType<Transaction & { user_name?: string; horse_name?: string }> = [
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            filters: [
                { text: 'INGRESO', value: 'INGRESO' },
                { text: 'EGRESO', value: 'EGRESO' },
                { text: 'PREMIO', value: 'PREMIO' },
                { text: 'PAGO', value: 'PAGO' },
            ],
            filteredValue: filteredInfo.type || null,
            onFilter: (value: string, record) => record.type === value,
            sorter: true,
            sortOrder: sortedInfo.columnKey === 'type' ? sortedInfo.order : null,
        },
        {
            title: 'Mes',
            dataIndex: 'mes',
            key: 'mes',
            filters: monthOptions.map(month => ({
                text: month.label,
                value: month.value,
            })),
            filteredValue: filteredInfo.mes || null,
            onFilter: (value: number, record) => record.mes === value,
            render: (mes: number) => monthOptions.find(m => m.value === mes)?.label,
            sorter: true,
            sortOrder: sortedInfo.columnKey === 'mes' ? sortedInfo.order : null,
        },
        {
            title: 'Año',
            dataIndex: 'año',
            key: 'año',
            filters: getUniqueValues('año').map(year => ({
                text: String(year),
                value: year,
            })),
            filteredValue: filteredInfo.año || null,
            onFilter: (value: number, record) => record.año === value,
            sorter: true,
            sortOrder: sortedInfo.columnKey === 'año' ? sortedInfo.order : null,
        },
        {
            title: 'Concepto',
            dataIndex: 'concept',
            key: 'concept',
            sorter: (a, b) => (a.concept || '').localeCompare(b.concept || ''),
            sortOrder: sortedInfo.columnKey === 'concept' && sortedInfo.order,
        },
        {
            title: 'Monto',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount: number) => `$${amount.toLocaleString()}`,
            sorter: (a, b) => a.total_amount - b.total_amount,
            sortOrder: sortedInfo.columnKey === 'total_amount' && sortedInfo.order,
        },
        {
            title: 'Usuario',
            dataIndex: 'user_name',
            key: 'user_name',
            render: (text: string, record) =>
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
            sorter: (a, b) =>
                (a.user_name || '').localeCompare(b.user_name || ''),
            sortOrder:
                sortedInfo.columnKey === 'user_name' &&
                sortedInfo.order,
        },
        {
            title: 'Caballo',
            dataIndex: 'horse_name',
            key: 'horse_name',
            render: (text: string) => text || '-',
            sorter: (a, b) =>
                (a.horse_name || '').localeCompare(b.horse_name || ''),
            sortOrder:
                sortedInfo.columnKey === 'horse_name' &&
                sortedInfo.order,
        },
        {
            title: 'Fecha',
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => new Date(date).toLocaleDateString(),
            sorter: (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            sortOrder: sortedInfo.columnKey === 'date' && sortedInfo.order,
        },
    ];

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Gestión de Transacciones</h1>
            <div className="flex space-x-4 mb-4">
                <Button type="primary" onClick={() => showModal('INGRESO')}>Nuevo Ingreso</Button>
                <Button type="primary" onClick={() => showModal('EGRESO')}>Nuevo Egreso</Button>
                <Button type="primary" onClick={() => showModal('PREMIO')}>Nuevo Premio</Button>
                <Button type="primary" onClick={() => showModal('PAGO')}>Nuevo Pago</Button>
            </div>
            <Table
                columns={columns}
                dataSource={getFilteredSortedData()}
                loading={transactionsLoading}
                onChange={handleTableChange}
                rowKey="id"
            />
            <Modal
                title={`Registrar ${currentType}`}
                visible={modalVisible}
                onCancel={handleCancel}
                footer={null}
            >
                {renderForm()}
            </Modal>
        </div>
    );
};

export default GestionPage;
