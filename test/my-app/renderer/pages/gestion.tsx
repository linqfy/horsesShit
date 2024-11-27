import { Button, Card, Form, Input, InputNumber, message, Select } from 'antd';
import axios from 'axios';
import React, { useState } from 'react';

const { Option } = Select;

const GestionPage: React.FC = () => {
    const [loading, setLoading] = useState(false);

    const handleTransaction = async (values: any) => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/transactions/', values);
            message.success('Transacción registrada correctamente');
        } catch (error) {
            console.error('Error al registrar transacción', error);
            message.error('No se pudo registrar la transacción');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Gestión de Transacciones</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Registrar Ingreso">
                    <Form layout="vertical" onFinish={handleTransaction}>
                        <Form.Item name="user_id" label="Usuario" rules={[{ required: true }]}>
                            <Select placeholder="Seleccione un usuario">
                                {/* Mapear usuarios */}
                                <Option value="1">Usuario 1</Option>
                                <Option value="2">Usuario 2</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="concept" label="Concepto" rules={[{ required: true }]}>
                            <Select placeholder="Seleccione un concepto">
                                <Option value="mensual">Pago Mensual</Option>
                                <Option value="extra">Pago Extra</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name="total_amount" label="Monto" rules={[{ required: true }]}>
                            <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="notes" label="Notas">
                            <Input.TextArea rows={3} />
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Registrar Ingreso
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
                {/* Repetir Card para EGRESO, PREMIO, PAGO cambiando los campos según sea necesario */}
            </div>
        </div>
    );
};

export default GestionPage;
