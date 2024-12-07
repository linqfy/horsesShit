import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select } from 'antd';
import axios from 'axios';
import React, { useEffect, useState } from 'react';

const { Option } = Select;

interface Horse {
    id: number;
    name: string;
    [key: string]: any;
}

interface User {
    id: number;
    name: string;
    email: string;
    horses?: Horse[];
    [key: string]: any;
}

interface HorseBuyer {
    id: number;
    horse_id: number;
    buyer_id: number;
    [key: string]: any;
}

const UsuariosPage: React.FC = () => {
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [caballos, setCaballos] = useState<Horse[]>([]);
    const [horseBuyers, setHorseBuyers] = useState<HorseBuyer[]>([]);
    const [selectedCaballo, setSelectedCaballo] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        try {
            const [usersRes, horsesRes, horseBuyersRes] = await Promise.all([
                axios.get('http://localhost:8000/users'),
                axios.get('http://localhost:8000/horses'),
                axios.get('http://localhost:8000/horse-buyers'),
            ]);

            const usuariosData: User[] = usersRes.data;
            const caballosData: Horse[] = horsesRes.data;
            const horseBuyersData: HorseBuyer[] = horseBuyersRes.data;

            // Build a mapping of horses
            const horseMap: { [key: number]: Horse } = {};
            caballosData.forEach((horse) => {
                horseMap[horse.id] = horse;
            });

            // For each user, find the horses they own
            const usuariosWithHorses = usuariosData.map((user) => {
                const userHorseBuyers = horseBuyersData.filter(
                    (hb) => hb.buyer_id === user.id
                );
                const userHorses = userHorseBuyers.map((hb) => horseMap[hb.horse_id]);
                return { ...user, horses: userHorses };
            });

            setUsuarios(usuariosWithHorses);
            setCaballos(caballosData);
            setHorseBuyers(horseBuyersData);
        } catch (error) {
            console.error('Error al cargar datos', error);
        }
    };

    const filtrarUsuarios = () => {
        return usuarios.filter((usuario) => {
            const matchesSearch = usuario.name
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
            const matchesCaballo = selectedCaballo
                ? usuario.horses?.some((horse) => horse.id === selectedCaballo)
                : true;
            return matchesSearch && matchesCaballo;
        });
    };

    return (
        <div>
            <h1>Gestión de Usuarios</h1>
            <div style={{ display: 'flex', marginBottom: '16px' }}>
                <Input
                    placeholder="Buscar por nombre"
                    prefix={<SearchOutlined />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mr-4"
                />
                <Select
                    placeholder="Filtrar por caballo"
                    allowClear
                    style={{ width: 200 }}
                    onChange={(value) => setSelectedCaballo(value)}
                >
                    {caballos.map((caballo) => (
                        <Option key={caballo.id} value={caballo.id}>
                            {caballo.name}
                        </Option>
                    ))}
                </Select>
            </div>

            <div>
                {filtrarUsuarios().map((usuario) => (
                    <Card
                        key={usuario.id}
                        title={usuario.name}
                        actions={[<Button key="link" href={`/usuario/${usuario.id}`}>Ver Detalles</Button>]}
                    >
                        <p>Email: {usuario.email}</p>
                        <p>Número de Caballos: {usuario.horses?.length || 0}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default UsuariosPage;
