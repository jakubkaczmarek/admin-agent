IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SupportThreadMessages' AND xtype='U')
BEGIN
  CREATE TABLE SupportThreadMessages (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SupportThreadId INT NOT NULL,
    CreatorUserName NVARCHAR(256) NOT NULL,
    CreatedOnDateTime DATETIME2 NOT NULL,
    Message NVARCHAR(4000) NOT NULL,
    CONSTRAINT FK_SupportThreadMessages_SupportThreads FOREIGN KEY (SupportThreadId) 
      REFERENCES SupportThreads(Id) ON DELETE CASCADE
  );

  PRINT 'Table SupportThreadMessages created successfully';
END
ELSE
BEGIN
  PRINT 'Table SupportThreadMessages already exists';
END
