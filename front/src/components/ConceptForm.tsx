import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';

interface Concept {
    id?: number;
    name: string;
    description: string;
}

interface ConceptFormProps {
    initialValues?: Concept;
    onSubmit: (values: Concept) => void;
}

const ConceptForm: React.FC<ConceptFormProps> = ({ initialValues, onSubmit }) => {
    const [form] = Form.useForm();

    const handleFinish = (values: Concept) => {
        onSubmit(values);
        form.resetFields();
        message.success('Concept saved successfully!');
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            initialValues={initialValues}
        >
            <Form.Item
                name="name"
                label="Concept Name"
                rules={[{ required: true, message: 'Please enter the concept name' }]}
            >
                <Input placeholder="Enter concept name" />
            </Form.Item>
            <Form.Item
                name="description"
                label="Description"
                rules={[{ required: true, message: 'Please enter the description' }]}
            >
                <Input.TextArea placeholder="Enter description" rows={4} />
            </Form.Item>
            <Form.Item>
                <Button type="primary" htmlType="submit">
                    Save Concept
                </Button>
            </Form.Item>
        </Form>
    );
};

export default ConceptForm;