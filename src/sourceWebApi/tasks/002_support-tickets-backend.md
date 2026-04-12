Implement SupportThread entity with the following attributes:
* Id (integer; mandatory)
* CreatorUserName (string; mandatory)
* CreatedOnDateTime (date and time; mandatory)
* ModifierUserName (string; mandatory)
* ModifiedOnDateTime (date and time; mandatory)
* Subject (string, max 256 chars; mandatory)
* Category (string, max 256 chars; optional)
* Status (integer; mandatory)

Available statuses:
0 - Active
1 - Closed

Implement SupportThreadMessage entity with the following attributes:
* Id (integer; mandatory)
* SupportThreadId (integer; mandatory)
* CreatorUserName (string; mandatory)
* CreatedOnDateTime (date and time; mandatory)
* Message (string, max 4000 chars; mandatory)

Create 1-n relationship between SupportThread and SupportThreadMessage entities with SupportThreadId foreign key on SupportThreadMessage message.

Please make sure to add DB migration for new entities.

Then, please add the support-threads.controller with the following methods:
* POST / - allows to create a new thread with a first message; JSON body:
{
	"creatorUserName": "Adam",
	"subject": "Data import doesn't work",
	"category": "System", // optional
	"message": "I tried importing CSV data this morning, but it didn't work"
}
* POST /{supportThreadId}/messages - allows to post a new thread message; JSON body:
{
	"creatorUserName": "Adam",
	"message": "Tried again today, still not working"
}
* POST /{supportThreadId}/closed (no body) - changes support thread status to 'Closed'
* GET ALL / - returns paged list of support threads with the following filter params:
	* status; optional
	Response JSON body:
	{
		"pageIndex": 0,
		"pageSize": 20,
		"totalCount": 40,
		"data":
		[
			{
				"id": 1,
				"creatorUserName": "Adam",
				"createdOnDateTime": "2026-02-02 16:44:45.4456789",
				"modifierUserName": "Barbra",
				"modifiedOnDateTime": "2026-02-02 17:12:04.4456789",
				"subject": "Data export doesn't work",
				"category": "System",
				"status": 0
			},
			{
				"id": 2,
				"creatorUserName": "Matt",
				"createdOnDateTime": "2026-02-02 16:44:45.4456789",
				"modifierUserName": "Fiona",
				"modifiedOnDateTime": "2026-02-02 17:12:04.4456789",
				"subject": "Can't use in offline mode",
				"category": "System",
				"status": 1
			}
		]
	}
* GET /{supportThreadId} - returns full thread with all messages. Response JSON body:
	{
		"id": 1,
		"creatorUserName": "Adam",
		"createdOnDateTime": "2026-02-02 16:44:45.4456789",
		"modifierUserName": "Barbra",
		"modifiedOnDateTime": "2026-02-02 17:12:04.4456789",
		"subject": "Data export doesn't work",
		"category": "System",
		"status": 0,
		"messages": // sorted by 'createdOnDateTime'
		[
			{
				"id": 4001,
				"creatorUserName": "Adam",
				"createdOnDateTime": "2026-02-02 16:44:45.4456789",
				"message": "System doesn't work"
			},
			{
				"id": 4002,
				"creatorUserName": "SystemBot",
				"createdOnDateTime": "2026-02-02 17:44:45.4456789",
				"message": "I checked seconds ago, it's up and running"
			}
		]
	}