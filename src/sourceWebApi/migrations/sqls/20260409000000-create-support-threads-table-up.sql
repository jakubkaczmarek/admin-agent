IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SupportThreads' AND xtype='U')
BEGIN
  CREATE TABLE SupportThreads (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CreatorUserName NVARCHAR(256) NOT NULL,
    CreatedOnDateTime DATETIME2 NOT NULL,
    ModifierUserName NVARCHAR(256) NOT NULL,
    ModifiedOnDateTime DATETIME2 NOT NULL,
    Subject NVARCHAR(256) NOT NULL,
    Category NVARCHAR(256) NULL,
    Status INT NOT NULL DEFAULT 0 CHECK (Status >= 0 AND Status <= 1)
  );

  PRINT 'Table SupportThreads created successfully';
END
ELSE
BEGIN
  PRINT 'Table SupportThreads already exists';
END
