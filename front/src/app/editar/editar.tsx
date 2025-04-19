'use client'
import { PlusOutlined, TeamOutlined, TransactionOutlined, UserOutlined } from '@ant-design/icons';
import {
    Button,
    Checkbox,
    Collapse,
    DatePicker,
    Descriptions,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Select,
    Spin,
    Tabs
} from 'antd';
import moment from 'moment';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import TransactionFormFields from './TransactionFormFields';

const { Panel } = Collapse;
const { Search } = Input;
const { TabPane } = Tabs;

// Type definitions
type EntityType = 'user' | 'horse' | 'transaction';
type TransactionType = 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';

interface User {
    id: number;
    name: string;
    email: string;
    dni: string;
    is_admin: boolean;
    balance: number;
}

interface Horse {
    id: number;
    name: string;
    information: string;
    image_url: string;
    total_value: number;
    number_of_installments: number;
    creation_date: string;
    total_percentage: number;
}

interface Transaction {
    id: number;
    type: TransactionType;
    concept?: string;
    total_amount: number;
    mes: number;
    año: number;
    user_id?: number;
    horse_id?: number;
    fecha_de_pago?: string;
    pagado?: boolean;
    fecha_de_efectividad?: string;
}

const EditarClient = () => {
    const [entities, setEntities] = useState<{
        users: User[];
        horses: Horse[];
        transactions: Transaction[];
    }>({ users: [], horses: [], transactions: [] });

    const [loading, setLoading] = useState<{ [key in EntityType]: boolean }>({
        user: true,
        horse: true,
        transaction: true
    });

    const [search, setSearch] = useState<{ [key in EntityType]: string }>({
        user: '',
        horse: '',
        transaction: ''
    });

    const [editState, setEditState] = useState<{
        visible: boolean;
        type?: EntityType;
        data?: any;
        confirmVisible: boolean;
        pendingData?: any;
    }>({ visible: false, confirmVisible: false });

    const [form] = Form.useForm();
    const router = useRouter();

    // Debounced search handler
    const searchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
    const handleSearch = (value: string, type: EntityType) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setSearch(prev => ({ ...prev, [type]: value }));
        }, 300);
    };

    // Improved data fetching with error handling
    const fetchData = async (type: EntityType) => {
        try {
            setLoading(prev => ({ ...prev, [type]: true }));
            const response = await fetch(`http://localhost:8000/${type}s/`);
            if (!response.ok) throw new Error(`Failed to fetch ${type}s`);
            const data: any[] = await response.json();

            if (type === 'horse') {
                // For each horse, fetch its detailed data and merge it
                const horsesArray = data as Horse[];
                const horsesData = await Promise.all(horsesArray.map(async (horse: Horse) => {
                    try {
                        const detailResponse = await fetch(`http://localhost:8000/horses/${horse.id}`);
                        if (detailResponse.ok) {
                            const detail = await detailResponse.json() as Partial<Horse>;
                            return { ...horse, ...detail };
                        }
                    } catch (detailError) {
                        console.error(`Error fetching details for horse ${horse.id}:`, detailError);
                    }
                    return horse;
                }));
                setEntities(prev => ({ ...prev, horses: horsesData }));
            } else {
                setEntities(prev => ({ ...prev, [`${type}s`]: data }));
            }
        } catch (error: any) {
            console.error(`Error fetching ${type}s:`, error);
            message.error(`Error al cargar ${type}s`);
        } finally {
            setLoading(prev => ({ ...prev, [type]: false }));
        }
    };

    useEffect(() => {
        const initialFetch = async () => {
            await Promise.all([
                fetchData('user'),
                fetchData('horse'),
                fetchData('transaction')
            ]);
        };
        initialFetch();
    }, []);

    // Replace the current useEffect (lines 127-160) with:
    // Place this hook at the top level of your component along with your other hooks
    const buyersData = Form.useWatch('buyers_data', form);

    useEffect(() => {
        if (editState.type === 'horse') {
            const calculateTotal = () => {
                const buyers = buyersData || [];
                const total = buyers.reduce((sum: number, curr: any) => sum + (curr.percentage || 0), 0);
                form.setFieldsValue({ total_percentage: total });
            };
            calculateTotal();
        }
    }, [form, editState.type, buyersData]);

    const handleEdit = async (data: any, type: EntityType) => {
        const initialValues = { ...data };
        // Convert date strings to moment objects
        if (type === 'transaction') {
            initialValues.fecha_de_pago = data.fecha_de_pago ? moment.utc(data.fecha_de_pago) : null;
            initialValues.fecha_de_efectividad = data.fecha_de_efectividad ? moment.utc(data.fecha_de_efectividad) : null;
        }
        if (type === 'horse') {
            const response = await fetch(`http://localhost:8000/horses/${data.id}`);
            if (!response.ok) throw new Error('Failed to fetch horse details');
            const horseData = await response.json();

            // Transform buyers to match create schema format
            data = {
                ...horseData,
                buyers_data: horseData.buyers.map((b: any) => ({
                    buyer_id: b.buyer_id,
                    percentage: b.percentage
                }))
            };
        }

        form.setFieldsValue(initialValues);
        setEditState({ visible: true, type, data: initialValues, confirmVisible: false });
    };

    const handleFormSubmit = async (values: any) => {
        // If it's a transaction and concept is empty, set default value
        if (editState.type === 'transaction' && (!values.concept || values.concept.trim() === '')) {
            values.concept = 'Sin descripción';
        }
        setEditState(prev => ({ ...prev, pendingData: values, confirmVisible: true }));
    };

    const handleDelete = async (id: number, type: EntityType) => {
        try {
            const response = await fetch(`http://localhost:8000/${type}s/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Delete failed');
            message.success('Eliminado exitosamente');
            await fetchData(type);
        } catch (error) {
            console.error('Delete error:', error);
            message.error('Error al eliminar');
        }
    };

    // Modified confirmUpdate function
    const confirmUpdate = async () => {
        if (!editState.type || !editState.data) return;

        try {
            const endpoint = `http://localhost:8000/${editState.type}s/${editState.data.id}`;

            // Create diffData object containing only changed fields
            const diffData: any = {};
            Object.keys(editState.pendingData || {}).forEach(key => {
                if (JSON.stringify(editState.pendingData[key]) !== JSON.stringify(editState.data[key])) {
                    diffData[key] = editState.pendingData[key];
                }
            });

            // Convert moment dates to ISO strings for transaction fields if changed
            if (editState.type === 'transaction') {
                ['fecha_de_pago', 'fecha_de_efectividad'].forEach(field => {
                    if (diffData[field]?.isValid?.()) {
                        diffData[field] = diffData[field].toISOString();
                    }
                });
            }

            console.log('Updating changed fields:', diffData);

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(diffData),
            });

            if (!response.ok) {
                const errRes: any = await response.json();
                throw new Error(errRes.detail || 'Update failed');
            }

            message.success('Actualización exitosa');
            await fetchData(editState.type);
            setEditState({ visible: false, confirmVisible: false, type: undefined, data: undefined });
            router.refresh();
        } catch (error: any) {
            console.error('Update error:', error);
            message.error(error.message || 'Error en la actualización');
        }
    };

    const renderTransactionForm = () => {
        const type = Form.useWatch('type', form);
        const typeSpecificFields: Partial<Record<TransactionType, React.ReactElement[]>> = {
            INGRESO: [
                <Form.Item key="user_id" label="Usuario" name="user_id" rules={[{ required: true }]}>
                    <Select options={entities.users.map(u => ({ value: u.id, label: u.name }))} />
                </Form.Item>,
                <Form.Item key="fecha_de_pago" label="Fecha de Pago" name="fecha_de_pago" rules={[{ required: true }]}>
                    <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
            ],
            EGRESO: [
                <Form.Item key="horse_id" label="Caballo" name="horse_id" rules={[{ required: true }]}>
                    <Select options={entities.horses.map(h => ({ value: h.id, label: h.name }))} />
                </Form.Item>,
                <Form.Item key="pagado" label="Pagado" name="pagado" valuePropName="checked">
                    <Checkbox />
                </Form.Item>
            ],
            PREMIO: [
                <Form.Item key="horse_id" label="Caballo" name="horse_id" rules={[{ required: true }]}>
                    <Select options={entities.horses.map(h => ({ value: h.id, label: h.name }))} />
                </Form.Item>,
                <Form.Item key="fecha_de_efectividad" label="Fecha de Efectividad" name="fecha_de_efectividad" rules={[{ required: true }]}>
                    <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
                </Form.Item>
            ],
            PAGO: [
                <Form.Item key="user_id" label="Usuario" name="user_id" rules={[{ required: true }]}>
                    <Select options={entities.users.map(u => ({ value: u.id, label: u.name }))} />
                </Form.Item>
            ]
        };

        return (
            <Tabs activeKey={type}>
                {Object.entries(typeSpecificFields).map(([t, fields]) => (
                    <TabPane key={t} tab={t}>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {fields}
                        </div>
                    </TabPane>
                ))}
            </Tabs>
        );
    };

    const renderEditForm = () => {
        if (!editState.type) return null;

        const commonFields = {
            user: [
                <Form.Item key="name" label="Nombre" name="name" rules={[{ required: true }]}>
                    <Input />
                </Form.Item>,
                <Form.Item key="email" label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
                    <Input />
                </Form.Item>,
                <Form.Item key="dni" label="DNI" name="dni">
                    <Input />
                </Form.Item>,
                <Form.Item key="balance" label="Balance" name="balance">
                    <InputNumber className="w-full" />
                </Form.Item>,
                <Form.Item key="is_admin" label="Admin" name="is_admin" valuePropName="checked">
                    <Checkbox />
                </Form.Item>
            ],
            // In the commonFields object for horse, update the fields as follows:
            horse: [
                <Form.Item key="name" label="Nombre" name="name" rules={[{ required: true }]} >
                    <Input />
                </Form.Item>,
                <Form.Item key="total_value" label="Valor Total" name="total_value" rules={[{ required: true }]} >
                    <InputNumber className="w-full" />
                </Form.Item>,
                <Form.Item key="image_url" label="Imagen URL" name="image_url">
                    <Input />
                </Form.Item>,
                <Form.Item key="number_of_installments" label="Número de Cuotas" name="number_of_installments" rules={[{ required: true }]} >
                    <InputNumber className="w-full" />
                </Form.Item>,
                <Form.Item key="starting_billing_month" label="Mes de Facturación Inicial" name="starting_billing_month" rules={[{ required: true }]} >
                    <InputNumber className="w-full" />
                </Form.Item>,
                <Form.Item key="starting_billing_year" label="Año de Facturación Inicial" name="starting_billing_year" rules={[{ required: true }]} >
                    <InputNumber className="w-full" />
                </Form.Item>,
                <Form.Item key="information" label="Información" name="information">
                    <Input.TextArea />
                </Form.Item>,
                <Form.List key="buyers_data" name="buyers_data">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map(({ key, name, ...restField }) => (
                                <div key={key} className="flex gap-4 mb-4 items-end">
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'buyer_id']}
                                        label="Comprador"
                                        rules={[{ required: true }]}
                                        className="flex-1"
                                    >
                                        <Select
                                            options={entities.users.map(u => ({
                                                value: u.id,
                                                label: u.name
                                            }))}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, 'percentage']}
                                        label="Porcentaje"
                                        rules={[{ required: true }]}
                                        className="flex-1"
                                    >
                                        <InputNumber min={1} max={100} />
                                    </Form.Item>
                                    <Button
                                        danger
                                        onClick={() => remove(name)}
                                        className="mb-1"
                                    >
                                        Eliminar
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                block
                                icon={<PlusOutlined />}
                            >
                                Añadir Comprador
                            </Button>
                        </>
                    )}
                </Form.List>
            ],
            transaction: [
                <Form.Item key="type" label="Tipo" name="type" rules={[{ required: true }]}>
                    <Select options={['INGRESO', 'EGRESO', 'PREMIO', 'PAGO'].map(t => ({ value: t, label: t }))} />
                </Form.Item>,
                <Form.Item key="concept" label="Concepto" name="concept">
                    <Input />
                </Form.Item>,
                <Form.Item key="total_amount" label="Monto" name="total_amount" rules={[{ required: true }]}>
                    <InputNumber className="w-full" />
                </Form.Item>,
                <div className="grid grid-cols-2 gap-4" key="fecha">
                    <Form.Item key="mes" label="Mes" name="mes" rules={[{ required: true, min: 1, max: 12, type: 'number' }]}>
                        <InputNumber className="w-full" />
                    </Form.Item>,
                    <Form.Item key="año" label="Año" name="año" rules={[{ required: true, min: 2000, max: 2100, type: 'number' }]}>
                        <InputNumber className="w-full" />
                    </Form.Item>
                </div>,
                <TransactionFormFields key="transaction-form-fields" form={form} entities={entities} />
            ]
        };
        return (
            <Form
                form={form} // <-- Ensure your form instance is passed here
                layout="vertical"
                onFinish={handleFormSubmit}
                initialValues={editState.data}
                onValuesChange={() => form.validateFields()}
            >
                {commonFields[editState.type]}
                <Form.Item className="mt-6">
                    <Button type="primary" htmlType="submit" block>
                        Confirmar Cambios
                    </Button>
                </Form.Item>
            </Form>
        );
    };

    const renderEntityList = (type: EntityType) => {
        const data = entities[`${type}s` as const].filter((entity: any) => {
            const searchTerm = search[type].toLowerCase();
            switch (type) {
                case 'user':
                    return entity.name?.toLowerCase().includes(searchTerm) ||
                        entity.email?.toLowerCase().includes(searchTerm) ||
                        entity.dni?.includes(searchTerm);
                case 'horse':
                    return entity.name?.toLowerCase().includes(searchTerm) ||
                        entity.information?.toLowerCase().includes(searchTerm) ||
                        entity.buyers_data?.some((b: any) =>
                            entities.users.find(u => u.id === b.buyer_id)?.name.toLowerCase().includes(searchTerm)
                        );
                case 'transaction':
                    return entity.concept?.toLowerCase().includes(searchTerm) ||
                        entity.type?.toLowerCase().includes(searchTerm) ||
                        entities.users.find(u => u.id === entity.user_id)?.name.toLowerCase().includes(searchTerm) ||
                        entities.horses.find(h => h.id === entity.horse_id)?.name.toLowerCase().includes(searchTerm);
                default:
                    return true;
            }
        });

        return (
            <>
                <Search
                    placeholder={type === 'transaction'
                        ? 'Buscar transacciones por tipo, concepto, usuario o caballo'
                        : `Buscar ${type}s`}
                    onChange={e => handleSearch(e.currentTarget.value, type)}
                    className="mb-4"
                    allowClear
                />
                {loading[type] ? (
                    <div className="text-center p-4">
                        <Spin />
                    </div>
                ) : (
                    <List
                        dataSource={data}
                        renderItem={(item: any) => (

                            <List.Item
                                actions={[
                                    <Button key="edit" type="link" onClick={() => handleEdit(item, type)}>
                                        Editar
                                    </Button>,
                                    <Button key="delete" danger type="link" onClick={() => handleDelete(item.id, type)}>
                                        Eliminar
                                    </Button>
                                ]}
                            >
                                <List.Item.Meta
                                    title={item.name || item.concept || `Transacción ${item.id}`}
                                    description={
                                        type === 'user'
                                            ? item.email
                                            : type === 'horse'
                                                ? `Valor: $${item.total_value}`
                                                : `Monto: $${item.total_amount} | ${item.mes}/${item.año}`
                                    }
                                />
                            </List.Item>
                        )}
                    />
                )}
            </>
        );
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Gestión de Entidades</h1>

            <Tabs defaultActiveKey="user">
                <TabPane key="user" tab={<span><UserOutlined /> Usuarios</span>}>
                    {renderEntityList('user')}
                </TabPane>
                <TabPane key="horse" tab={<span><TeamOutlined /> Caballos</span>}>
                    {renderEntityList('horse')}
                </TabPane>
                <TabPane key="transaction" tab={<span><TransactionOutlined /> Transacciones</span>}>
                    {renderEntityList('transaction')}
                </TabPane>
            </Tabs>

            <Modal
                title={`Editar ${editState.type}`}
                open={editState.visible}
                onCancel={() => setEditState(prev => ({ ...prev, visible: false }))}
                footer={null}
                destroyOnClose
                width={800}
            >
                {renderEditForm()}
            </Modal>

            <Modal
                title="Confirmar Cambios"
                open={editState.confirmVisible}
                onOk={confirmUpdate}
                onCancel={() => setEditState(prev => ({ ...prev, confirmVisible: false }))}
                okText="Confirmar"
                cancelText="Cancelar"
            >
                {editState.pendingData && (
                    <Descriptions bordered column={1}>
                        {Object.entries(editState.pendingData).map(([key, value]) => (
                            <Descriptions.Item key={key} label={key}>
                                {typeof value === 'object' ? JSON.stringify(value) : value?.toString()}
                            </Descriptions.Item>
                        ))}
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
};

// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default EditarClient;