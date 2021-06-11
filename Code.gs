//************************************************************
//%NAME: filterThreads
//%DESCRIPTION:
// Process all desired Inbox threads based on the given settings.
//************************************************************
function filterThreads(settings) {
  logger = new MyLogger.create("Labelling Emails");
  
  var folder = "DynamicLabels";
  if ("folder" in settings) {
    folder = settings.folder
  }
  
  var filters = MailFilters.get(folder);
  
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
          logger.add("   found labelled thread, stopping");
          break;
        }
        logger.add("  skipping");
        continue;
      }
    }
    
    processThread(thread, filters, settings, logger);
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
function processThread(thread, filters, settings, logger) {
  var content = {};
  
  for(var i in filters) {
    var filter = filters[i];
    logger.add("  Filter: " + filter["name"]);
    if (!("label" in filter)) {
      logger.add("   no label");
      continue
    }
    
    if (!("patterns" in filter)) {
      logger.add("   no patterns");
      continue;
    }
    
    var patterns = filter["patterns"];
    
    var labelNames = null;
    for (type in patterns) {
     if (!(type in content)) {
        content[type] = getContent(thread, type);
      }    
      
      if (!(content[type])) {
        logger.add("   no content for " + type);
        continue;
      }
      
      logger.add("   " + type + ": " + patterns[type].toString() + " --> " + content[type].split("\n")[0]);
      var result = matchPattern(content[type], patterns[type], filter["label"], logger);
      logger.add("   Result " + (result === true ? "TRUE" : result.join(", ")));
      
      if (result === true) {
        continue;
      } else if (result !== false && result.length > 0) {
        if (labelNames) {
          labelNames = labelNames.filter(function(v) { return result.includes(v) });
        } else {
          labelNames = result;
        }
      } else {
        labelNames = [];
        break;
      }
    }
    
    if (labelNames == null) {
      continue;
    }
    
    logger.add("   Labels " + labelNames.join(", "));
    
    for(var i in labelNames) {
      var labelName = labelNames[i];
      logger.add("     Applying '" + labelName + "'");
      
      if (settings["modifyThreads"] === false) {
        continue;
      }
      
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

String.prototype.matchAll = function(re) {
  var str = this;
  var result = [];
  var post = /([^\0]*)$/;
  var flags = '';
  if (re.ignoreCase || post.ignoreCase) flags += 'i';
  if (re.global || post.global) flags += 'g';
  re = new RegExp(re.source + post.source, flags);
  var result = [];
  var m = str.match(re);
  while(m !== null) {
    var remainder = m.pop();
    var p = m[0].length - remainder.length;
    m[0] = m[0].substring(0, p);
    result.push(m);
    str = remainder;
    m = str.match(re);
  }
  return result;
}

//************************************************************
// Function: matchPattern()
// Description: Match a pattern against the given content and
// build the related label. If there is no match then return no
// label.
//************************************************************
function matchPattern(content, pattern, label, logger) {
  var result = [];
  var isDynamic = label.match(/\\\d+/) ? true : false;
  
  var matches = content.matchAll(pattern);
  for (var i in matches) {
    var match = matches[i];
  
    if (match.length == 1) {
      return (isDynamic === true) ? true : [label];
    }
    
    if (isDynamic === false) {
      return [label];
    }
    
    var newLabel = label;
    for(var i = 1; i < match.length; i++) {
      newLabel = newLabel.replace("\\"+i.toString(10), match[i]);
    }  
    
    if (result.indexOf(newLabel) === -1) {
       result.push(newLabel);
    }
  }
  
  if (result.length == 0) {
    logger.add("  -- not matched -- ");
  }
  
  return result;
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