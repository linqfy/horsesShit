'use client'
// pages/crear/caballo.tsx

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
    Button,
    Form,
    Input,
    InputNumber,
    message,
    Select,
    Space,
    Typography,
} from 'antd';
import axios from 'axios';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { Option } = Select;
const { Title } = Typography;

interface User {
    id: number;
    name: string;
    email: string;
}

interface BuyerData {
    buyer_id: number;
    percentage: number;
}

interface HorseFormValues {
    name: string;
    information?: string | null;
    image_url?: string | null;
    total_value: number;
    number_of_installments: number;
    starting_billing_month: number;
    buyers_data: BuyerData[];
}

const CrearCaballo: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const router = useRouter();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('http://localhost:8000/users/');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users', error);
            message.error('Error al cargar usuarios');
        }
    };

    const onFinish = async (values: HorseFormValues) => {
        setLoading(true);
        try {
            // Validar que la suma de porcentajes sea 100%
            const totalPercentage = values.buyers_data.reduce(
                (sum, buyer) => sum + buyer.percentage,
                0
            );
            if (totalPercentage !== 100) {
                message.error('El porcentaje total de los compradores debe ser 100%');
                setLoading(false);
                return;
            }

            // Manejar campos opcionales si están vacíos
            const payload = {
                ...values,
                information: values.information || null,
                image_url: values.image_url || null,
            };

            // Hacer una solicitud POST para crear un nuevo caballo
            await axios.post('http://localhost:8000/horses/', payload);
            message.success('Caballo creado exitosamente');
            router.push('/caballos'); // Redirigir a la página de lista de caballos
        } catch (error) {
            console.error('Error al crear caballo', error);
            message.error('Error al crear caballo');
        } finally {
            setLoading(false);
        }
    };

    // Opciones para los meses
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

    return (
        <div className="p-6">
            <Title level={2}>Crear Caballo</Title>
            <Form layout="vertical" onFinish={onFinish}>
                <Form.Item
                    label="Nombre"
                    name="name"
                    rules={[{ required: true, message: 'Por favor ingrese el nombre del caballo' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="Información"
                    name="information"
                    rules={[{ required: false }]}
                >
                    <Input.TextArea rows={4} />
                </Form.Item>
                <Form.Item
                    label="URL de la Imagen"
                    name="image_url"
                    rules={[{ required: false }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="Valor Total"
                    name="total_value"
                    rules={[{ required: true, message: 'Por favor ingrese el valor total' }]}
                >
                    <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                    label="Número de Cuotas"
                    name="number_of_installments"
                    rules={[{ required: true, message: 'Por favor ingrese el número de cuotas' }]}
                >
                    <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                    label="Mes de Facturación Inicial (la primera cuota se facturará en el siguiente mes)"
                    name="starting_billing_month"
                    rules={[
                        { required: true, message: 'Por favor seleccione el mes de facturación inicial' },
                    ]}
                >
                    <Select placeholder="Seleccione un mes">
                        {monthOptions.map((month) => (
                            <Option key={month.value} value={month.value}>
                                {month.label}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Title level={4}>Compradores</Title>
                <Form.List name="buyers_data" initialValue={[{}]}>
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map((field, index) => (
                                <Space
                                    key={field.key}
                                    style={{ display: 'flex', marginBottom: 8 }}
                                    align="start"
                                >
                                    <Form.Item
                                        {...field}
                                        name={[field.name, 'buyer_id']}
                                        fieldKey={[field.fieldKey, 'buyer_id']}
                                        rules={[{ required: true, message: 'Seleccione un comprador' }]}
                                    >
                                        <Select
                                            placeholder="Seleccione un comprador"
                                            style={{ width: 200 }}
                                            showSearch
                                            optionFilterProp="children"
                                        >
                                            {users.map((user) => (
                                                <Option key={user.id} value={user.id}>
                                                    {user.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item
                                        {...field}
                                        name={[field.name, 'percentage']}
                                        fieldKey={[field.fieldKey, 'percentage']}
                                        rules={[{ required: true, message: 'Ingrese el porcentaje' }]}
                                    >
                                        <InputNumber
                                            min={1}
                                            max={100}
                                            placeholder="Porcentaje"
                                        />
                                    </Form.Item>
                                    {fields.length > 1 ? (
                                        <MinusCircleOutlined
                                            onClick={() => remove(field.name)}
                                            style={{ marginTop: 8 }}
                                        />
                                    ) : null}
                                </Space>
                            ))}
                            <Form.Item>
                                <Button
                                    type="dashed"
                                    onClick={() => add()}
                                    style={{ width: '60%' }}
                                    icon={<PlusOutlined />}
                                >
                                    Añadir Comprador
                                </Button>
                            </Form.Item>
                        </>
                    )}
                </Form.List>

                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>
                        Crear Caballo
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default CrearCaballo;
