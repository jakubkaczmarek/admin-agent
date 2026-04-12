IF EXISTS (SELECT * FROM sysobjects WHERE name='SupportThreadMessages' AND xtype='U')
BEGIN
  DROP TABLE SupportThreadMessages;
  PRINT 'Table SupportThreadMessages dropped successfully';
END
ELSE
BEGIN
  PRINT 'Table SupportThreadMessages does not exist';
END

IF EXISTS (SELECT * FROM sysobjects WHERE name='SupportThreads' AND xtype='U')
BEGIN
  DROP TABLE SupportThreads;
  PRINT 'Table SupportThreads dropped successfully';
END
ELSE
BEGIN
  PRINT 'Table SupportThreads does not exist';
END
