Implement 'Consumer Review' entity with the following attributes:
* Id (integer)
* ClientId (integer)
* DateTime (date and time)
* Rating (integer - min 1 max 5)
* Comment (nvarchar)
* Status (integer)

The status should be mapped like this:
* 0 = new (initial, default status)
* 1 = AutoAccepted
* 2 = Accepted
* 3 = Rejected

Please make sure to add DB migration for new entity. Use this DB connection string:
"Server=localhost; Database=ReviewsAppDb; Integrated Security=True; TrustServerCertificate=True;"

Then, please add the consumer-review.controller with the following methods:
* GET ALL - with the following filter params:
	* startDate (DATE, e.g. 01/01/2026); mandatory
	* endDate (DATE, e.g. 01/01/2026); mandatory
	* status (INTEGER; min 0 max 3); optional
* POST /{id}/accept (no body) - finds review by ID and changes status to 'Accepted'
* POST /{id}/reject (no body) - finds review by ID and changes status to 'Rejected'