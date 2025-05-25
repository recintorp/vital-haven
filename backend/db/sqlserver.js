require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true',
        trustServerCertificate: true,
    },
};

let pool; // Stores the connected pool

async function connectToDb() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
        }
        return pool; // Always return the pool (not the module)
    } catch (err) {
        console.error('Database Connection Failed!', err);
        throw err;
    }
}

module.exports = connectToDb;