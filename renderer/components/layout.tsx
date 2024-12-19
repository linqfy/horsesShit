import {
  DownOutlined,
  LeftOutlined,
  TeamOutlined,
  TransactionOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Layout, Menu } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

const { Header, Content, Sider } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const router = useRouter();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      setGreeting('Buenos días');
    } else if (currentHour < 18) {
      setGreeting('Buenas tardes');
    } else {
      setGreeting('Buenas noches');
    }
  }, []);

  const createMenu = (
    <Menu>
      <Menu.Item key="usuario">
        <Link href="/crear/usuario">Usuario</Link>
      </Menu.Item>
      <Menu.Item key="caballo">
        <Link href="/crear/caballo">Caballo</Link>
      </Menu.Item>
      <Menu.Item key="editar">
        <Link href="/editar">Editar</Link>
      </Menu.Item>
      <Menu.Item key="informe">
        <Link href="/informe">Informe</Link>
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout style={{ width: '100vw', backgroundColor: 'white' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: '0 16px' }}>
        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'black' }}>{greeting}</div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            icon={<LeftOutlined />}
            onClick={() => router.back()}
            style={{ marginRight: '16px' }}
          >
            Volver
          </Button>
          <Dropdown overlay={createMenu} trigger={['click']}>
            <Button>
              Crear <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ backgroundColor: 'white' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['usuarios']}
            style={{ height: '100%', borderRight: 0 }}
          >
            <Menu.Item key="usuarios" icon={<UserOutlined />}>
              <Link href="/usuarios">Usuarios</Link>
            </Menu.Item>
            <Menu.Item key="caballos" icon={<TeamOutlined />}>
              <Link href="/caballos">Caballos</Link>
            </Menu.Item>
            <Menu.Item key="gestion" icon={<TransactionOutlined />}>
              <Link href="/gestion">Gestión</Link>
            </Menu.Item>
          </Menu>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ backgroundColor: 'white', borderRadius: '10px' }}>{children}</Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
