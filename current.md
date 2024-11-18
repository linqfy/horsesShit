# Horse Management API Documentation

## Table of Contents

* [1. Users](#1-users)
  * [1.1. List All Users](#11-list-all-users)
  * [1.2. Get User by ID](#12-get-user-by-id)
  * [1.3. Create User](#13-create-user)
  * [1.4. Update User](#14-update-user)
  * [1.5. Delete User](#15-delete-user)
* [2. Horses](#2-horses)
  * [2.1. List All Horses](#21-list-all-horses)
  * [2.2. Get Horse by ID](#22-get-horse-by-id)
  * [2.3. Create Horse with Buyers](#23-create-horse-with-buyers)
  * [2.4. Update Horse](#24-update-horse)
  * [2.5. Delete Horse](#25-delete-horse)
* [3. Horse Buyers](#3-horse-buyers)
  * [3.1. Get Horse Buyers](#31-get-horse-buyers)
  * [3.2. Update Horse Buyer](#32-update-horse-buyer)
  * [3.3. Delete Horse Buyer](#33-delete-horse-buyer)
* [4. Transactions](#4-transactions)
  * [4.1. Create Transaction](#41-create-transaction)
  * [4.2. Update Transaction](#42-update-transaction)
  * [4.3. Delete Transaction](#43-delete-transaction)
* [5. Payments](#5-payments)
  * [5.1. Create Payment](#51-create-payment)
  * [5.2. Update Payment](#52-update-payment)
  * [5.3. Delete Payment](#53-delete-payment)

## 1. Users

### 1.1. List All Users

Retrieves all registered users.

```bash
curl -X GET "http://localhost:8000/users/" \
     -H "accept: application/json"
```

### 1.2. Get User by ID

Retrieves a specific user by their ID.

**Parameters:**
* `user_id` (integer, path)

```bash
curl -X GET "http://localhost:8000/users/1" \
     -H "accept: application/json"
```

### 1.3. Create User

Creates a new user in the system.

**Request Body:**

```json
{
  "name": "Juan Pérez",
  "email": "juan.perez@example.com",
  "dni": "12345678A",
  "is_admin": true
}
```

```bash
curl -X POST "http://localhost:8000/users/" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Juan Pérez",
           "email": "juan.perez@example.com",
           "dni": "12345678A",
           "is_admin": true
         }'
```

### 1.4. Update User

Updates an existing user's information.

**Parameters:**
* `user_id` (integer, path)

**Request Body:** (only fields to update)

```json
{
  "name": "Juan P. Pérez",
  "balance": 1500.50
}
```

```bash
curl -X PUT "http://localhost:8000/users/1" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Juan P. Pérez",
           "balance": 1500.50
         }'
```

### 1.5. Delete User

Removes a user from the system.

**Parameters:**
* `user_id` (integer, path)

```bash
curl -X DELETE "http://localhost:8000/users/1" \
     -H "accept: application/json"
```

## 2. Horses

### 2.1. List All Horses

Retrieves all registered horses.

```bash
curl -X GET "http://localhost:8000/horses/" \
     -H "accept: application/json"
```

### 2.2. Get Horse by ID

Retrieves a specific horse by its ID.

**Parameters:**
* `horse_id` (integer, path)

```bash
curl -X GET "http://localhost:8000/horses/1" \
     -H "accept: application/json"
```

### 2.3. Create Horse with Buyers

Creates a new horse entry with associated buyers.

**Request Body:**

```json
{
  "name": "Spirit",
  "information": "Fast and enduring horse",
  "image_url": "http://example.com/spirit.jpg",
  "total_value": 10000.0,
  "number_of_installments": 10,
  "buyers_data": [
    {
      "buyer_id": 1,
      "percentage": 50.0
    },
    {
      "buyer_id": 2,
      "percentage": 50.0
    }
  ]
}
```

```bash
curl -X POST "http://localhost:8000/horses/" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Spirit",
           "information": "Fast and enduring horse",
           "image_url": "http://example.com/spirit.jpg",
           "total_value": 10000.0,
           "number_of_installments": 10,
           "buyers_data": [
             {
               "buyer_id": 1,
               "percentage": 50.0
             },
             {
               "buyer_id": 2,
               "percentage": 50.0
             }
           ]
         }'
```

### 2.4. Update Horse

Updates horse information and optionally its buyers.

**Parameters:**
* `horse_id` (integer, path)

**Request Body:** (only fields to update)

```json
{
  "information": "Updated horse information",
  "buyers_data": [
    {
      "buyer_id": 1,
      "percentage": 60.0
    },
    {
      "buyer_id": 3,
      "percentage": 40.0
    }
  ]
}
```

```bash
curl -X PUT "http://localhost:8000/horses/1" \
     -H "Content-Type: application/json" \
     -d '{
           "information": "Updated horse information",
           "buyers_data": [
             {
               "buyer_id": 1,
               "percentage": 60.0
             },
             {
               "buyer_id": 3,
               "percentage": 40.0
             }
           ]
         }'
```

### 2.5. Delete Horse

Removes a horse and all related records from the system.

**Parameters:**
* `horse_id` (integer, path)

```bash
curl -X DELETE "http://localhost:8000/horses/1" \
     -H "accept: application/json"
```

## 3. Horse Buyers

### 3.1. Get Horse Buyers

Retrieves all buyers associated with a specific horse.

**Parameters:**
* `horse_id` (integer, path)

```bash
curl -X GET "http://localhost:8000/horse-buyers/1" \
     -H "accept: application/json"
```

### 3.2. Update Horse Buyer

Updates a horse buyer's information.

**Parameters:**
* `buyer_id` (integer, path)

**Request Body:** (only fields to update)

```json
{
  "percentage": 55.0,
  "active": false
}
```

```bash
curl -X PUT "http://localhost:8000/horse-buyers/1" \
     -H "Content-Type: application/json" \
     -d '{
           "percentage": 55.0,
           "active": false
         }'
```

### 3.3. Delete Horse Buyer

Removes a horse buyer and redistributes their percentage among other buyers.

**Parameters:**
* `buyer_id` (integer, path)

```bash
curl -X DELETE "http://localhost:8000/horse-buyers/1" \
     -H "accept: application/json"
```

## 4. Transactions

### 4.1. Create Transaction

Creates a new transaction.

**Request Body:**

```json
{
  "type": "INGRESO",
  "concept": "Payment for installment 1",
  "total_amount": 500.0,
  "notes": "Payment made on 10/10/2023",
  "horse_id": 1
}
```

```bash
curl -X POST "http://localhost:8000/transactions/" \
     -H "Content-Type: application/json" \
     -d '{
           "type": "INGRESO",
           "concept": "Payment for installment 1",
           "total_amount": 500.0,
           "notes": "Payment made on 10/10/2023",
           "horse_id": 1
         }'
```

> **Note:** Valid transaction types are: `INGRESO`, `EGRESO`, `PREMIO`, `PAGO`

### 4.2. Update Transaction

Updates an existing transaction.

**Parameters:**
* `transaction_id` (integer, path)

**Request Body:** (only fields to update)

```json
{
  "concept": "Updated transaction concept",
  "total_amount": 600.0
}
```

```bash
curl -X PUT "http://localhost:8000/transactions/1" \
     -H "Content-Type: application/json" \
     -d '{
           "concept": "Updated transaction concept",
           "total_amount": 600.0
         }'
```

### 4.3. Delete Transaction

Removes a transaction from the system.

**Parameters:**
* `transaction_id` (integer, path)

```bash
curl -X DELETE "http://localhost:8000/transactions/1" \
     -H "accept: application/json"
```

## 5. Payments

### 5.1. Create Payment

Creates a new payment for a specific installment.

**Request Body:**

```json
{
  "buyer_installment_id": 1,
  "amount": 100.0
}
```

```bash
curl -X POST "http://localhost:8000/payments/" \
     -H "Content-Type: application/json" \
     -d '{
           "buyer_installment_id": 1,
           "amount": 100.0
         }'
```

### 5.2. Update Payment

Updates an existing payment.

**Parameters:**
* `payment_id` (integer, path)

**Request Body:** (only fields to update)

```json
{
  "amount": 150.0
}
```

```bash
curl -X PUT "http://localhost:8000/payments/1" \
     -H "Content-Type: application/json" \
     -d '{
           "amount": 150.0
         }'
```

### 5.3. Delete Payment

Removes a payment from the system.

**Parameters:**
* `payment_id` (integer, path)

```bash
curl -X DELETE "http://localhost:8000/payments/1" \
     -H "accept: application/json"
```

## Additional Information

### Base URL

Replace `http://localhost:8000` with your actual API base URL.

### Headers

- Use `Content-Type: application/json` for POST/PUT requests
* Use `accept: application/json` to receive JSON responses

### Error Handling

- The API returns appropriate HTTP status codes
* Error responses include a JSON body with error details

### Data Validation

- Total buyer percentages must equal 100%
* Payment amounts must be positive and not exceed pending amounts
