//************************************************************
//%NAME: MyLogger
//%DESCRIPTION:
// Collects all the messages output to the log and just in case
// they need to be sent to the user.
//************************************************************
function MyLogger(title) {
  this.log = "";
  this.title = title;
  
  this.add = function(msg) {
    Logger.log(msg);
    this.log += msg + "\n";
  }
  
  this.send = function() {
    GmailApp.sendEmail(Session.getActiveUser().getEmail(), this.title, this.log);
  }
};

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
//%NAME: filterNew
//%DESCRIPTION:
// Processes all the threads in the INBOX by default omitting
// those that are already tagged, when a thread with labels is
// encountered then stop.
//************************************************************
function filterNew() {
  filterThreads({ "limit": "all",
                  "untagged": true,
                  "stopAt": "firstLabelled",
                  "report": false});
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

//************************************************************
//%NAME: filterThreads
//%DESCRIPTION:
// Process all desired Inbox threads based on the given settings.
//************************************************************
function filterThreads(settings) {
  logger = new MyLogger("Labelling Emails");
  
  var filters = getFilters(logger);
  for(filter in filters) {
    info = filters[filter];
  }
  
  processInbox(settings, filters, logger);
  
  if (settings["report"] === true) {
    logger.send();
  }
}

//************************************************************
//%NAME: processInbox
//%DESCRIPTION:
// Process all desired Inbox threads based on the given filters.
//************************************************************
function processInbox(settings, filters, logger) {
  var threads = getThreads(settings);
  for(var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    logger.add("Thread: " + thread.getFirstMessageSubject() + " -----");
    
    if (settings["untagged"] === true) {
      if (thread.getLabels().length > 0) {
        if (settings["stopAt"] === "firstLabelled") {
          logger.add("   found labelled");
          break;
        }
        logger.add("  skipping");
        continue;
      }
    }
    
    processThread(thread, filters, logger);
  }
} 

//************************************************************
//%NAME: getThreads
//%DESCRIPTION:
// Retrieve all desired the Inbox threads based on the settings.
//************************************************************
function getThreads(settings) {
  if (!("limit" in settings)) {
    return GmailApp.getInboxThreads(0,10);
  }
  
  if (settings["limit"] === "all") {
    return GmailApp.getInboxThreads();
  }
  
  if (Array.isArray(settings["limit"])) {
    var low = settings["limit"][0];
    var high = settings["limit"][1];
    return GmailApp.getInboxThreads(low, high);
  }
  
  return [];
}

//************************************************************
// Function: processThread()
// Description: Process the given thread against the whole
// collection of filters.
//************************************************************
function processThread(thread, filters, logger) {
  var content = {};
  
  for(tag in filters) {
    var filter = filters[tag];
    logger.add("  Filter: " + tag);
    if (!("label" in filter)) {
      logger.add("   no label");
      continue
    }
    
    if (!("patterns" in filter)) {
      logger.add("   no patterns");
      continue;
    }
    
    var patterns = filter["patterns"];
      
    for (type in patterns) {
     if (!(type in content)) {
        content[type] = getContent(thread, type);
      }    
      
      if (!(content[type])) {
        logger.add("   no content for " + type);
        continue;
      }
      
      logger.add("   " + type + ": " + patterns[type].toString());
      
      var labelName = extractLabelFromPattern(content[type], patterns[type], filter["label"]);
      if (labelName) {
        logger.add("     Applying '" + labelName + "'");
        applyLabel(thread, labelName);
        if (filter["archive"] === true) {
          thread.moveToArchive();
        } else {
          thread.moveToInbox();
        }
        break;
      }
    }
  }
}     

//************************************************************
// Function: getContent()
// Get the applicable content from the given thread.
//************************************************************
function getContent(thread, type) {
  if (type == "subject") {
    return thread.getFirstMessageSubject();
  }
  
  var messages = thread.getMessages();
  var message = messages[0];
  if (type == "body") {
    return message.getBody();
  }
  
  if (type == "from") {
    return message.getFrom();
  }
  
  if (type == "to") {
    return message.getTo();
  }
  
  return;
}

//************************************************************
// Function: extractLabelFromPattern()
// Description: Match a pattern against the given content and
// build the related label. If there is no match then return no
// label.
//************************************************************
function extractLabelFromPattern(content, pattern, label) {
  var match = content.match(pattern);
  if (!match) {
    Logger.log("no match");
    return;
  }
  
  Logger.log(match);
  
  for(var i = 1; i < match.length; i++) {
    label = label.replace("\\"+i.toString(10), match[i]);
  }
  
  return label;
}  

//************************************************************
// Function: applyLabel()
// Description: Apply an existing label, or create a new one, with the
// corresponding name and apply it to the given thread.
//************************************************************
function applyLabel(thread, name) {
  var names = name.split('/');
  var labelName = "";
  var label = null;
  for(var i = 0; i < names.length; i++) {
    if (names[i] == "") {
      continue;
    }
    
    labelName = labelName + ((labelName==='') ? "" : "/") + names[i];
    label = GmailApp.getUserLabelByName(labelName);
    if (!label) {
      label = GmailApp.createLabel(labelName);
    }
  }

  if (!label) {
    return;
  }
  
  label.addToThread(thread);
}

//************************************************************
// Function: getFiltersJSON()
// Description: Retrieves the configuration settings based on
// from a specific file in Google Drive.
//************************************************************
function getFiltersJSON() {
  var files = DriveApp.getFilesByName("filtering.json");
  while (files.hasNext()) {
    var file = files.next();
    var blob = file.getBlob();
    var content = blob.getDataAsString();
    return content;
  }
  
  logger.add("No settings file could be found");
}

//************************************************************
// Function: getFilters()
// Description: Retrieves the configuration settings based on
// from a specific file in Google Drive and parses them based
// on JSON.
//************************************************************
function getFilters(logger) {
  var filters = getFiltersJSON(logger);
  filters = JSON.parse(filters);
  for(filter in filters) {
    info = filters[filter];
    if ("patterns" in info) {
      patterns = info["patterns"];
      for(type in patterns) {
        var pattern = patterns[type];
        if (typeof pattern === 'string') {
          patterns[type] = new RegExp(pattern);
        } else if (Array.isArray(pattern)) {
          if (pattern.length == 1) {
            patterns[type] = new RegExp(pattern[0]);
          } else if (pattern.length == 2) {
            patterns[type] = new RegExp(pattern[0], pattern[1]);
          }
        }
      }
    }
  }
  
  return filters;
}