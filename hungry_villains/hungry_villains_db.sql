-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 28, 2026 at 12:00 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `hungry_villains_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `address`
--

CREATE TABLE `address` (
  `addressID` int(11) NOT NULL,
  `userID` int(11) NOT NULL,
  `street` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `province` varchar(100) NOT NULL,
  `zip_code` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `address`
--


-- --------------------------------------------------------

--
-- Table structure for table `delivery`
--

CREATE TABLE `delivery` (
  `deliveryID` int(11) NOT NULL,
  `orderID` int(11) NOT NULL,
  `rider_name` varchar(100) DEFAULT 'Finding Rider...',
  `status` varchar(50) DEFAULT 'Preparing',
  `estimated_time` varchar(50) DEFAULT '30-45 mins'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` int(11) NOT NULL,
  `product_code` varchar(30) NOT NULL,
  `product_name` varchar(100) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `description` text DEFAULT NULL,
  `icon` varchar(512) NOT NULL DEFAULT '🍔',
  `image_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`product_id`, `product_code`, `product_name`, `category`, `price`, `quantity`, `status`, `description`, `icon`, `image_path`) VALUES
(1, 'HV001', 'Classic Burger', 'Food', 149.99, 47, 'Active', 'Juicy beef patty with cheese and lettuce', 'https://th.bing.com/th/id/OIP.xAxz2Ecb2EO2138VPcqiKQHaE8?w=274&h=183&c=7&r=0&o=7&pid=1.7&rm=3', 'pictures/burgir.webp'),
(2, 'HV002', 'Pepperoni Pizza', 'Food', 249.99, 49, 'Active', 'Crispy crust with mozzarella and pepperoni', 'https://tse3.mm.bing.net/th/id/OIP.gb7-L7u8yjuE4VB0x2YQVAHaLH?rs=1&pid=ImgDetMain&o=7&rm=3', 'pictures/piza.webp'),
(3, 'HV003', 'Chicken Salad', 'Food', 199.99, 49, 'Active', 'Fresh greens with grilled chicken breast', 'https://th.bing.com/th/id/OIP.ur0TGMSAP5mxBv9CgZPyrgHaKz?w=203&h=295&c=7&r=0&o=7&pid=1.7&rm=3', 'pictures/salad.webp'),
(4, 'HV004', 'Sushi Platter', 'Food', 249.99, 50, 'Active', 'Assorted fresh sushi rolls', 'https://th.bing.com/th/id/OIP.lfBykfb88wKQB_1YMg6oiAHaHC?w=190&h=180&c=7&r=0&o=7&pid=1.7&rm=3', 'pictures/sushi.webp'),
(5, 'HV005', 'French Fries', 'Food', 99.99, 48, 'Active', 'Golden crispy salted fries', 'https://th.bing.com/th/id/OIP.MnedFEYpcSLX18MwBVRsaQHaJQ?w=130&h=150&c=6&o=7&pid=1.7&rm=3', 'pictures/frinch fris.webp'),
(6, 'HV006', 'Iced Coffee', 'Beverage', 149.99, 49, 'Active', 'Cold brew coffee with milk', 'https://th.bing.com/th/id/OIP.91z5YZd9d-a3atvPpGGR8wHaE3?w=297&h=195&c=7&r=0&o=7&pid=1.7&rm=3', 'pictures/ice kupi.webp'),
(27, 'HV027', 'Fried Chicken', 'Food', 249.99, 49, 'Active', 'Crispy Juicy Tenderness', 'https://www.tasteofhome.com/wp-content/uploads/2018/01/Crispy-Fried-Chicken_EXPS_TOHJJ22_6445_DR-_02_03_11b.jpg', 'pictures/fried siken.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `total_price` decimal(10,2) NOT NULL,
  `address` text NOT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`items`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(50) DEFAULT 'Pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--


-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `price_at_order` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--


-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_admin` tinyint(1) NOT NULL DEFAULT 0,
  `is_cashier` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--


--
-- Indexes for dumped tables
--

--
-- Indexes for table `address`
--
ALTER TABLE `address`
  ADD PRIMARY KEY (`addressID`),
  ADD KEY `userID` (`userID`);

--
-- Indexes for table `delivery`
--
ALTER TABLE `delivery`
  ADD PRIMARY KEY (`deliveryID`),
  ADD KEY `orderID` (`orderID`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`),
  ADD UNIQUE KEY `product_code` (`product_code`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_order_menu` (`order_id`,`menu_item_id`),
  ADD KEY `fk_order_items_menu_item` (`menu_item_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `address`
--
ALTER TABLE `address`
  MODIFY `addressID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `delivery`
--
ALTER TABLE `delivery`
  MODIFY `deliveryID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `address`
--
ALTER TABLE `address`
  ADD CONSTRAINT `address_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `delivery`
--
ALTER TABLE `delivery`
  ADD CONSTRAINT `delivery_ibfk_1` FOREIGN KEY (`orderID`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_menu_item` FOREIGN KEY (`menu_item_id`) REFERENCES `products` (`product_id`),
  ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- Apply once to the existing Hungry Villains database, with that database selected.
CREATE TABLE IF NOT EXISTS pos_settings (
    setting_key VARCHAR(40) PRIMARY KEY,
    setting_value VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_sales (
    sale_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    request_hash CHAR(64) CHARACTER SET ascii NOT NULL,
    order_id INT UNIQUE,
    cashier_name VARCHAR(50) NOT NULL,
    subtotal_cents BIGINT UNSIGNED NOT NULL,
    discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
    discount_reason VARCHAR(120) NOT NULL DEFAULT '',
    captured_offline TINYINT(1) NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_payments (
    order_id INT PRIMARY KEY,
    method ENUM('cash','ewallet','card') NOT NULL,
    tendered_cents BIGINT UNSIGNED NOT NULL,
    change_cents BIGINT UNSIGNED NOT NULL,
    payment_reference VARCHAR(80) NOT NULL DEFAULT '',
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_stock_movements (
    movement_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    order_id INT NULL,
    actor_id INT NOT NULL,
    quantity_delta INT NOT NULL,
    balance_after INT NOT NULL,
    reason VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (product_id, created_at),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_audit_log (
    event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    entity_id INT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pos_login_limits (
    attempt_key CHAR(64) CHARACTER SET ascii PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL,
    window_end BIGINT UNSIGNED NOT NULL,
    INDEX (window_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
