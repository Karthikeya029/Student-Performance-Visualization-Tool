# 🎓 EduTrack – Student Performance Visualization Tool

## 📌 Project Overview

EduTrack is a full-stack web application designed to manage and visualize student performance efficiently.
It provides real-time updates, role-based dashboards, and interactive analytics to improve academic tracking.

---

## 🚀 Key Features

* 🔐 Secure Authentication using JWT
* 👥 Role-Based Dashboards (Student / Teacher / Coordinator)
* 📊 Data Visualization using Chart.js
* ⚡ Real-Time Updates using Socket.IO
* 🗄 Hybrid Database Architecture (MongoDB + MySQL)
* ✅ Input Validation for data integrity

---

## 🏗 System Architecture

The system follows a **three-tier architecture**:

* **Frontend** → Handles UI and user interaction
* **Backend** → Processes logic and APIs
* **Database** → Stores user data and academic records

📌 MongoDB → User authentication
📌 MySQL → Marks & attendance

---

## 🛠 Tech Stack

| Layer    | Technology            |
| -------- | --------------------- |
| Frontend | HTML, CSS, JavaScript |
| Backend  | Node.js, Express      |
| Database | MongoDB, MySQL        |
| Charts   | Chart.js              |
| Realtime | Socket.IO             |

---

## ▶️ How to Run the Project

### 1. Clone the repository

```
git clone https://github.com/Karthikeya029/Student-Performance-Visualization-Tool.git
cd Student-Performance-Visualization-Tool
```
### 2. Install dependencies
```
npm install
```
### 3. Setup environment variables
Create a `.env` file using `.env.example`
### 4. Start the server
```
npm start
```
### 5. Open in browser
```
frontend/login.html
```
## 🗄 Database Setup

- Start MongoDB
- Create MySQL database:
- CREATE DATABASE edutrack_marks;

   ## 📌 Note
Sample data is pre-seeded for demo purposes.
Use provided credentials to login.

---

## 🔑 Demo Login Credentials

### 👨‍🎓 Student

* Username: `cs1001` // If want to login any another student then (username: student id, password: password)
* Password: `password`

### 👩‍🏫 Teacher

* Username: `teacher_maths`, `teacher_physics`, `teacher_english`, `teacher_french`, `teacher_dsa`
* Password: `password`

### 🧑‍💼 Coordinator

* Username: `coord_cs1`, `coord_cs2`, `coord_cs3`, `coord_cs4`
* Password: `password`

> ⚠️ Note: Credentials may vary depending on seeded data.

---

## 📂 Project Structure

```
backend/
frontend/
database/
docs/
```

---

## 📄 Documentation

Available in `docs/` folder:

* Problem Statement
* SRS (Software Requirement Specification)
* SDS (Software Design Specification)
* Test Plan

---

## 👥 Team Members

* M. Leela Karthikeya – Project Manager & System Designer
* E. Priyamvada – Requirement Analyst
* Navvyah – Frontend Developer
* M. Satwik Reddy – Backend Developer
* A. Neal Teja – Database Administrator
* K. Satya Vardhan – Data Visualization & Analytics
* A. Sathvik Reddy – Testing & Quality Assurance

---

## 💡 Highlights

* Real-time performance tracking
* Clean modular architecture
* Secure and scalable system
* Role-based access control

---

## 📌 Conclusion

EduTrack simplifies academic monitoring by combining visualization, real-time updates, and role-based access into a single platform.

