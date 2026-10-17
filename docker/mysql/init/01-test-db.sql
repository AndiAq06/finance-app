-- Database terpisah untuk automated test (PHPUnit). Jangan gunakan untuk data nyata.
CREATE DATABASE IF NOT EXISTS finora_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON finora_test.* TO 'finora'@'%';
FLUSH PRIVILEGES;
