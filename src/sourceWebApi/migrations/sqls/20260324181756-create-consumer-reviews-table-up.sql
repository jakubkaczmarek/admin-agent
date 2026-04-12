IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ConsumerReviews' AND xtype='U')
BEGIN
  CREATE TABLE ConsumerReviews (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ClientId INT NOT NULL,
    DateTime DATETIME2 NOT NULL,
    Rating INT NOT NULL CHECK (Rating >= 1 AND Rating <= 5),
    Comment NVARCHAR(MAX) NOT NULL,
    Status INT NOT NULL DEFAULT 0 CHECK (Status >= 0 AND Status <= 3)
  );

  PRINT 'Table ConsumerReviews created successfully';
END
ELSE
BEGIN
  PRINT 'Table ConsumerReviews already exists';
END
