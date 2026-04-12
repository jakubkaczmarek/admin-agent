Implement src/services/tickets-api.client.ts - should be structured and have logic similar to various services in api-client-example.ts. One difference is - I want a common 'ApiClient' class dependency implemented in separate file - src/services/tickets-api.client.ts.

The tickets-api.client.ts should use AppConsts.ticketsApiBaseUrl to connect.

Please review API description below to design interfaces and client methods:

Tickets API has the following endpoints:
* POST {AppConsts.ticketsApiBaseUrl}/support-threads - allows to create a new thread with a first message; JSON body:
{
	"creatorUserName": "Adam",
	"subject": "Data import doesn't work",
	"category": "System", // optional
	"message": "I tried importing CSV data this morning, but it didn't work"
}
* POST {AppConsts.ticketsApiBaseUrl}/support-threads/{supportThreadId}/messages - allows to post a new thread message; JSON body:
{
	"creatorUserName": "Adam",
	"message": "Tried again today, still not working"
}
* POST {AppConsts.ticketsApiBaseUrl}/support-threads/{supportThreadId}/closed (no body) - changes support thread status to 'Closed'
* GET ALL {AppConsts.ticketsApiBaseUrl}/support-threads - returns paged list of support threads with the following filter params:
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
* GET {AppConsts.ticketsApiBaseUrl}/support-threads/{supportThreadId} - returns full thread with all messages. Response JSON body:
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