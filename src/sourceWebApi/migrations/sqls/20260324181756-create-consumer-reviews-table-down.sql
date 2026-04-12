IF EXISTS (SELECT * FROM sysobjects WHERE name='ConsumerReviews' AND xtype='U')
BEGIN
  DROP TABLE ConsumerReviews;
  PRINT 'Table ConsumerReviews dropped successfully';
END
ELSE
BEGIN
  PRINT 'Table ConsumerReviews does not exist';
END
