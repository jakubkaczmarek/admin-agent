import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;
let isConnecting = false;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool && !isConnecting) {
    const connectionString = process.env.DB_CONNECTION_STRING;

    if (!connectionString) {
      throw new Error('DB_CONNECTION_STRING environment variable is not set');
    }

    isConnecting = true;
    pool = new sql.ConnectionPool(connectionString);

    try {
      await pool.connect();
    } catch (err) {
      console.error('Database connection failed:', err);
      pool = null;
      isConnecting = false;
      throw err;
    }
  }

  if (!pool) {
    throw new Error('Database pool is not available');
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
