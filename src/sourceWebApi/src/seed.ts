import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import sql from 'mssql';
import { parse } from 'csv-parse/sync';

dotenv.config();

interface ConsumerReview {
  Id: number;
  ClientId: number;
  DateTime: string;
  Rating: number;
  Comment: string;
}

interface ConsumerReviewInsert {
  ClientId: number;
  DateTime: string;
  Rating: number;
  Comment: string;
}

async function seed(): Promise<void> {
  const dataDir = path.join(__dirname, '..', 'data');
  
  const csvFiles = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith('.csv'));

  if (csvFiles.length === 0) {
    console.log('No CSV files found in data directory');
    return;
  }

  console.log(`Found ${csvFiles.length} CSV file(s): ${csvFiles.join(', ')}`);

  const config: sql.config = {
    server: process.env.DB_SERVER || 'localhost',
    port: 1433,
    database: process.env.DB_NAME || 'admin-agent',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  };

  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('Connected to database');

    let totalInserted = 0;

    for (const csvFile of csvFiles) {
      const filePath = path.join(dataDir, csvFile);
      console.log(`Processing ${csvFile}...`);

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
      }) as ConsumerReview[];

      console.log(`  Found ${records.length} records in ${csvFile}`);

      for (const record of records) {
        const insertRecord: ConsumerReviewInsert = {
          ClientId: record.ClientId,
          DateTime: record.DateTime,
          Rating: record.Rating,
          Comment: record.Comment,
        };

        const result = await pool.request()
          .input('ClientId', sql.Int, insertRecord.ClientId)
          .input('DateTime', sql.DateTime2, insertRecord.DateTime)
          .input('Rating', sql.Int, insertRecord.Rating)
          .input('Comment', sql.NVarChar, insertRecord.Comment)
          .input('Status', sql.Int, 0)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM ConsumerReviews WHERE ClientId = @ClientId AND DateTime = @DateTime)
            BEGIN
              INSERT INTO ConsumerReviews (ClientId, DateTime, Rating, Comment, Status)
              VALUES (@ClientId, @DateTime, @Rating, @Comment, @Status)
            END
          `);

        if (result.rowsAffected[0] > 0) {
          totalInserted++;
        }
      }
    }

    console.log(`Seeding completed. Total records inserted: ${totalInserted}`);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.close();
    console.log('Database connection closed');
  }
}

seed();
