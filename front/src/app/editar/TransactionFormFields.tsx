'use client'
import { Checkbox, DatePicker, Form, Select, Tabs } from 'antd';
import React from 'react';
const { TabPane } = Tabs;
type TransactionType = 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';

interface TransactionFormFieldsProps {
    form: any;
    entities: {
        users: { id: number; name: string }[];
        horses: { id: number; name: string }[];
    };
}

const TransactionFormFields = ({ form, entities }: TransactionFormFieldsProps) => {
    // The hook is now always called in the same order.
    const type = Form.useWatch('type', form) as TransactionType | undefined;

    const typeSpecificFields: Partial<Record<TransactionType, JSX.Element[]>> = {
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
            <Form.Item key="user_id" label="Usuario" name="user_id">
            <Select options={entities.users.map(u => ({ value: u.id, label: u.name }))} />
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

export default TransactionFormFields;