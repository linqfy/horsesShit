# Horse Management System API Documentation

## Overview

This API manages a horse ownership system where multiple users can buy shares of horses and manage payments through installments. It handles user management, horse registration, buyer management, transactions, and payment processing.

## Base URL

```
http://your-domain.com/api/v1
```

## Authentication

[Note: Authentication implementation pending. All endpoints will require proper authentication in production.]

## Endpoints

### Users

#### Create User

```http
POST /users/
```

Creates a new user in the system.

**Request Body:**

```json
{
    "name": "John Doe",
    "email": "john@example.com"
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "is_admin": false,
    "balance": 0.0
}
```

#### Get User

```http
GET /users/{user_id}
```

Retrieves user information by ID.

**Response:** `200 OK`

```json
{
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "is_admin": false,
    "balance": 1000.0
}
```

#### Get User Balance

```http
GET /users/{user_id}/balance
```

Retrieves detailed balance information for a user.

**Response:** `200 OK`

```json
{
    "current_balance": 1000.0,
    "pending_installments": 5000.0,
    "total_paid": 3000.0
}
```

### Horses

#### Create Horse

```http
POST /horses/
```

Creates a new horse with its buyers.

**Request Body:**

```json
{
    "name": "Thunder",
    "information": "5 year old stallion",
    "image_url": "https://example.com/thunder.jpg",
    "total_value": 50000.0,
    "number_of_installments": 12,
    "installment_amount": 4166.67,
    "buyers_data": [
        {
            "buyer_id": 1,
            "percentage": 60.0
        },
        {
            "buyer_id": 2,
            "percentage": 40.0
        }
    ]
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "name": "Thunder",
    "information": "5 year old stallion",
    "image_url": "https://example.com/thunder.jpg",
    "total_value": 50000.0,
    "number_of_installments": 12,
    "installment_amount": 4166.67,
    "creation_date": "2024-11-02T10:00:00Z"
}
```

#### Get Horse

```http
GET /horses/{horse_id}
```

Retrieves horse information by ID.

#### Get Horse Buyers

```http
GET /horses/{horse_id}/buyers
```

Retrieves all buyers for a specific horse.

### Transactions

#### Create Transaction

```http
POST /transactions/
```

Creates a new transaction (income, expense, or prize).

**Request Body:**

```json
{
    "type": "ingreso",
    "concept": "Monthly payment",
    "total_amount": 4166.67,
    "notes": "November payment",
    "horse_id": 1
}
```

**Response:** `201 Created`

```json
{
    "id": 1,
    "type": "ingreso",
    "concept": "Monthly payment",
    "total_amount": 4166.67,
    "notes": "November payment",
    "horse_id": 1,
    "date": "2024-11-02T10:00:00Z"
}
```

#### List Transactions

```http
GET /transactions/
```

Retrieves transactions with optional filters.

**Query Parameters:**

- `horse_id` (optional): Filter by horse
- `transaction_type` (optional): Filter by type (ingreso, egreso, premio, pago)
- `skip` (optional): Pagination offset
- `limit` (optional): Pagination limit

### Payments

#### Create Payment

```http
POST /payments/
```

Records a payment for an installment.

**Request Body:**

```json
{
    "buyer_installment_id": 1,
    "amount": 2500.0
}
```

#### List Payments

```http
GET /payments/
```

Retrieves payments with optional filters.

**Query Parameters:**

- `buyer_id` (optional): Filter by buyer
- `horse_id` (optional): Filter by horse
- `skip` (optional): Pagination offset
- `limit` (optional): Pagination limit

## Enums

### TransactionType

- `ingreso`: Income (installment payments)
- `egreso`: Expense (shared costs)
- `premio`: Prize (to be distributed)
- `pago`: Payment (to admin)

### PaymentStatus

- `pendiente`: Pending payment
- `parcial`: Partially paid
- `pagado`: Fully paid
- `vencido`: Overdue

## Error Responses

### 400 Bad Request

Returned when the request is invalid.

```json
{
    "detail": "Error message explaining the issue"
}
```

### 404 Not Found

Returned when the requested resource doesn't exist.

```json
{
    "detail": "Resource not found"
}
```

### 500 Internal Server Error

Returned when an unexpected error occurs.

```json
{
    "detail": "Internal server error"
}
```

## Notes

1. All monetary values are in the system's default currency unit
2. Dates are returned in ISO 8601 format
3. Pagination is available on list endpoints using `skip` and `limit` parameters
4. Total percentages for horse buyers must equal exactly 100%
5. Transaction processing is atomic and will rollback on failure
6. Installment amounts are calculated automatically based on total value and number of installments

## Best Practices

1. Always validate response status codes
2. Implement proper error handling
3. Use pagination for large data sets
4. Keep track of transaction IDs for troubleshooting
5. Regularly check user balances
6. Monitor payment status for overdue installments

## Rate Limiting

[Note: Rate limiting implementation pending. Production API will include rate limits.]
