-- schema.sql
-- Run this file in MySQL to create the database and all tables.
-- Example:  mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS community_hall_db;
USE community_hall_db;

-- ========================
-- USERS TABLE
-- ========================
-- Stores both normal users and admins.
-- "role" tells us whether this account is a regular user or an admin.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,       -- stored as a bcrypt hash, never plain text
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- HALLS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS halls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,          -- price per booking/day
  capacity INT NOT NULL,
  location VARCHAR(200) NOT NULL,
  image VARCHAR(255) DEFAULT 'images/default-hall.jpg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- BOOKINGS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  hall_id INT NOT NULL,
  date DATE NOT NULL,
  time_slot VARCHAR(50) NOT NULL,        -- e.g. "10:00 AM - 1:00 PM"
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
  -- NOTE: We do NOT put a hard UNIQUE constraint on (hall_id, date, time_slot)
  -- here, because a REJECTED booking should free up that slot again.
  -- Instead, double-booking is prevented in the application code (see
  -- controllers/bookingController.js) by checking for existing
  -- 'pending' or 'approved' bookings before creating a new one.
);
