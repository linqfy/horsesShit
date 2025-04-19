"use client";

import { loadConcepts } from '@/app/crear/concepto/actions';
import {
    AutoComplete,
    Button,
    DatePicker,
    Descriptions,
    Form,
    Input,
    InputNumber,
    message,
    Modal,
    Select,
    Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/lib/table/interface';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';


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

interface IngresoFormValues {
    user_id: number;
    total_amount: number;
    mes: number;
    año: number;
    fecha_de_pago: string;
    concept?: string;
    horse_id: number;
}

interface EgresoFormValues {
    horse_id: number;
    total_amount: number;
    mes: number;
    año: number;
    pagado: boolean;
    fecha_de_pago: string;
    concept?: string;
}

interface PremioFormValues {
    horse_id: number;
    total_amount: number;
    mes: number;
    año: number;
    fecha_de_efectividad: string;
    concept: string;
}

interface PagoFormValues {
    user_id: number;
    horse_id: number;
    total_amount: number;
    mes: number;
    año: number;
    concept?: string;
}

type TransactionFormValues = IngresoFormValues | EgresoFormValues | PremioFormValues | PagoFormValues;

interface Transaction {
    id: number;
    type: TransactionType;
    concept: string | null;
    total_amount: number;
    horse_id?: number;
    user_id?: number;
    date: string;
    mes: number;
    año: number;
    fecha_de_pago?: string;
    pagado?: boolean;
    fecha_de_efectividad?: string;
    created_at?: string;
}

const GestionPage: React.FC = () => {
    const router = useRouter();
    const [confirmModalVisible, setConfirmModalVisible] = useState<boolean>(false);
    const [transactionData, setTransactionData] = useState<TransactionFormValues | null>(null);
    const [searchText, setSearchText] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<User[]>([]);
    const [horses, setHorses] = useState<Horse[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState<boolean>(true);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [currentType, setCurrentType] = useState<TransactionType>('INGRESO');

    const [sortedInfo, setSortedInfo] = useState<SorterResult<Transaction>>({});
    const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
    const [conceptOptions, setConceptOptions] = useState<string[]>([]);
    
    const fetchConcepts = async () => {
        try {
            setLoading(true);
            const data = await loadConcepts();
            
            // Ensure data is an array before mapping
            console.log('Concepts data:', data);
            if (Array.isArray(data)) {
                setConceptOptions(data.map(concept => concept.toString()));
            } else {
                console.error('Expected array of concepts but received:', data);
                setConceptOptions([]); // Set empty array as fallback
            }
        } catch (err) {
            console.error('Error loading concepts:', err);
            message.error('Error al cargar conceptos');
            setConceptOptions([]); // Set empty array on error
        } finally {
            console.log('Concepts loaded:', conceptOptions);
            setLoading(false);
        }
    };

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
        fetchConcepts();
    }, []);

    const fetchUsersAndHorses = async () => {
        try {
            const [usersResponse, horsesResponse] = await Promise.all([
                fetch('http://localhost:8000/users/'),
                fetch('http://localhost:8000/horses/'),
            ]);

            if (!usersResponse.ok || !horsesResponse.ok) {
                throw new Error('Error al cargar usuarios o caballos.');
            }

            const usersData: User[] = await usersResponse.json();
            const horsesData: Horse[] = await horsesResponse.json();

            setUsers(usersData);
            setHorses(horsesData);
        } catch (error: any) {
            console.error('Error fetching users and horses:', error);
            message.error('Error al cargar usuarios o caballos');
        }
    };

    const fetchTransactions = async () => {
        setTransactionsLoading(true);
        try {
            const response = await fetch('http://localhost:8000/transactions/');
            if (!response.ok) {
                throw new Error('Error al cargar transacciones.');
            }
            const data: Transaction[] = await response.json();

            // Sort transactions by date in descending order (newest first)
            const sortedData = [...data].sort((a, b) => {
                const timeCompare = new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
                // If timestamps are equal, sort by highest ID first 
                return timeCompare === 0 ? (b.id - a.id) : timeCompare;
            });

            setTransactions(sortedData);
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            message.error('Error al cargar transacciones');
        } finally {
            setTransactionsLoading(false);
        }
    };


    const handleConfirmTransaction = (values: TransactionFormValues) => {
        setTransactionData(values);
        setConfirmModalVisible(true);
    };

    // Called when the confirmation modal is confirmed.
    const handleConfirmModalOk = async () => {
        if (!transactionData) return;
        await handleTransaction(transactionData);
        setTransactionData(null);
        setConfirmModalVisible(false);
        setModalVisible(false);
    };

    const handleConfirmModalCancel = () => {
        setTransactionData(null);
        setConfirmModalVisible(false);
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

            console.log('Payload:', payload);

            const response = await fetch('http://localhost:8000/transactions/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'No se pudo registrar la transacción.');
            }

            message.success('Transacción registrada correctamente');
            setModalVisible(false);
            fetchTransactions();
        } catch (error: any) {
            console.error('Error al registrar transacción:', error);
            message.error(error.message || 'No se pudo registrar la transacción');
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
        let data = [...transactions] as (Transaction & { user_name?: string; horse_name?: string })[];

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

        // TODO: FIX THE NEW INPUT SYSTEM BASED ON DB CRUD..
        
        if (searchText.trim()) {
            const searchTerm = searchText.toLowerCase().trim();
            data = data.filter((item) => {
                // Search in dates
                const dateMatch =
                    (item.created_at && new Date(item.created_at).toLocaleDateString().includes(searchTerm)) ||
                    (item.fecha_de_pago && new Date(item.fecha_de_pago).toLocaleDateString().includes(searchTerm)) ||
                    (item.fecha_de_efectividad && new Date(item.fecha_de_efectividad).toLocaleDateString().includes(searchTerm));

                // Search in user and horse names
                const nameMatch =
                    (item.user_name && item.user_name.toLowerCase().includes(searchTerm)) ||
                    (item.horse_name && item.horse_name.toLowerCase().includes(searchTerm));

                // Search in concepts
                const conceptMatch = item.concept && item.concept.toLowerCase().includes(searchTerm);

                // Search in transaction type
                const typeMatch = item.type.toLowerCase().includes(searchTerm);

                // Search in amount (converted to string)
                const amountMatch = item.total_amount.toString().includes(searchTerm);

                return dateMatch || nameMatch || conceptMatch || typeMatch || amountMatch;
            });
        }

        // Apply filters
        Object.entries(filteredInfo).forEach(([key, value]) => {
            if (value) {
                data = data.filter((item) => {
                    if (Array.isArray(value)) {
                        return value.includes(item[key as keyof Transaction] as any);
                    }
                    return item[key as keyof Transaction] === value;
                });
            }
        });

        // Apply sorting
        if (sortedInfo.columnKey && sortedInfo.order) {
            const { columnKey, order } = sortedInfo;
            data.sort((a, b) => {
                const aValue = a[columnKey as keyof Transaction];
                const bValue = b[columnKey as keyof Transaction];

                // Numeric comparison
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                    return order === 'ascend' ? aValue - bValue : bValue - aValue;
                }

                // Date comparison (assuming aValue and bValue are strings representing dates)
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    const aDate = new Date(aValue);
                    const bDate = new Date(bValue);
                    console.log(aDate)
                    console.log(bDate)
                    if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                        return order === 'ascend'
                            ? aDate.getTime() - bDate.getTime()
                            : bDate.getTime() - aDate.getTime();
                    }
                }

                // String comparison
                const aStr = String(aValue ?? '');
                const bStr = String(bValue ?? '');
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
                label="Periodo"
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
            <Form.Item
                name="total_amount"
                label="Monto"
                rules={[{ required: true, message: 'Ingrese el monto' }]}
            >
                <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
        </>
    );

    const renderForm = () => {
        switch (currentType) {
            case 'INGRESO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleConfirmTransaction}>
                        <Form.Item
                            name="user_id"
                            label="Usuario"
                            rules={[{ required: true, message: 'Seleccione un usuario' }]}
                        >
                            <Select placeholder="Seleccione un usuario" showSearch optionFilterProp="children">
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
                            <Select placeholder="Seleccione un caballo" showSearch optionFilterProp="children">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {baseFormItems}
                        <Form.Item
                            name="fecha_de_pago"
                            label="Fecha de Pago"
                            rules={[{ required: true, message: 'Seleccione la fecha de pago' }]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="concept" label="Concepto" rules={[{ required: true }]}>
                            <AutoComplete
                                options={Array.isArray(conceptOptions) ? 
                                    conceptOptions.map(concept => ({ value: concept })) : 
                                    []
                                }
                                placeholder="Seleccione o ingrese un concepto"
                                filterOption={(inputValue, option) =>
                                    option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Ingreso
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'EGRESO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleConfirmTransaction}>
                        <Form.Item
                            name="horse_id"
                            label="Caballo"
                            rules={[{ required: true, message: 'Seleccione un caballo' }]}
                        >
                            <Select placeholder="Seleccione un caballo" showSearch optionFilterProp="children">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {baseFormItems}
                        <Form.Item
                            name="fecha_de_pago"
                            label="Fecha de Pago"
                            rules={[{ required: true, message: 'Ingrese la fecha de pago' }]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item
                            name="pagado"
                            label="Estado de Pago"
                            rules={[{ required: true, message: 'Indique el estado de pago' }]}
                        >
                            <Select placeholder="Seleccione el estado">
                                <Option value={true}>Pagado</Option>
                                <Option value={false}>Pendiente</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="concept" label="Concepto" rules={[{ required: true }]}>
                            <AutoComplete
                                options={Array.isArray(conceptOptions) ? 
                                    conceptOptions.map(concept => ({ value: concept })) : 
                                    []
                                }
                                placeholder="Seleccione o ingrese un concepto"
                                filterOption={(inputValue, option) =>
                                    option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Egreso
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'PREMIO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleConfirmTransaction}>
                        <Form.Item
                            name="horse_id"
                            label="Caballo"
                            rules={[{ required: true, message: 'Seleccione un caballo' }]}
                        >
                            <Select placeholder="Seleccione un caballo" showSearch optionFilterProp="children">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {baseFormItems}
                        <Form.Item name="concept" label="Concepto" rules={[{ required: true }]}>
                            <AutoComplete
                                options={Array.isArray(conceptOptions) ? 
                                    conceptOptions.map(concept => ({ value: concept })) : 
                                    []
                                }
                                placeholder="Seleccione o ingrese un concepto"
                                filterOption={(inputValue, option) =>
                                    option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                            />
                        </Form.Item>
                        <Form.Item
                            name="fecha_de_efectividad"
                            label="Fecha de Cobro (Se aplicara el mes siguiente a los usuarios)"
                            rules={[{ required: true, message: 'Seleccione la fecha de efectividad' }]}
                        >
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Premio
                            </Button>
                        </Form.Item>
                    </Form>
                );
            case 'PAGO':
                return (
                    <Form form={form} layout="vertical" onFinish={handleConfirmTransaction}>
                        <Form.Item
                            name="user_id"
                            label="Usuario Administrador:"
                            rules={[{ required: true, message: 'Seleccione el usuario administrador' }]}
                        >
                            <Select placeholder="Seleccione un usuario" showSearch optionFilterProp="children">
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
                            <Select placeholder="Seleccione un caballo" showSearch optionFilterProp="children">
                                {horses.map((horse) => (
                                    <Option key={horse.id} value={horse.id}>
                                        {horse.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                        {baseFormItems}
                        <Form.Item name="concept" label="Concepto" rules={[{ required: true }]}>
                            <AutoComplete
                                options={conceptOptions.map(concept => ({ value: concept }))}
                                placeholder="Seleccione o ingrese un concepto"
                                filterOption={(inputValue, option) =>
                                    option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                }
                            />
                        </Form.Item>
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
            sortOrder: sortedInfo.columnKey === 'concept' &&
                (sortedInfo.order === 'ascend' || sortedInfo.order === 'descend')
                ? sortedInfo.order
                : undefined,
        },
        {
            title: 'Monto',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount: number) => `$${amount.toLocaleString()}`,
            sorter: (a, b) => a.total_amount - b.total_amount,
            sortOrder: sortedInfo.columnKey === 'total_amount' &&
                (sortedInfo.order === 'ascend' || sortedInfo.order === 'descend')
                ? sortedInfo.order
                : undefined,
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
            sortOrder: sortedInfo.columnKey === 'user_name' &&
                (sortedInfo.order === 'ascend' || sortedInfo.order === 'descend')
                ? sortedInfo.order
                : undefined,
        },
        {
            title: 'Caballo',
            dataIndex: 'horse_name',
            key: 'horse_name',
            render: (text: string) => text || '-',
            sorter: (a, b) =>
                (a.horse_name || '').localeCompare(b.horse_name || ''),
            sortOrder: sortedInfo.columnKey === 'horse_name' &&
                (sortedInfo.order === 'ascend' || sortedInfo.order === 'descend')
                ? sortedInfo.order
                : undefined,
        },
        {
            title: 'Fecha',
            dataIndex: 'date',
            key: 'date',
            render: (date: string) => new Date(date).toLocaleDateString(),
            sorter: (a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime(),
            sortOrder: sortedInfo.columnKey === 'date' &&
                (sortedInfo.order === 'ascend' || sortedInfo.order === 'descend')
                ? sortedInfo.order
                : undefined,
        },
        {
            title: 'Fecha de Pago',
            dataIndex: 'fecha_de_pago',
            key: 'fecha_de_pago',
            render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
            sorter: (a, b) => a.fecha_de_pago && b.fecha_de_pago
                ? new Date(a.fecha_de_pago).getTime() - new Date(b.fecha_de_pago).getTime()
                : 0,
        },
        {
            title: 'Estado de Pago',
            dataIndex: 'pagado',
            key: 'pagado',
            render: (pagado: boolean) => pagado !== null ? (pagado ? 'Pagado' : 'Pendiente') : '-',
            filters: [
                { text: 'Pagado', value: true },
                { text: 'Pendiente', value: false }
            ],
            onFilter: (value, record) => record.pagado === value,
        },
        {
            title: 'Fecha de Efectividad',
            dataIndex: 'fecha_de_efectividad',
            key: 'fecha_de_efectividad',
            render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
            sorter: (a, b) => a.fecha_de_efectividad && b.fecha_de_efectividad
                ? new Date(a.fecha_de_efectividad).getTime() - new Date(b.fecha_de_efectividad).getTime()
                : 0,
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
            <div className="mb-4">
                <Input.Search
                    placeholder="Buscar por fecha, usuario, caballo, concepto o monto..."
                    allowClear
                    enterButton="Buscar"
                    size="large"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onSearch={(value) => setSearchText(value)}
                    style={{ width: '100%' }}
                />
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
                destroyOnClose
            >
                {renderForm()}
            </Modal>

            <Modal
                title="Confirme los datos ingresados"
                visible={confirmModalVisible}
                onOk={handleConfirmModalOk}
                onCancel={handleConfirmModalCancel}
                okText="Confirmar"
                cancelText="Cancelar"
            >
                {transactionData ? (
                    <Descriptions title="Detalles de la Transacción" bordered column={1}>
                        <Descriptions.Item label="Tipo">{currentType}</Descriptions.Item>
                        <Descriptions.Item label="Monto">{transactionData.total_amount}</Descriptions.Item>
                        <Descriptions.Item label="Mes">
                            {monthOptions.find(month => month.value === transactionData.mes)?.label || transactionData.mes}
                        </Descriptions.Item>
                        <Descriptions.Item label="Año">{transactionData.año}</Descriptions.Item>
                        {currentType === 'INGRESO' && (
                            <>
                                <Descriptions.Item label="Usuario">{transactionData.user_id}</Descriptions.Item>
                                <Descriptions.Item label="Caballo">{transactionData.horse_id}</Descriptions.Item>
                                <Descriptions.Item label="Fecha de Pago">
                                    {transactionData.fecha_de_pago ? new Date(transactionData.fecha_de_pago).toLocaleDateString() : '-'}
                                </Descriptions.Item>
                            </>
                        )}
                        {currentType === 'EGRESO' && (
                            <>
                                <Descriptions.Item label="Caballo">{transactionData.horse_id}</Descriptions.Item>
                                <Descriptions.Item label="Fecha de Pago">
                                    {transactionData.fecha_de_pago ? new Date(transactionData.fecha_de_pago).toLocaleDateString() : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Estado de Pago">{String(transactionData.pagado)}</Descriptions.Item>
                            </>
                        )}
                        {currentType === 'PREMIO' && (
                            <>
                                <Descriptions.Item label="Caballo">{transactionData.horse_id}</Descriptions.Item>
                                <Descriptions.Item label="Fecha de Efectividad">
                                    {transactionData.fecha_de_efectividad ? new Date(transactionData.fecha_de_efectividad).toLocaleDateString() : '-'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Concepto">{transactionData.concept || '-'}</Descriptions.Item>
                            </>
                        )}
                        {currentType === 'PAGO' && (
                            <>
                                <Descriptions.Item label="Usuario Administrador">{transactionData.user_id}</Descriptions.Item>
                                <Descriptions.Item label="Caballo">{transactionData.horse_id}</Descriptions.Item>
                                <Descriptions.Item label="Concepto">{transactionData.concept || '-'}</Descriptions.Item>
                            </>
                        )}
                    </Descriptions>
                ) : (
                    <p>No hay datos a mostrar.</p>
                )}
            </Modal>
        </div>
    );
};

export default GestionPage;
