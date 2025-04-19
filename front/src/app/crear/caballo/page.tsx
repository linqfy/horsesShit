// pages/crear/caballo.tsx
"use client"; // Ensure this directive is present

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
    Button,
    Descriptions,
    Form,
    Input,
    InputNumber,
    List,
    message,
    Modal,
    Select,
    Space,
    Typography,
} from 'antd';
import { useRouter } from 'next/navigation';
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
    starting_billing_year: number;
    buyers_data: BuyerData[];
}

const CrearCaballo: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [form] = Form.useForm<HorseFormValues>();
    const [loading, setLoading] = useState<boolean>(false);
    const router = useRouter();
    const [totalPercentage, setTotalPercentage] = useState(0);
    const [modalVisible, setModalVisible] = useState(false);
    const [modalData, setModalData] = useState<HorseFormValues | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const updateTotalPercentage = (values: HorseFormValues) => {
        try {
            if (values.buyers_data) {
                let totalPercentage = values.buyers_data.reduce(
                    (sum, buyer) => sum + (buyer && !isNaN(buyer.percentage) ? buyer.percentage : 0),
                    0
                );
                setTotalPercentage(isNaN(totalPercentage) ? NaN : totalPercentage);
            } else {
                setTotalPercentage(0);
            }
        } catch (error) {
            console.error('Error updating total percentage:', error);
            setTotalPercentage(NaN);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch('http://localhost:8000/users/');
            if (!response.ok) {
                throw new Error('Error al cargar usuarios.');
            }
            const data: User[] = await response.json();
            setUsers(data);
        } catch (error: any) {
            console.error('Error fetching users:', error);
            message.error('Error al cargar usuarios');
        }
    };

    const handleModalCancel = () => {
        setModalVisible(false);
    };

    const handleModalOk = async () => {
        if (!modalData) return;
        // Validate that the total percentage is 100%
        const totalPercentageCalc = modalData.buyers_data.reduce(
            (sum, buyer) => sum + buyer.percentage,
            0
        );
        if (totalPercentageCalc !== 100) {
            message.error('El porcentaje total de los compradores debe ser 100%');
            setModalVisible(false);
            return;
        }
        setLoading(true);
        try {
            // Prepare payload handling optional fields
            const payload = {
                ...modalData,
                information: modalData.information || null,
                image_url: modalData.image_url || null,
            };

            const response = await fetch('http://localhost:8000/horses/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.status.toString().startsWith('2')) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al crear caballo.');
            }

            message.success('Caballo creado exitosamente');
            form.resetFields();
            router.push('/caballos');
        } catch (error: any) {
            console.error('Error al crear caballo:', error);
            message.error(error.message || 'Error al crear caballo');
        } finally {
            setLoading(false);
            setModalVisible(false);
        }
    };

    const handleFinish = (values: HorseFormValues) => {
        setModalData(values);
        setModalVisible(true);
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
            <Form layout="vertical" onFinish={handleFinish} form={form} onValuesChange={(_, allValues) => updateTotalPercentage(allValues)}>
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
                    <InputNumber
                        min={0}
                        style={{ width: '100%' }}
                        formatter={(value) =>
                            `${value}`.replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',')
                        }
                        parser={(value) => {
                            try {
                                return Number(value?.replace(/,/g, '') || 0)
                            } catch {
                                return 0
                            }
                        }}
                        decimalSeparator="."
                        step={0.01}
                    />
                </Form.Item>
                <Form.Item
                    label="Número de Cuotas"
                    name="number_of_installments"
                    rules={[{ required: true, message: 'Por favor ingrese el número de cuotas' }]}
                >
                    <InputNumber min={0} style={{ width: '100%' }} />
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

                <Form.Item
                    label="Año de Facturación Inicial"
                    name="starting_billing_year"
                    rules={[{ required: true, message: 'Por favor ingrese el año de facturación inicial' }]}
                >
                    <InputNumber min={2000} style={{ width: '100%' }} />
                </Form.Item>

                <Title level={4}>Compradores</Title>
                <Form.List name="buyers_data" initialValue={[{}]}>
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map((field) => {
                                const { key, ...restField } = field; // Destructure key from field
                                return (
                                    <Space
                                        key={key} // Key set directly on parent element
                                        style={{ display: 'flex', marginBottom: 8 }}
                                        align="start"
                                    >
                                        {/* Buyer Select */}
                                        <Form.Item
                                            {...restField}
                                            name={[restField.name, 'buyer_id']}
                                            rules={[{ required: true, message: 'Seleccione un comprador' }]}
                                        >
                                            <Select
                                                placeholder="Seleccione un comprador"
                                                options={users.map(user => ({
                                                    label: user.name,
                                                    value: user.id,
                                                }))}
                                                showSearch
                                                optionFilterProp="label"
                                            />
                                        </Form.Item>

                                        {/* Percentage Input */}
                                        <Form.Item
                                            {...restField}
                                            name={[restField.name, 'percentage']}
                                            initialValue={1}
                                            rules={[{ required: true, message: 'Ingrese el porcentaje' }]}
                                        >
                                            <InputNumber
                                                min={1}
                                                max={100}
                                                formatter={(value) => `${value}%`}
                                                parser={(value) => Number(value?.replace('%', '')) as 1 | 100}
                                                placeholder="Porcentaje"
                                                step={0.5}
                                                style={{ width: 150 }}
                                            />
                                        </Form.Item>

                                        {/* Remove Button */}
                                        {fields.length > 1 && (
                                            <MinusCircleOutlined
                                                onClick={() => remove(restField.name)}
                                                style={{ marginTop: 8, color: '#ff4d4f' }}
                                            />
                                        )}
                                    </Space>
                                );
                            })}

                            {/* Add Buyer Button */}
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
                    <Form.Item>
                        {!isNaN(totalPercentage) && <p>Porcentaje total actual: {totalPercentage}%</p>}
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} disabled={totalPercentage !== 100}>
                        Crear Caballo
                    </Button>
                </Form.Item>
            </Form>

            <Modal
                visible={modalVisible}
                title="Confirme los datos ingresados"
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                okText="Confirmar"
                cancelText="Cancelar"
            >
                {modalData ? (
                    <Descriptions title="Detalles del Caballo" bordered column={1}>
                        <Descriptions.Item label="Nombre">{modalData.name}</Descriptions.Item>
                        <Descriptions.Item label="Información">{modalData.information || '-'}</Descriptions.Item>
                        <Descriptions.Item label="URL de la Imagen">{modalData.image_url || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Valor Total">{modalData.total_value}</Descriptions.Item>
                        <Descriptions.Item label="Número de Cuotas">{modalData.number_of_installments}</Descriptions.Item>
                        <Descriptions.Item label="Mes de Facturación Inicial">
                            {monthOptions.find(option => option.value === modalData.starting_billing_month)?.label || modalData.starting_billing_month}
                        </Descriptions.Item>
                        <Descriptions.Item label="Año de Facturación Inicial">{modalData.starting_billing_year}</Descriptions.Item>
                        <Descriptions.Item label="Compradores">
                            {modalData.buyers_data && modalData.buyers_data.length > 0 ? (
                                <List
                                    dataSource={modalData.buyers_data}
                                    renderItem={(buyer, index) => (
                                        <List.Item key={index}>
                                            {`Comprador: ${buyer.buyer_id}, Porcentaje: ${buyer.percentage}%`}
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                '-'
                            )}
                        </Descriptions.Item>
                    </Descriptions>
                ) : (
                    <p>No hay datos a mostrar.</p>
                )}
            </Modal>
        </div>
    );

};

// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default CrearCaballo;
