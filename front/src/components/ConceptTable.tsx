import React from 'react';
import { Table, Button } from 'antd';

interface Concept {
    id: number;
    name: string;
    description: string;
}

interface ConceptTableProps {
    concepts: Concept[];
    onEdit: (concept: Concept) => void;
    onDelete: (id: number) => void;
}

const ConceptTable: React.FC<ConceptTableProps> = ({ concepts, onEdit, onDelete }) => {
    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (text: string, record: Concept) => (
                <span>
                    <Button onClick={() => onEdit(record)}>Edit</Button>
                    <Button onClick={() => onDelete(record.id)} style={{ marginLeft: 8 }}>
                        Delete
                    </Button>
                </span>
            ),
        },
    ];

    return (
        <Table
            dataSource={concepts}
            columns={columns}
            rowKey="id"
        />
    );
};

export default ConceptTable;