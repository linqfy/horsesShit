// pages/crear/usuario.tsx
"use client"; // Forces client-side rendering

import { Button, Checkbox, Form, Input, message } from 'antd';
import { useRouter } from 'next/navigation';
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
            // Realiza una solicitud POST para crear un nuevo usuario usando fetch
            const response = await fetch('http://localhost:8000/users/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            if (!response.status.toString().startsWith('2')) {
                // Manejo de errores basado en el código de estado HTTP
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error al crear usuario.');
            }

            message.success('Usuario creado exitosamente');
            router.push('/usuarios'); // Redirige a la página de la lista de usuarios
        } catch (error: any) {
            console.error('Error al crear usuario:', error);
            message.error(error.message || 'Error al crear usuario');
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

// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default CrearUsuario;
