import sql from 'mssql';
import { getPool } from '../utils/db';
import {
  ISupportThread,
  ISupportThreadMessage,
  ISupportThreadWithMessages,
  ISupportThreadFilter,
  IPagedSupportThreads,
  SupportThreadStatus,
} from '../models/support-thread.model';

export class SupportThreadRepository {
  async create(
    creatorUserName: string,
    subject: string,
    category: string | null | undefined,
    message: string
  ): Promise<ISupportThread> {
    const pool = await getPool();
    const request = pool.request();

    request.input('creatorUserName', sql.NVarChar(256), creatorUserName);
    request.input('subject', sql.NVarChar(256), subject);
    request.input('category', sql.NVarChar(256), category || null);
    request.input('message', sql.NVarChar(4000), message);

    const outputRequest = request.output('newId', sql.Int);

    const result = await outputRequest.query(`
      INSERT INTO SupportThreads (CreatorUserName, CreatedOnDateTime, ModifierUserName, ModifiedOnDateTime, Subject, Category, Status)
      VALUES (@creatorUserName, SYSUTCDATETIME(), @creatorUserName, SYSUTCDATETIME(), @subject, @category, ${SupportThreadStatus.Active});

      SELECT SCOPE_IDENTITY() as newId;
    `);

    const newId = result.recordset[0].newId as number;

    await pool.request()
      .input('supportThreadId', sql.Int, newId)
      .input('creatorUserName', sql.NVarChar(256), creatorUserName)
      .input('message', sql.NVarChar(4000), message)
      .query(`
        INSERT INTO SupportThreadMessages (SupportThreadId, CreatorUserName, CreatedOnDateTime, Message)
        VALUES (@supportThreadId, @creatorUserName, SYSUTCDATETIME(), @message);
      `);

    const thread = await this.getById(newId);
    if (!thread) {
      throw new Error('Failed to retrieve created thread');
    }
    return thread;
  }

  async createMessage(
    supportThreadId: number,
    creatorUserName: string,
    message: string
  ): Promise<ISupportThreadMessage> {
    const pool = await getPool();
    const request = pool.request();

    request.input('supportThreadId', sql.Int, supportThreadId);
    request.input('creatorUserName', sql.NVarChar(256), creatorUserName);
    request.input('message', sql.NVarChar(4000), message);

    const outputRequest = request.output('newId', sql.Int);

    const result = await outputRequest.query(`
      INSERT INTO SupportThreadMessages (SupportThreadId, CreatorUserName, CreatedOnDateTime, Message)
      VALUES (@supportThreadId, @creatorUserName, SYSUTCDATETIME(), @message);

      SELECT SCOPE_IDENTITY() as newId;
    `);

    const newId = result.recordset[0].newId as number;

    await this.updateModifier(supportThreadId, creatorUserName);

    const createdMessage = await this.getMessageById(newId);
    if (!createdMessage) {
      throw new Error('Failed to retrieve created message');
    }
    return createdMessage;
  }

  async closeThread(id: number): Promise<ISupportThread | null> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);
    request.input('modifierUserName', sql.NVarChar(256), 'System');

    await request.query(`
      UPDATE SupportThreads
      SET Status = ${SupportThreadStatus.Closed},
          ModifierUserName = @modifierUserName,
          ModifiedOnDateTime = SYSUTCDATETIME()
      WHERE Id = @id
    `);

    return this.getById(id);
  }

  async getAll(
    pageIndex: number,
    pageSize: number,
    filter: ISupportThreadFilter
  ): Promise<IPagedSupportThreads> {
    const pool = await getPool();
    const request = pool.request();

    let whereClause = 'WHERE 1=1';

    if (filter.status !== undefined) {
      request.input('status', sql.Int, filter.status);
      whereClause += ' AND Status = @status';
    }

    const countResult = await request.query(`
      SELECT COUNT(*) as totalCount
      FROM SupportThreads
      ${whereClause}
    `);

    const totalCount = countResult.recordset[0].totalCount as number;

    const skipCount = pageIndex * pageSize;

    const dataRequest = pool.request();
    if (filter.status !== undefined) {
      dataRequest.input('status', sql.Int, filter.status);
    }
    dataRequest.input('skipCount', sql.Int, skipCount);
    dataRequest.input('pageSize', sql.Int, pageSize);

    const result = await dataRequest.query(`
      SELECT
        Id as id,
        CreatorUserName as creatorUserName,
        CreatedOnDateTime as createdOnDateTime,
        ModifierUserName as modifierUserName,
        ModifiedOnDateTime as modifiedOnDateTime,
        Subject as subject,
        Category as category,
        Status as status
      FROM SupportThreads
      ${whereClause}
      ORDER BY ModifiedOnDateTime DESC
      OFFSET @skipCount ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);

    return {
      pageIndex,
      pageSize,
      totalCount,
      data: result.recordset as ISupportThread[],
    };
  }

  async getById(id: number): Promise<ISupportThread | null> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT
        Id as id,
        CreatorUserName as creatorUserName,
        CreatedOnDateTime as createdOnDateTime,
        ModifierUserName as modifierUserName,
        ModifiedOnDateTime as modifiedOnDateTime,
        Subject as subject,
        Category as category,
        Status as status
      FROM SupportThreads
      WHERE Id = @id
    `);

    return result.recordset[0] as ISupportThread | null;
  }

  async getByIdWithMessages(id: number): Promise<ISupportThreadWithMessages | null> {
    const thread = await this.getById(id);
    if (!thread) {
      return null;
    }

    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT
        Id as id,
        SupportThreadId as supportThreadId,
        CreatorUserName as creatorUserName,
        CreatedOnDateTime as createdOnDateTime,
        Message as message
      FROM SupportThreadMessages
      WHERE SupportThreadId = @id
      ORDER BY CreatedOnDateTime ASC
    `);

    return {
      ...thread,
      messages: result.recordset as ISupportThreadMessage[],
    };
  }

  async getMessageById(id: number): Promise<ISupportThreadMessage | null> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT
        Id as id,
        SupportThreadId as supportThreadId,
        CreatorUserName as creatorUserName,
        CreatedOnDateTime as createdOnDateTime,
        Message as message
      FROM SupportThreadMessages
      WHERE Id = @id
    `);

    return result.recordset[0] as ISupportThreadMessage | null;
  }

  private async updateModifier(id: number, modifierUserName: string): Promise<void> {
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);
    request.input('modifierUserName', sql.NVarChar(256), modifierUserName);

    await request.query(`
      UPDATE SupportThreads
      SET ModifierUserName = @modifierUserName,
          ModifiedOnDateTime = SYSUTCDATETIME()
      WHERE Id = @id
    `);
  }

  async deleteAll(): Promise<void> {
    const pool = await getPool();
    
    // Delete all messages first (due to foreign key constraint)
    await pool.request().query(`
      DELETE FROM SupportThreadMessages;
    `);

    // Then delete all threads
    await pool.request().query(`
      DELETE FROM SupportThreads;
    `);
  }
}
