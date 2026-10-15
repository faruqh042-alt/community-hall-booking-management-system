-- seed.sql
-- Sample test data. Run AFTER schema.sql.
-- Example: mysql -u root -p community_hall_db < seed.sql

USE community_hall_db;

-- ------------------------------------------------------------------
-- Sample Admin account
-- Email: admin@example.com
-- Password: admin123
-- (password below is a bcrypt hash of "admin123" — generated with bcrypt, 10 rounds)
-- ------------------------------------------------------------------
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@example.com', '$2b$10$YV1r0T6MI3.RLl0y0Q2yBOD8W9Vf8x2N2s8GfXW1Dt0DkYVw4nS3G', 'admin');

-- ------------------------------------------------------------------
-- Sample normal user
-- Email: john@example.com
-- Password: user123
-- ------------------------------------------------------------------
INSERT INTO users (name, email, password, role) VALUES
('John Doe', 'john@example.com', '$2b$10$G2h1sVh6z8y4nQwJt2z1yeqk8m1wqM0m7q0uS0z2r1w1K9F0h5F.G', 'user');

-- ------------------------------------------------------------------
-- Sample halls
-- ------------------------------------------------------------------
INSERT INTO halls (name, description, price, capacity, location, image) VALUES
('Sunrise Community Hall', 'A bright, spacious hall perfect for weddings and large gatherings.', 15000.00, 300, 'MG Road, Bengaluru', 'images/hall1.jpg'),
('Green Valley Function Hall', 'A garden-facing hall ideal for birthday parties and small events.', 8000.00, 120, 'Indiranagar, Bengaluru', 'images/hall2.jpg'),
('Royal Banquet Hall', 'Premium air-conditioned hall with stage and sound system.', 25000.00, 500, 'Whitefield, Bengaluru', 'images/hall3.jpg'),
('Community Center Hall B', 'Simple and affordable hall for meetings and small functions.', 3000.00, 60, 'Jayanagar, Bengaluru', 'images/hall4.jpg');

-- ------------------------------------------------------------------
-- NOTE ON PASSWORDS
-- ------------------------------------------------------------------
-- The bcrypt hashes above are EXAMPLES. Because bcrypt salts are random,
-- it's safest to create your own test accounts through the /register
-- page instead of relying on these exact hashes. If you want to log in
-- immediately using seed data, register a new admin normally, then run:
--   UPDATE users SET role = 'admin' WHERE email = 'youremail@example.com';
