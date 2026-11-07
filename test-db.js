const db = require('./config/db');

async function test() {
    try {
        await db.query('SELECT 1');
        console.log('DATABASE CONNECTED SUCCESSFULLY');
    } catch (error) {
        console.log('DATABASE ERROR:', error.message);
    } finally {
        await db.end();
    }
}

test();
