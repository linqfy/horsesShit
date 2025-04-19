'use client'
import React, { useState, useEffect, useRef } from 'react';
import {
  EventApi,
  DateSelectArg,
  EventClickArg,
  DatesSetArg,
  EventContentArg,
  formatDate as fcFormatDate,
} from '@fullcalendar/core'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import esLocale from '@fullcalendar/core/locales/es';
import { Modal, Select, Tag, Spin, Divider } from 'antd';
import moment from 'moment';
import 'moment/locale/es';

moment.locale('es');

interface CalendarEvent {
  id: number;
  title: string;
  type: 'CUOTA' | 'PAGO' | 'INGRESO' | 'GASTO' | 'PREMIO';
  start: Date;
  end?: Date;
  allDay?: boolean;
  extendedProps: {
    amount: number;
    status?: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
    horseId?: number;
    userId?: number;
    horse?: string;
    user?: string;
    details?: string;
    isMonthEvent: boolean;
    paymentDate?: Date;
    collectionDate?: Date;
  };
}

// Extracted getStatusColor function for shared use.
const getStatusColor = (status?: string) => {
  switch (status) {
    case 'PAGADO': return 'green';
    case 'VENCIDO': return 'red';
    default: return 'orange';
  }
};

const EventDetailModal: React.FC<{ event: CalendarEvent | null; onClose: () => void }> = ({ event, onClose }) => {
  const formatDate = (date?: Date) => date ? moment(date).format('DD MMM YYYY') : 'N/A';
  
  if (!event) return null;

  return (
    <Modal
      title={<div className="text-xl font-semibold text-gray-800">{event.title}</div>}
      open={!!event}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Tipo de evento</label>
            <div className="mt-1">
              <Tag color={event.type === 'INGRESO' ? 'green' : 'volcano'} className="text-sm">
                {event.type}
              </Tag>
            </div>
          </div>
          
          <div>
            <label className="text-sm text-gray-500">Monto</label>
            <div className="mt-1 font-medium">${event.extendedProps.amount.toFixed(2)}</div>
          </div>

          {event.extendedProps.status && (
            <div>
              <label className="text-sm text-gray-500">Estado</label>
              <div className="mt-1">
                <Tag color={getStatusColor(event.extendedProps.status)} className="text-sm">
                  {event.extendedProps.status}
                </Tag>
              </div>
            </div>
          )}

          {event.extendedProps.horse && (
            <div>
              <label className="text-sm text-gray-500">Caballo</label>
              <div className="mt-1 font-medium">{event.extendedProps.horse}</div>
            </div>
          )}

          {event.extendedProps.user && (
            <div>
              <label className="text-sm text-gray-500">Usuario</label>
              <div className="mt-1 font-medium">{event.extendedProps.user}</div>
            </div>
          )}

          {event.extendedProps.paymentDate && (
            <div>
              <label className="text-sm text-gray-500">Fecha de pago</label>
              <div className="mt-1 font-medium">{formatDate(event.extendedProps.paymentDate)}</div>
            </div>
          )}

          {event.extendedProps.collectionDate && (
            <div>
              <label className="text-sm text-gray-500">Fecha de cobro</label>
              <div className="mt-1 font-medium">{formatDate(event.extendedProps.collectionDate)}</div>
            </div>
          )}
        </div>

        {event.extendedProps.details && (
          <div>
            <Divider className="my-4" />
            <label className="text-sm text-gray-500">Detalles adicionales</label>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{event.extendedProps.details}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

const CalendarComponent: React.FC = () => {
  const calendarRef = useRef<any>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    horseId: undefined as number | undefined,
    userId: undefined as number | undefined,
  });
  const [currentDate, setCurrentDate] = useState(moment());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horses, setHorses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const API_BASE = 'http://localhost:8000';
  const years = Array.from({ length: 20 }, (_, i) => moment().year() - 10 + i);

  useEffect(() => {
    const fetchHorsesAndUsers = async () => {
      try {
        const [horsesRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/horses`),
          fetch(`${API_BASE}/users`)
        ]);
        const [horsesData, usersData] = await Promise.all([
          horsesRes.json(),
          usersRes.json()
        ]);
        setHorses(horsesData);
        setUsers(usersData);
      } catch (err) {
        setError('Error cargando datos de caballos y usuarios');
      }
    };
    fetchHorsesAndUsers();
  }, []);

  useEffect(() => {
    if (horses.length === 0 || users.length === 0) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const month = currentDate.month() + 1;
        const year = currentDate.year();

        const [transactionsRes, installmentsRes] = await Promise.all([
          fetch(`${API_BASE}/transactions?mes=${month}&year=${year}`),
          fetch(`${API_BASE}/installments?month=${month}&year=${year}`)
        ]);

        if (!transactionsRes.ok || !installmentsRes.ok) {
          throw new Error('Error cargando eventos');
        }

        const [transactions, installments] = await Promise.all([
          transactionsRes.json(),
          installmentsRes.json()
        ]);

        //console.log({ transactions, installments });


        const formattedEvents = [
          ...transactions.map((t: any) => formatTransactionEvent(t)),
          ...installments.map((i: any) => formatInstallmentEvent(i))
        ];

        setAllEvents(formattedEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentDate, horses, users]);

    useEffect(() => {
        if (!filters.type && !filters.horseId && !filters.userId) {
            setFilteredEvents(allEvents);
            return;
        }
        const filtered = allEvents.filter(event => {
            const typeMatch = !filters.type || event.type === filters.type;
            const horseMatch = !filters.horseId || event.extendedProps.horseId === filters.horseId;
            const userMatch = !filters.userId || event.extendedProps.userId === filters.userId;
            return typeMatch && horseMatch && userMatch;
        });
        setFilteredEvents(filtered);
    }, [allEvents, filters]);

  const formatTransactionEvent = (transaction: any): CalendarEvent => {
    const isMonthEvent = !transaction.fecha_de_pago;
    const startDate = transaction.fecha_de_pago 
      ? moment(transaction.fecha_de_pago)
      : moment().month(transaction.mes - 1).year(transaction.año);

    return {
      id: transaction.id,
      title: transaction.concept || `Transacción ${transaction.type}`,
      type: transaction.type,
      start: startDate.toDate(),
      end: isMonthEvent ? startDate.endOf('month').toDate() : undefined,
      allDay: isMonthEvent,
      extendedProps: {
        amount: transaction.total_amount,
        status: transaction.pagado ? 'PAGADO' : 'PENDIENTE',
        horseId: transaction.horse_id,
        userId: transaction.user_id,
        horse: horses.find(h => h.id === transaction.horse_id)?.name,
        user: users.find(u => u.id === transaction.user_id)?.name,
        details: transaction.notas,
        isMonthEvent,
        paymentDate: transaction.fecha_de_pago ? new Date(transaction.fecha_de_pago) : undefined,
        collectionDate: transaction.fecha_de_efectividad ? new Date(transaction.fecha_de_efectividad) : undefined
      }
    };
  };

  const formatInstallmentEvent = (installment: any): CalendarEvent => ({
    id: installment.id,
    title: `Cuota #${installment.installment_number}`,
    type: 'CUOTA',
    start: moment(installment.due_date).toDate(),
    allDay: true,
    extendedProps: {
      amount: installment.amount,
      status: installment.status,
      horseId: installment.horse_id,
      horse: horses.find(h => h.id === installment.horse_id)?.name,
      details: `Cuota correspondiente a ${moment(installment.due_date).format('MMMM YYYY')}`,
      isMonthEvent: false
    }
  });

  const handleYearChange = (selectedYear: number) => {
    const newDate = currentDate.clone().year(selectedYear);
    calendarRef.current?.getApi()?.gotoDate(newDate.toDate());
  };

  const handleMonthChange = (selectedMonth: number) => {
    const newDate = currentDate.clone().month(selectedMonth);
    calendarRef.current?.getApi()?.gotoDate(newDate.toDate());
  };

  const eventContent = (arg: EventContentArg) => {
    const event = arg.event as unknown as CalendarEvent;
    const statusColor = getStatusColor(event.extendedProps.status);
    
    return (
      <div className={`p-2 text-sm ${event.extendedProps.isMonthEvent ? 'bg-blue-50' : 'bg-white'} rounded border-l-4 border-${statusColor}-500`}>
        <div className="flex justify-between items-start">
          <span className="font-medium truncate">{event.title}</span>
          <Tag color={statusColor} className="ml-2">
            ${event.extendedProps.amount.toFixed(2)}
          </Tag>
        </div>
        {event.extendedProps.collectionDate && (
          <div className="text-xs text-green-600 mt-1">
            Cobro: {moment(event.extendedProps.collectionDate).format('DD MMM')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            placeholder="Tipo de evento"
            options={[
              { value: 'CUOTA', label: 'Cuotas' },
              { value: 'PAGO', label: 'Pagos' },
              { value: 'INGRESO', label: 'Ingresos' },
              { value: 'GASTO', label: 'Gastos' },
              { value: 'PREMIO', label: 'Premios' }
            ]}
            onChange={value => setFilters(prev => ({ ...prev, type: value }))}
            allowClear
          />
          <Select
            placeholder="Caballo"
            options={horses.map(h => ({ value: h.id, label: h.nombre }))}
            onChange={value => setFilters(prev => ({ ...prev, horseId: value }))}
            allowClear
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Usuario"
            options={users.map(u => ({ value: u.id, label: u.nombre }))}
            onChange={value => setFilters(prev => ({ ...prev, userId: value }))}
            allowClear
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Año"
            value={currentDate.year()}
            options={years.map(year => ({ value: year, label: year }))}
            onChange={handleYearChange}
            className="min-w-[120px]"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            placeholder="Mes"
            value={currentDate.month()}
            options={moment.months().map((month, index) => ({
              value: index,
              label: month.charAt(0).toUpperCase() + month.slice(1)
            }))}
            onChange={handleMonthChange}
          />
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm">Pagado</span>
            <div className="w-2 h-2 rounded-full bg-orange-500 ml-4" />
            <span className="text-sm">Pendiente</span>
            <div className="w-2 h-2 rounded-full bg-red-500 ml-4" />
            <span className="text-sm">Vencido</span>
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 text-red-600 rounded">{error}</div>}

      <Spin spinning={loading} tip="Cargando eventos...">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          events={filteredEvents}
          eventContent={eventContent}
          datesSet={({ start }: DatesSetArg) => setCurrentDate(moment(start))}
          eventClick={(info: EventClickArg) => {
            setSelectedEvent(info.event as unknown as CalendarEvent);
          }}
          headerToolbar={{
            start: 'title',
            center: '',
            end: 'prev,next today'
          }}
          buttonText={{
            today: 'Hoy'
          }}
          height={800}
          dayMaxEventRows={3}
        />
      </Spin>

      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};

export default CalendarComponent;