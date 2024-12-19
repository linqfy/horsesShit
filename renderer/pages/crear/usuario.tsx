'use client'; // Forces client-side rendering

import { Button, Checkbox, Form, Input, message } from 'antd';
import axios from 'axios';
import { useRouter } from 'next/router';
import React, { useState } from 'react';

interface UserFormValues {
    name: string;
    email: string;
    dni: string;
    is_admin: boolean;
}

const CrearUsuario: React.FC = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const router = useRouter();

    const onFinish = async (values: UserFormValues) => {
        setLoading(true);
        try {
            // Make a POST request to create a new user
            await axios.post('http://localhost:8000/users/', values);
            message.success('Usuario creado exitosamente');
            router.push('/usuarios'); // Redirect to the users list page
        } catch (error) {
            console.error('Error al crear usuario', error);
            message.error('Error al crear usuario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Crear Usuario</h1>
            <Form layout="vertical" onFinish={onFinish}>
                <Form.Item
                    label="Nombre"
                    name="name"
                    rules={[{ required: true, message: 'Por favor ingrese el nombre' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="Correo Electrónico"
                    name="email"
                    rules={[
                        { required: true, message: 'Por favor ingrese el correo electrónico' },
                        { type: 'email', message: 'Ingrese un correo electrónico válido' },
                    ]}
                >
                    <Input />
                </Form.Item>
                <Form.Item
                    label="DNI"
                    name="dni"
                    rules={[{ required: true, message: 'Por favor ingrese el DNI' }]}
                >
                    <Input />
                </Form.Item>
                <Form.Item name="is_admin" valuePropName="checked" initialValue={false}>
                    <Checkbox>Cuenta de Administrador? (Solo si es tu cuenta)</Checkbox>
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading}>
                        Crear Usuario
                    </Button>
                </Form.Item>
            </Form>
        </div>
    );
};

export default CrearUsuario;
