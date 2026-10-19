const bcrypt = require('bcryptjs');
const hashInDb = '$2y$12$xpzumuRR85zJG5dMlofHtOm.ThSvjM/w9y8lL3AnYQHUjZ/XyqBdi';
const fixedHash = hashInDb.replace(/^\$2y\$/, '$2a$');

console.log('Testing password vs DB hash:', bcrypt.compareSync('password', fixedHash));
