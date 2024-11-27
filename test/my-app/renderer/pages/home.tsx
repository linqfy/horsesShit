import { TeamOutlined, TransactionOutlined, UserOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import Link from 'next/link';
import React from 'react';

const { Header, Content, Sider } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <Layout>
      <Header className="bg-white">
        <div className="text-2xl font-bold">Sistema de Gestión Ecuestre</div>
      </Header>
      <Layout>
        <Sider width={200} className="site-layout-background">
          <Menu mode="inline" defaultSelectedKeys={['usuarios']} style={{ height: '100%', borderRight: 0 }}>
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
