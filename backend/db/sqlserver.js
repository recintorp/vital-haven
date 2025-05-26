require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    options: {
        encrypt: process.env.SQL_ENCRYPT === 'true', // Azure requires encryption
        trustServerCertificate: false, // Should be false for Azure SQL
    },
    port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 1433, // Default Azure port
    // Optionally, you can add connectionTimeout, requestTimeout, etc.
};

let pool = null;

async function connectToDb() {
    try {
        if (!pool) {
            pool = await sql.connect(config);
            console.log('Connected to Azure SQL Database');
        }
        return pool;
    } catch (err) {
        console.error('Database Connection Failed!', err);
        pool = null; // Reset pool so it can try again later
        throw err;
    }
}

module.exports = connectToDb;