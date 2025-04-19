"use client";
import { Button, Card, Input, List, message, Modal, Spin, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const { Title, Text } = Typography;

// Acciones del servidor en un archivo separado
import { loadConcepts, removeConceptItem, saveNewConcept, updateConceptsList } from './actions';

const ConceptosPage: React.FC = () => {
    const [concepts, setConcepts] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [newConcept, setNewConcept] = useState<string>('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

    const router = useRouter();

    useEffect(() => {
        fetchConcepts();
    }, []);

    const fetchConcepts = async () => {
        try {
            setLoading(true);
            const data = await loadConcepts();
            setConcepts(data);
        } catch (err) {
            setError('Error al cargar conceptos');
            message.error('Error al cargar conceptos');
        } finally {
            setLoading(false);
        }
    };

    const handleAddConcept = async () => {
        if (!newConcept.trim()) {
            message.warning('Por favor ingrese un concepto');
            return;
        }

        try {
            const result = await saveNewConcept(newConcept);

            if (result.success) {
                setConcepts(prev => [...prev, newConcept]);
                setNewConcept('');
                message.success('Concepto añadido con éxito');
            } else {
                message.info('Este concepto ya existe');
            }
        } catch (err) {
            setError('Error al añadir concepto');
            message.error('Error al añadir concepto');
        }
        await fetchConcepts();
        setError(null)
    };

    const handleEditInit = (index: number) => {
        setEditingIndex(index);
        setEditValue(concepts[index]);
    };

    const handleEditSave = async () => {
        if (editingIndex === null) return;
        if (!editValue.trim()) {
            message.warning('El concepto no puede estar vacío');
            return;
        }

        try {
            // Crear un nuevo array con el valor actualizado
            const updatedConcepts = [...concepts];
            updatedConcepts[editingIndex] = editValue;

            const result = await updateConceptsList(updatedConcepts);

            if (result.success) {
                setConcepts(updatedConcepts);
                message.success('Concepto actualizado con éxito');
            } else {
                console.error('Error updating concept:', result);
                message.error('Error al actualizar concepto');
            }

            setEditingIndex(null);
        } catch (err) {
            setError('Error al actualizar concepto');
            message.error('Error al actualizar concepto');
        }
        await fetchConcepts();
        setError(null)
    };

    const handleEditCancel = () => {
        setEditingIndex(null);
    };

    const showDeleteConfirm = (index: number) => {
        setDeleteIndex(index);
    };

    const handleDelete = async () => {
        if (deleteIndex === null) return;

        const conceptToDelete = concepts[deleteIndex];
        const indexToDelete = deleteIndex;

        // Close modal immediately
        setDeleteIndex(null);

        try {
            const result = await removeConceptItem(conceptToDelete);

            if (result.success) {
                setConcepts(prev => prev.filter((_, i) => i !== indexToDelete));
                message.success('Concepto eliminado con éxito');
            } else {
                message.error('Error al eliminar concepto');
            }
        } catch (err) {
            setError('Error al eliminar concepto');
            message.error('Error al eliminar concepto');
        }

        await fetchConcepts();
        setError(null);
    };

    return (
        <div className="p-6">
            <Title level={2}>Administrar Conceptos</Title>

            <Card title="Añadir Nuevo Concepto" className="mb-6">
                <div className="flex items-center">
                    <Input
                        value={newConcept}
                        onChange={e => setNewConcept(e.target.value)}
                        placeholder="Ingrese nuevo concepto"
                        onPressEnter={handleAddConcept}
                        className="mr-2"
                    />
                    <Button type="primary" onClick={handleAddConcept}>
                        Añadir
                    </Button>
                </div>
            </Card>

            <Card title="Conceptos Existentes">
                {loading ? (
                    <div className="text-center py-4">
                        <Spin size="large" />
                    </div>
                ) : error ? (
                    <Text type="danger">{error}</Text>
                ) : (
                    <List
                        dataSource={concepts}
                        renderItem={(concept, index) => (
                            <List.Item
                                actions={[
                                    <Button key="edit" type="link" onClick={() => handleEditInit(index)}>
                                        Editar
                                    </Button>,
                                    <Button key="delete" type="link" danger onClick={() => showDeleteConfirm(index)}>
                                        Eliminar
                                    </Button>
                                ]}
                            >
                                {editingIndex === index ? (
                                    <div className="flex items-center w-full">
                                        <Input
                                            value={editValue}
                                            onChange={e => setEditValue(e.target.value)}
                                            onPressEnter={handleEditSave}
                                            className="mr-2"
                                        />
                                        <Button type="primary" onClick={handleEditSave} size="small" className="mr-1">
                                            Guardar
                                        </Button>
                                        <Button onClick={handleEditCancel} size="small">
                                            Cancelar
                                        </Button>
                                    </div>
                                ) : (
                                    <div>{concept}</div>
                                )}
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            <Modal
                title="Confirmar Eliminación"
                open={deleteIndex !== null}
                onOk={handleDelete}
                onCancel={() => setDeleteIndex(null)}
                okButtonProps={{ danger: true }}
                okText="Eliminar"
            >
                ¿Está seguro de que desea eliminar este concepto?
                {deleteIndex !== null && (
                    <div className="mt-2 p-2 bg-gray-100 rounded">{concepts[deleteIndex]}</div>
                )}
            </Modal>
        </div>
    );
};
// Add this to the bottom of your page.tsx file
export const dynamic = 'force-dynamic';

export default ConceptosPage;