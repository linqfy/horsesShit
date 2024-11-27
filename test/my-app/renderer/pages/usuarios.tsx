import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select } from 'antd';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

const { Option } = Select;

const UsuariosPage: React.FC = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [caballos, setCaballos] = useState([]);
    const [selectedCaballo, setSelectedCaballo] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        cargarUsuarios();
        cargarCaballos();
    }, []);

    const cargarUsuarios = async () => {
        try {
            const response = await axios.get('http://localhost:8000/users');
            setUsuarios(response.data);
        } catch (error) {
            console.error('Error al cargar usuarios', error);
        }
    };

    const cargarCaballos = async () => {
        try {
            const response = await axios.get('http://localhost:8000/horses');
            setCaballos(response.data);
        } catch (error) {
            console.error('Error al cargar caballos', error);
        }
    };

    const filtrarUsuarios = () => {
        return usuarios.filter((usuario: any) => {
            const matchesSearch = usuario.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCaballo = selectedCaballo
                ? usuario.horses.some((horse: any) => horse.id === selectedCaballo)
                : true;
            return matchesSearch && matchesCaballo;
        });
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Gestión de Usuarios</h1>
            <div className="flex items-center mb-4">
                <Input
                    placeholder="Buscar usuarios..."
                    prefix={<SearchOutlined />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mr-4"
                />
                <Select
                    placeholder="Filtrar por caballo"
                    style={{ width: 200 }}
                    allowClear
                    onChange={(value) => setSelectedCaballo(value)}
                >
                    {caballos.map((caballo: any) => (
                        <Option key={caballo.id} value={caballo.id}>
                            {caballo.name}
                        </Option>
                    ))}
                </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtrarUsuarios().map((usuario: any) => (
                    <Card
                        key={usuario.id}
                        title={usuario.name}
                        extra={<UserOutlined />}
                        actions={[
                            <Button type="link" href={`/usuario/${usuario.id}`}>
                                Ver Detalles
                            </Button>,
                        ]}
                    >
                        <p>Email: {usuario.email}</p>
                        {/*<p>Número de Caballos: {usuario.horses.length}</p> */}
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default UsuariosPage;
