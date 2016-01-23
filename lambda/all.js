/**
 * Lambda function for security system monitoring and control triggred by Alexa.
 * 
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
 * 
 * For details see https://github.com/goruck.
 *
 * For additional samples, visit the Alexa Skills Kit Getting Started guide at
 * http://amzn.to/1LGWsLG.
 * 
 * Lindo St. Angel 2015/16.
 */

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Prevents someone else from configuring a skill that sends requests to this function.
         */
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.7d25022e-92dd-4a1c-8814-c6ec6caaaa9d") {
             context.fail("Invalid Application ID");
         }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
                ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
            ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("MyNumIsIntent" === intentName) {
        sendKeyInSession(intent, session, callback);
    } else if ("MyCodeIsIntent" === intentName) {
        sendCodeInSession(intent, session, callback);
    } else if ("WhatsMyStatusIntent" === intentName) {
        getStatusFromSession(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getWelcomeResponse(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "ready,";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "Please tell the security system a command, or ask its status," +
                       "Valid commands are the names of any keypad button," +
                       "After a status update, the session will end";
    var shouldEndSession = false;

    callback(sessionAttributes,
             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/*
 * Gets the panel keypress from the user in the session.
 * Prepares the speech to reply to the user.
 * Sends the keypress to the panel over a TLS TCP socket.
 */
function sendKeyInSession(intent, session, callback) {
    var cardTitle = intent.name;
    var KeysSlot = intent.slots.Keys;
    var repromptText = "";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";
    var tls = require('tls');
    var fs = require('fs');
    var PORT = fs.readFileSync('port.txt').toString("utf-8", 0, 4);
    var HOST = fs.readFileSync('host.txt').toString("utf-8", 0, 14);
    var CERT = fs.readFileSync('client.crt');
    var KEY  = fs.readFileSync('client.key');
    var CA   = fs.readFileSync('ca.crt');
    var options = {
        host: HOST,
        port: PORT,
        cert: CERT,
        key: KEY,
        ca: CA,
        rejectUnauthorized: true
    };
    
    var ValidValues = ['0','1', '2', '3', '4', '5', '6', '7', '8', '9',
                       'stay', 'away', 'star', 'pound'];
    
    repromptText = "please tell the security system a command, or ask its status," +
                   "valid commands are the names of any keypad button," +
                   "status, or a 4 digit code," +
                   "after a status update, the session will end";
    
    if (KeysSlot) {
        var num = KeysSlot.value;
        var a = ValidValues.indexOf(num, 0);
        sessionAttributes = createNumberAttributes(num);
        if(a === -1) {
            speechOutput = num + ",is an invalid command," +
                           "valid commands are the names of a keypad button," +
                           "status, or a 4 digit code";
            callback(sessionAttributes,
                buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
        } else {
            speechOutput = "sending, " +num;
            var socket = tls.connect(options, function() {
                console.log('connected to host ' +HOST);
                if(socket.authorized){
                    console.log('host is authorized');
                } else {
                    console.log('host cert auth error: ', socket.authorizationError);
                }
                socket.write(num +'\n');
                console.log('wrote ' +num);
                socket.end;
                console.log('disconnected from host ' +HOST);
                callback(sessionAttributes,
                    buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
            
            });
            socket.on('error', function(ex) {
                console.log("handled error");
                console.log(ex);
            });
        }
        
    } else {
        console.log('error in SendKeyInSession');
    }
}

/*
 * Gets the a 4 digit code from the user in the session.
 * Prepares the speech to reply to the user.
 * Sends the code to the panel over a TLS TCP socket.
 */
function sendCodeInSession(intent, session, callback) {
    var cardTitle = intent.name;
    var CodeSlot = intent.slots.Code;
    var repromptText = "";
    var sessionAttributes = {};
    var shouldEndSession = false;
    var speechOutput = "";
    var tls = require('tls');
    var fs = require('fs');
    var PORT = fs.readFileSync('port.txt').toString("utf-8", 0, 4);
    var HOST = fs.readFileSync('host.txt').toString("utf-8", 0, 14);
    var CERT = fs.readFileSync('client.crt');
    var KEY  = fs.readFileSync('client.key');
    var CA   = fs.readFileSync('ca.crt');
    var options = {
        host: HOST,
        port: PORT,
        cert: CERT,
        key: KEY,
        ca: CA,
        rejectUnauthorized: true
    };
    
    repromptText = "please tell the security system a command, or ask its status," +
                   "valid commands are the names of any keypad button," +
                   "status, or a 4 digit code," +
                   "after a status update, the session will end";
    
    if (CodeSlot) {
        var num = CodeSlot.value;
        sessionAttributes = createNumberAttributes(num);
        if(num === '?' || num > 9999) {
            speechOutput = num + ", is an invalid code," +
                           "codes must be positive 4 digit integers, " +
                           "not greater than 9999";
            callback(sessionAttributes,
                buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
        }
        else {
            speechOutput = "sending, " +num;
            var socket = tls.connect(options, function() {
                console.log('connected to host ' +HOST);
                if(socket.authorized){
                    console.log('host is authorized');
                } else {
                    console.log('host cert auth error: ', socket.authorizationError);
                }
                socket.write(num +'\n');
                console.log('wrote ' +num);
                socket.end;
                console.log('disconnected from host ' +HOST);
                callback(sessionAttributes,
                    buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
            
            });
            socket.on('error', function(ex) {
                console.log("handled error");
                console.log(ex);
            });
        }
    } else {
        console.log('error in SendCodeInSession');
    }
}

function createNumberAttributes(key) {
    return {
        key : key
    };
}

/**
 * Gets the panel status via a TLS TCP socket.
 * Sends the resulting speech to the user and ends session.
 */
function getStatusFromSession(intent, session, callback) {
    var cardTitle = intent.name;
    // Setting repromptText to null signifies that we do not want to reprompt the user.
    // If the user does not respond or says something that is not understood, the session
    // will end.
    var repromptText = "";
    var sessionAttributes = {};
    var shouldEndSession = true;
    var speechOutput = "";
    var read = "";
    var tls = require('tls');
    var fs = require('fs');
    var PORT = fs.readFileSync('port.txt').toString("utf-8", 0, 4);
    var HOST = fs.readFileSync('host.txt').toString("utf-8", 0, 14);
    var CERT = fs.readFileSync('client.crt');
    var KEY  = fs.readFileSync('client.key');
    var CA   = fs.readFileSync('ca.crt');
    var options = {
        host: HOST,
        port: PORT,
        cert: CERT,
        key: KEY,
        ca: CA,
        rejectUnauthorized: true
    };
    
    var socket = tls.connect(options, function() {
        console.log('connected to host ' +HOST);
        if(socket.authorized){
          console.log('host is authorized');
        }
        else{
          console.log('host cert auth error: ', socket.authorizationError);
        }
        socket.write('idle\n');
    });
       
    socket.on('data', function(data) {
        read += data.toString();
    });
       
    socket.on('end', function() {
        socket.end;
        console.log('disconnected from host ' +HOST);
        console.log('host data read: ' +read);
        speechOutput = read;
        callback(sessionAttributes,
             buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
    });
       
    socket.on('error', function(ex) {
        console.log("handled error");
        console.log(ex);
    });
}

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
