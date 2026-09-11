# NOVA - Team Productivity Platform

**Plan. Collaborate. Deliver.**

NOVA is a full-stack project management platform that helps teams create projects, manage tasks, collaborate with team members, and track project progress.

This project was built as part of a **Full Stack Development**, covering frontend development, backend APIs, authentication, database integration, and deployment.

---

## Live Demo

* **Frontend:** (https://nova-pearl-beta.vercel.app/)
* **Backend:** [https://nova-backend-6p9a.onrender.com](https://nova-backend-6p9a.onrender.com/)
* **GitHub:** https://github.com/SatishBytes/Nova

---

## Features

* User Signup & Login
* JWT-based Authentication
* Protected Dashboard Routes
* Create, View & Delete Projects
* Create Tasks inside Projects
* Update Task Status

  * To Do
  * In Progress
  * Done
* Delete Tasks

* Frontend & Backend Deployment

---

## Tech Stack

### Frontend

* React.js
* Vite
* React Router DOM
* Axios

### Backend

* Node.js
* Express.js

### Database & Authentication

* Supabase
* PostgreSQL
* Supabase Authentication
* JWT

### Deployment

* Vercel - Frontend
* Render - Backend

---

## Application Flow

```text
User
  ↓
React Frontend
  ↓
Supabase Authentication
  ↓
JWT Access Token
  ↓
Axios API Request
  ↓
Express Backend
  ↓
Authentication Middleware
  ↓
Controller
  ↓
Supabase / PostgreSQL
  ↓
API Response
  ↓
React Frontend
```

The frontend sends API requests with the authenticated user's JWT token.

The backend authentication middleware validates the token using Supabase. If the token is valid, the request is passed to the appropriate controller, which performs the required database operation.


## Project Structure

```text
Nova/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── config/
│   ├── server.js
│   ├── package.json
│   └── ...
│
└── README.md
```

---

## Run Locally

### Prerequisites

Make sure you have:

* Node.js installed
* A Supabase project
* Git installed

### 1. Clone the Repository

```bash
git clone https://github.com/SatishBytes/Nova.git
cd Nova
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` folder:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-secret-key
PORT=5000
```

Start the backend:

```bash
npm run dev
```

Backend will run on:

```text
http://localhost:5000
```

---

### 3. Setup Frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` folder:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_KEY=your-supabase-publishable-key
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Frontend will run on:

```text
http://localhost:5173
```

---

## Deployment

### Frontend

The frontend is deployed using **Vercel**.

```text
Root Directory: frontend/
```

### Backend

The backend is deployed using **Render**.

```text
Root Directory: backend/
```

Environment variables are configured in the respective hosting platforms and are not committed to the repository.

---

## Authentication

NOVA uses **Supabase Authentication** for user signup and login.

After successful authentication, Supabase provides a JWT access token.

The token is sent with protected API requests:

```http
Authorization: Bearer <access_token>
```

The Express authentication middleware validates the token before allowing access to protected resources.

---


## Deployment Links

**Live Application:**
https://nova-eta-swart.vercel.app

**Backend API:**
https://nova-backend-6p9a.onrender.com

**Source Code:**
https://github.com/SatishBytes/Nova

---

## Author

**Satish Yadav**

Full Stack Development 

---

