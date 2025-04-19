"use client";

import { BarsOutlined, CalendarOutlined, ControlOutlined, DeleteOutlined, DollarOutlined, EditOutlined, ExclamationCircleOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import { Button, Checkbox, DatePicker, Input, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import locale from 'antd/lib/date-picker/locale/es_ES';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { use, useEffect, useState } from 'react';
import { Interface } from 'readline';

dayjs.locale('es');

const { RangePicker } = DatePicker;
const { Option } = Select;
const { confirm } = Modal;

// Tipos

type TransactionType = 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';

interface User {
  id: number;
  name: string;
  email: string;
  dni: number;
  is_admin: boolean;
  balance: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
interface Transaction {
  id: number;
  type: 'INGRESO' | 'EGRESO' | 'PREMIO' | 'PAGO';
  concept: string | null;
  total_amount: number;
  notes: string | null;
  horse_id: number | null;
  user_id: number | null;
  mes: number;
  año: number;
  fecha_de_pago: string | null;
  fecha_de_efectividad: string | null;
  pagado: boolean | null;
  date: string;
  created_at: string;
  updated_at: string;
}

interface Horse {
  id: number;
  name: string;
  information: string | null;
  image_url: string | null;
  total_value: number;
  number_of_installments: number;
  starting_billing_month: number;
  starting_billing_year: number;
  creation_date: string;
  total_percentage: number;
  buyers: HorseBuyer[];
  transactions?: Transaction[];
  installments?: any[];
}

interface HorseBuyer {
  id: number;
  horse_id: number;
  buyer_id: number;
  buyer_name?: string;
  percentage: number;
  balance: number;
  active: boolean;
}

interface Installment {
  id: number;
  horse_id: number;
  horse_name?: string;
  amount: number;
  installment_number: number;
  mes: number;
  año: number;
  due_date: string;
  buyer_installments: BuyerInstallment[];
}

interface BuyerInstallment {
  id: number;
  horse_buyer_id: number;
  installment_id: number;
  mes: number;
  año: number;
  amount: number;
  amount_paid: number;
  status: 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'VENCIDO';
}

export const dynamic = 'force-dynamic'
export const dynamicParams = true

const AdminPage = () => {
  const router = useRouter();

  // Estados
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState({
    transactions: true,
    horses: true,
    installments: true
  });
  const [transactionType, setTransactionType] = useState<string | null>(null);
  const [showDue, setShowDue] = useState<boolean>(true);
  const [timeFrame, setTimeFrame] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [searchText, setSearchText] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    // Verificar si es admin
    //const checkAdmin = async () => {
    //  try {
    //    const response = await axios.get(`${API_URL}/users/1`);
    //    if (!response.data || !response.data.is_admin) {
    //      router.push('/');
    //      message.error('Acceso no autorizado');
    //    }
    //  } catch (error) {
    //    console.error('Error al verificar admin:', error);
    //    router.push('/');
    //  }
    //};

    //checkAdmin();
    fetchData();
  }, [router]);

  const fetchData = async () => {
    await fetchUsers();
    await fetchHorses();
    await fetchTransactions();
    await fetchInstallments();
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/users/`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(prev => ({ ...prev, transactions: true }));
      const response = await axios.get(`${API_URL}/transactions/`);
      setTransactions(response.data);
      setLoading(prev => ({ ...prev, transactions: false }));
    } catch (error) {
      console.error('Error al cargar transacciones:', error);
      message.error('Error al cargar las transacciones');
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  };

  const fetchHorses = async () => {
    try {
      setLoading(prev => ({ ...prev, horses: true }));
      const response = await axios.get(`${API_URL}/horses/`);

      // Get latest users directly to avoid state timing issues
      const usersResponse = await axios.get(`${API_URL}/users/`);
      const currentUsers = usersResponse.data;

      // Para cada caballo, obtener información detallada con compradores
      const horsesWithDetails = await Promise.all(
        response.data.map(async (horse: Horse) => {
          const detailResponse = await axios.get(`${API_URL}/horses/${horse.id}`);
          const horseDetail = detailResponse.data;
          const updatedBuyers = horseDetail.buyers.map((buyer: HorseBuyer) => {
            const foundUser = currentUsers.find((user: User) => user.id === buyer.buyer_id);
            return foundUser ? { ...buyer, buyer_name: foundUser.name } : buyer;
          });
          return { ...horseDetail, buyers: updatedBuyers };
        })
      );

      setHorses(horsesWithDetails);
      setLoading(prev => ({ ...prev, horses: false }));
    } catch (error) {
      console.error('Error al cargar caballos:', error);
      message.error('Error al cargar las sociedades');
      setLoading(prev => ({ ...prev, horses: false }));
    }
  };


  const fetchInstallments = async () => {
    try {
      setLoading(prev => ({ ...prev, installments: true }));

      // Always fetch all installments (no filtering at API level)
      const params = {
        month: 0,
        year: 0
      };

      const response = await axios.get(`${API_URL}/installments/`, { params });

      // Obtain horse names for each installment
      let installmentsWithDetails = await Promise.all(
        response.data.map(async (installment: Installment) => {
          try {
            const horseResponse = await axios.get(`${API_URL}/horses/${installment.horse_id}`);
            return {
              ...installment,
              horse_name: horseResponse.data.name
            };
          } catch (err) {
            return {
              ...installment,
              horse_name: `Caballo #${installment.horse_id}`
            };
          }
        })
      );

      // Apply filters
      // 1. Filter by date range if timeFrame is set
      if (timeFrame && timeFrame[0] && timeFrame[1]) {
        installmentsWithDetails = installmentsWithDetails.filter(i => {
          const dueDate = dayjs(i.due_date);
          // Include dates that fall on or between the range boundaries
          return (dueDate.isAfter(timeFrame[0], 'day') || dueDate.isSame(timeFrame[0], 'day')) &&
            (dueDate.isBefore(timeFrame[1], 'day') || dueDate.isSame(timeFrame[1], 'day'));
        });
      }
      // If no timeFrame is set but selectedMonth is, use that
      else if (selectedMonth) {
        const month = selectedMonth.month() + 1; // dayjs months are 0-indexed
        const year = selectedMonth.year();
        installmentsWithDetails = installmentsWithDetails.filter(i =>
          i.mes === month && i.año === year
        );
      }

      // 2. Filter by due status
      if (!showDue) {
        installmentsWithDetails = installmentsWithDetails.filter(i =>
          !i.buyer_installments.some((bi: BuyerInstallment) => bi.status === 'VENCIDO')
        );
      }

      setInstallments(installmentsWithDetails);
      setLoading(prev => ({ ...prev, installments: false }));
    } catch (error) {
      console.error('Error al cargar cuotas:', error);
      message.error('Error al cargar los vencimientos');
      setLoading(prev => ({ ...prev, installments: false }));
    }
  };

  const handleDeleteTransaction = (id: number) => {
    confirm({
      title: '¿Estás seguro de eliminar esta transacción?',
      icon: <ExclamationCircleOutlined />,
      content: 'Esta acción no se puede deshacer',
      okText: 'Sí',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await axios.delete(`${API_URL}/transactions/${id}`);
          message.success('Transacción eliminada correctamente');
          fetchTransactions();
        } catch (error) {
          console.error('Error al eliminar:', error);
          message.error('Error al eliminar la transacción');
        }
      },
    });
  };

  // Filtrados
  const filteredTransactions = transactions
    .filter(t => !transactionType || t.type === transactionType)
    .filter(t => !searchText ||
      (t.concept && t.concept.toLowerCase().includes(searchText.toLowerCase())) ||
      t.id.toString().includes(searchText) ||
      t.total_amount.toString().includes(searchText)
    );

  const filteredInstallments = installments
    .filter(i => !searchText ||
      i.horse_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      i.id.toString().includes(searchText) ||
      i.amount.toString().includes(searchText)
    );

  const filteredHorses = horses.filter(h =>
    !searchText ||
    h.name.toLowerCase().includes(searchText.toLowerCase()) ||
    h.id.toString().includes(searchText) ||
    h.total_value.toString().includes(searchText) ||
    h.buyers.some(b => b.buyer_name?.toLowerCase().includes(searchText.toLowerCase()))
  );

  const transactionColumns = [
    {
      title: 'Tipo',
      dataIndex: 'type',
      key: 'type',
      render: (type: TransactionType) => (
        <Tag color={
          type === 'INGRESO' ? 'green' :
            type === 'EGRESO' ? 'red' :
              type === 'PREMIO' ? 'gold' : 'blue'
        }>
          {type}
        </Tag>
      )
    },
    {
      title: 'Mes/Año',
      key: 'period',
      render: (record: Transaction) => `${record.mes.toString().padStart(2, '0')}/${record.año}`,
      sorter: (a: Transaction, b: Transaction) => {
        const periodA = parseInt(`${a.año}${a.mes.toString().padStart(2, '0')}`);
        const periodB = parseInt(`${b.año}${b.mes.toString().padStart(2, '0')}`);
        return periodA - periodB;
      },
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (record: Transaction) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/transactions/edit/${record.id}`)}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTransaction(record.id)}
          />
        </Space>
      ),
    },
  ];

  const userColumns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: User) => (
        <Link href={`/usuario/${record.id}`} className="text-blue-600 hover:underline">
          <UserOutlined className="mr-2" />{text}
        </Link>
      )
    },
    {
      title: 'Saldo',
      dataIndex: 'balance',
      render: (balance: number) => (
        <Tag color={balance >= 0 ? 'green' : 'red'}>
          {balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} $
        </Tag>
      )
    }
  ];

  const horseColumns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Horse) => (
        <Link href={`/caballo/${record.id}`} className="text-blue-600 hover:underline">
          {text}
        </Link>
      ),
    },
    {
      title: 'Valor Total',
      dataIndex: 'total_value',
      key: 'total_value',
      render: (value: number) => `${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} $`,
    },
    {
      title: 'Cuotas',
      dataIndex: 'number_of_installments',
      key: 'installments',
    },
    {
      title: 'Compradores',
      key: 'buyers',
      render: (record: Horse) => (
        <div className="flex flex-col gap-1">
          {record.buyers.map(buyer => (
            <div key={buyer.id} className="flex items-center gap-2">
              <Link
                href={`/usuario/${buyer.buyer_id}`}
                className="text-blue-600 hover:underline flex items-center"
              >
                <UserOutlined className="mr-1" />
                {buyer.buyer_name || `Comprador #${buyer.buyer_id}`}
              </Link>
              <Tag color="geekblue">{buyer.percentage}%</Tag>
              <Tag color={buyer.active ? 'green' : 'red'}>
                {buyer.active ? 'Activo' : 'Inactivo'}
              </Tag>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const installmentColumns = [
    {
      title: 'Caballo',
      dataIndex: 'horse_name',
      key: 'horse',
      render: (text: string, record: Installment) => (
        <Link href={`/admin/horses/${record.horse_id}`} className="text-blue-600 hover:underline">
          <BarsOutlined className="mr-1" />{text}
        </Link>
      ),
    },
    {
      title: 'Cuota N°',
      dataIndex: 'installment_number',
      key: 'installment_number',
    },
    {
      title: 'Vencimiento',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
      sorter: (a: Installment, b: Installment) =>
        dayjs(a.due_date).unix() - dayjs(b.due_date).unix(),
    },
    {
      title: 'Estado',
      key: 'status',
      render: (record: Installment) => (
        <div className="flex flex-col gap-1">
          {record.buyer_installments.map(bi => (
            <Tag
              color={
                bi.status === 'PAGADO' ? 'green' :
                  bi.status === 'VENCIDO' ? 'red' : 'orange'
              }
              key={bi.id}
            >
              {bi.amount_paid.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}$ / {bi.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}$
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  const handleMonthChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      setSelectedMonth(date);
      fetchInstallments();
    }
  };


  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: <span><DollarOutlined /> Transacciones</span>,
      children: (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Select
              placeholder="Filtrar por tipo"
              allowClear
              onChange={setTransactionType}
              className="min-w-[150px]"
            >
              <Option value="INGRESO">Ingresos</Option>
              <Option value="EGRESO">Egresos</Option>
              <Option value="PREMIO">Premios</Option>
              <Option value="PAGO">Pagos</Option>
            </Select>

            <Input
              placeholder="Buscar..."
              prefix={<SearchOutlined />}
              onChange={(e) => setSearchText(e.target.value)}
              className="max-w-[300px]"
            />
          </div>

          <Table
            columns={transactionColumns}
            dataSource={filteredTransactions}
            loading={loading.transactions}
            rowKey="id"
            bordered
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: '2',
      label: 'Sociedades',
      children: (
        <div className="space-y-4">
          <Input
            placeholder="Buscar caballo o comprador..."
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-[300px] mb-4"
          />

          <Table
            columns={horseColumns}
            dataSource={filteredHorses}
            loading={loading.horses}
            rowKey="id"
            bordered
            pagination={{ pageSize: 5 }}
            expandable={{
              expandedRowRender: (record) => (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Detalles del Caballo</h3>
                  <p>Valor Total: {String(record.total_value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} $</p>
                  <p>Cantidad de cuotas: {record.number_of_installments}</p>
                  <p>Información: {record.information || 'N/A'}</p>
                  <p>Mes de inicio de facturación: {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][record.starting_billing_month - 1]}</p>
                  <p>Mes primera cuota:
                    {
                      (() => {
                        const months = [
                          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                        ];
                        const monthIndex = record.starting_billing_month + 1 > 12 ? 0 : record.starting_billing_month;
                        return months[monthIndex];
                      })()
                    }</p>
                  <p>Año de inicio de facturación: {record.starting_billing_year}</p>
                  <p>Fecha de creación: {dayjs(record.creation_date).format('DD/MM/YYYY')}</p>
                  <p>Porcentaje total: {record.total_percentage}%</p>
                </div>
              ),
            }}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: 'Vencimientos',
      children: (
        <div className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <RangePicker
              picker="month"
              format={['MM/YYYY', 'MM/YYYY']}
              value={timeFrame}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setTimeFrame([dates[0], dates[1]]);
                } else {
                  setTimeFrame(null);
                }
                fetchInstallments();
              }}
              locale={locale}
              className="w-[300px]"
            />

            <Checkbox
              checked={showDue}
              onChange={(e) => {
                setShowDue(e.target.checked);
                fetchInstallments();
              }}
            >
              Mostrar vencidos
            </Checkbox>

            <Button
              icon={<CalendarOutlined />}
              onClick={fetchInstallments}
            >
              Actualizar
            </Button>
          </div>

          <Table
            columns={installmentColumns}
            dataSource={filteredInstallments}
            loading={loading.installments}
            rowKey="id"
            bordered
            pagination={{ pageSize: 10 }}
          />
        </div>
      ),
    },
    {
      key: '4',
      label: <span><UserOutlined /> Usuarios</span>,
      children: (
        <Table
          columns={userColumns}
          dataSource={users}
          rowKey="id"
          bordered
          pagination={{ pageSize: 10 }}
        />
      )
    }
  ];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <ControlOutlined /> Panel
      </h1>

      {/* Tabs mejorados */}
      <Tabs
        items={tabItems}
        tabBarExtraContent={
          <Space>
            <Button
              type="primary"
              onClick={() => router.push('/crear/transaccion')}
            >
              + Transacción
            </Button>
            <Button
              type="default"
              onClick={() => router.push('/crear/usuario')}
            >
              + Usuario
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default AdminPage;