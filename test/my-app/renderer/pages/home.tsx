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
import React from 'react';

const { Header, Content, Sider } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const router = useRouter();

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
    <Layout>
      <Header className="bg-white">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">Buenos dias</div>
          <div className="flex items-center">
            <Button
              icon={<LeftOutlined />}
              onClick={() => router.back()}
              style={{ marginRight: 16 }}
            >
              Volver
            </Button>
            <Dropdown overlay={createMenu} trigger={['click']}>
              <Button>
                Crear <DownOutlined />
              </Button>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Layout>
        <Sider width={200} className="site-layout-background">
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
          <Content className="site-layout-background">{children}</Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
