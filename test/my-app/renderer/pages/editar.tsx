// pages/editar/index.tsx

import { TeamOutlined, TransactionOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Checkbox, Collapse, Form, Input, List, Modal, Spin, message } from 'antd';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

const { Panel } = Collapse;
const { Search } = Input;

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
    type: 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';
    concept: string;
    total_amount: number;
    notes?: string;
    horse_id?: number;
    user_id?: number;
    date: string;
    created_at: string;
    updated_at: string;
}

const EditarPage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [horses, setHorses] = useState<Horse[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
    const [loadingHorses, setLoadingHorses] = useState<boolean>(true);
    const [loadingTransactions, setLoadingTransactions] = useState<boolean>(true);
    const [userSearch, setUserSearch] = useState<string>('');
    const [horseSearch, setHorseSearch] = useState<string>('');
    const [transactionSearch, setTransactionSearch] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [form] = Form.useForm();
    const [updating, setUpdating] = useState<boolean>(false);

    useEffect(() => {
        fetchUsers();
        fetchHorses();
        fetchTransactions();
    }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await axios.get('http://localhost:8000/users/');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users', error);
            message.error('Error al cargar usuarios');
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchHorses = async () => {
        setLoadingHorses(true);
        try {
            const response = await axios.get('http://localhost:8000/horses/');
            setHorses(response.data);
        } catch (error) {
            console.error('Error fetching horses', error);
            message.error('Error al cargar caballos');
        } finally {
            setLoadingHorses(false);
        }
    };

    const fetchTransactions = async () => {
        setLoadingTransactions(true);
        try {
            const response = await axios.get('http://localhost:8000/transactions/');
            setTransactions(response.data);
        } catch (error) {
            console.error('Error fetching transactions', error);
            message.error('Error al cargar transacciones');
        } finally {
            setLoadingTransactions(false);
        }
    };

    const handleEdit = (item: any, type: 'user' | 'horse' | 'transaction') => {
        setSelectedItem({ ...item, type });
        form.resetFields();
        setModalVisible(true);
    };

    const handleUpdate = async (values: any) => {
        setUpdating(true);
        try {
            const { type, id } = selectedItem;
            let endpoint = '';
            let payload = { ...values };
            if (type === 'user') {
                endpoint = `http://localhost:8000/users/${id}`;
            } else if (type === 'horse') {
                endpoint = `http://localhost:8000/horses/${id}`;
                payload = { ...selectedItem, ...values };
            } else if (type === 'transaction') {
                endpoint = `http://localhost:8000/transactions/${id}`;
            }

            await axios.put(endpoint, payload);
            message.success('Actualización exitosa');

            // Refresh data
            if (type === 'user') {
                fetchUsers();
            } else if (type === 'horse') {
                fetchHorses();
            } else if (type === 'transaction') {
                fetchTransactions();
            }

            setModalVisible(false);
        } catch (error) {
            console.error('Error updating item', error);
            message.error('Error al actualizar');
        } finally {
            setUpdating(false);
        }
    };

    const renderEditForm = () => {
        if (!selectedItem) return null;
        const { type } = selectedItem;

        if (type === 'user') {
            return (
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={selectedItem}
                    onFinish={handleUpdate}
                >
                    <Form.Item
                        label="Nombre"
                        name="name"
                        rules={[{ required: true, message: 'Ingrese el nombre' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Correo Electrónico"
                        name="email"
                        rules={[
                            { required: true, message: 'Ingrese el correo electrónico' },
                            { type: 'email', message: 'Ingrese un correo electrónico válido' },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="DNI"
                        name="dni"
                        rules={[{ required: true, message: 'Ingrese el DNI' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item label="Balance" name="balance">
                        <Input />
                    </Form.Item>
                    <Form.Item label="Es Admin" name="is_admin" valuePropName="checked">
                        <Checkbox>Es Administrador</Checkbox>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updating}>
                            Actualizar Usuario
                        </Button>
                    </Form.Item>
                </Form>
            );
        } else if (type === 'horse') {
            return (
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={selectedItem}
                    onFinish={handleUpdate}
                >
                    <Form.Item
                        label="Nombre"
                        name="name"
                        rules={[{ required: true, message: 'Ingrese el nombre' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Información"
                        name="information"
                        rules={[{ required: true, message: 'Ingrese la información' }]}
                    >
                        <Input.TextArea rows={4} />
                    </Form.Item>
                    <Form.Item
                        label="URL de la Imagen"
                        name="image_url"
                        rules={[{ required: true, message: 'Ingrese la URL de la imagen' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Valor Total"
                        name="total_value"
                        rules={[{ required: true, message: 'Ingrese el valor total' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Número de Cuotas"
                        name="number_of_installments"
                        rules={[{ required: true, message: 'Ingrese el número de cuotas' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updating}>
                            Actualizar Caballo
                        </Button>
                    </Form.Item>
                </Form>
            );
        } else if (type === 'transaction') {
            return (
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={selectedItem}
                    onFinish={handleUpdate}
                >
                    <Form.Item
                        label="Tipo"
                        name="type"
                        rules={[{ required: true, message: 'Seleccione el tipo' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Concepto"
                        name="concept"
                        rules={[{ required: true, message: 'Ingrese el concepto' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        label="Monto Total"
                        name="total_amount"
                        rules={[{ required: true, message: 'Ingrese el monto total' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item label="Notas" name="notes">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                    <Form.Item label="ID del Caballo" name="horse_id">
                        <Input />
                    </Form.Item>
                    <Form.Item label="ID del Usuario" name="user_id">
                        <Input />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={updating}>
                            Actualizar Transacción
                        </Button>
                    </Form.Item>
                </Form>
            );
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Editar</h1>
            <Collapse accordion>
                {/* Users Panel */}
                <Panel header="Usuarios" key="users" extra={<UserOutlined />}>
                    <Search
                        placeholder="Buscar usuarios"
                        onChange={(e) => setUserSearch(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                    {loadingUsers ? (
                        <Spin />
                    ) : (
                        <List
                            dataSource={users.filter((user) =>
                                user.name.toLowerCase().includes(userSearch.toLowerCase())
                            )}
                            renderItem={(user) => (
                                <List.Item
                                    actions={[
                                        <Button type="link" onClick={() => handleEdit(user, 'user')}>
                                            Editar
                                        </Button>,
                                    ]}
                                >
                                    {user.name} - {user.email}
                                </List.Item>
                            )}
                        />
                    )}
                </Panel>
                {/* Horses Panel */}
                <Panel header="Caballos" key="horses" extra={<TeamOutlined />}>
                    <Search
                        placeholder="Buscar caballos"
                        onChange={(e) => setHorseSearch(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                    {loadingHorses ? (
                        <Spin />
                    ) : (
                        <List
                            dataSource={horses.filter((horse) =>
                                horse.name.toLowerCase().includes(horseSearch.toLowerCase())
                            )}
                            renderItem={(horse) => (
                                <List.Item
                                    actions={[
                                        <Button type="link" onClick={() => handleEdit(horse, 'horse')}>
                                            Editar
                                        </Button>,
                                    ]}
                                >
                                    {horse.name}
                                </List.Item>
                            )}
                        />
                    )}
                </Panel>
                {/* Transactions Panel */}
                <Panel header="Transacciones" key="transactions" extra={<TransactionOutlined />}>
                    <Search
                        placeholder="Buscar transacciones"
                        onChange={(e) => setTransactionSearch(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                    {loadingTransactions ? (
                        <Spin />
                    ) : (
                        <List
                            dataSource={transactions.filter((transaction) =>
                                transaction.concept
                                    .toLowerCase()
                                    .includes(transactionSearch.toLowerCase())
                            )}
                            renderItem={(transaction) => (
                                <List.Item
                                    actions={[
                                        <Button
                                            type="link"
                                            onClick={() => handleEdit(transaction, 'transaction')}
                                        >
                                            Editar
                                        </Button>,
                                    ]}
                                >
                                    {transaction.type} - {transaction.concept}
                                </List.Item>
                            )}
                        />
                    )}
                </Panel>
            </Collapse>

            <Modal
                visible={modalVisible}
                title={`Editar ${selectedItem?.type === 'user' ? 'Usuario' : selectedItem?.type === 'horse' ? 'Caballo' : 'Transacción'}`}
                onCancel={() => setModalVisible(false)}
                footer={null}
            >
                {renderEditForm()}
            </Modal>
        </div>
    );
};

export default EditarPage;
