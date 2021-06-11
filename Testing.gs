//************************************************************
//%NAME: filterAll
//%DESCRIPTION:
// Processes all the threads in the INBOX by default omitting
// those that are already tagged.
//************************************************************
function filterAll() {
  filterThreads({ "limit": "all",
                  "untagged": true,
                  "report": false});
}

//************************************************************
//%NAME: filterLimit
//%DESCRIPTION:
// Processes the first 10 threads in the INBOX and produce a 
// report.
//************************************************************
function filterLimit() {
  filterThreads({ "limit": [0,6],
                  "untagged": true,
                  "stopAt": "none",
                  "modifyEmails": false,
                  "report": true});
}

//************************************************************
//%NAME: filterAllAndReport
//%DESCRIPTION:
// Processes all the threads in the INBOX by default omitting
// those that are already tagged and sends a follow up report.
//************************************************************
function filterAllAndReport() {
  filterThreads({ "limit": "all",
                  "untagged": true,
                  "report": true});
}
