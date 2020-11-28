﻿exports.newIndicatorBot = function newIndicatorBot(processIndex, bot, parentLogger) {

    const MODULE_NAME = "Indicator Bot";

    let USER_BOT_MODULE;
    let COMMONS_MODULE;

    const MULTI_PERIOD_MARKET = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'MultiPeriodMarket');
    const MULTI_PERIOD_DAILY = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'MultiPeriodDaily');
    const FILE_STORAGE = require('./FileStorage.js');
    let fileStorage = FILE_STORAGE.newFileStorage(parentLogger);

    const DEBUG_MODULE = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'DebugLog');
    let logger; // We need this here in order for the loopHealth function to work and be able to rescue the loop when it gets in trouble.

    let nextLoopTimeoutHandle;

    let thisObject = {
        initialize: initialize,
        run: run
    };

    let processConfig;

    return thisObject;

    function initialize(pProcessConfig, callBackFunction) {
        try {
            processConfig = pProcessConfig;

            if (bot.repo === undefined) {
                /* The code of the bot is defined at the UI. No need to load a file with the code. */
                callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE);
                return
            }

            /* This bot is not ready for taking its code from the UI, then we need to load it from its repo. */
            let filePath =
                bot.processNode.referenceParent.parentNode.parentNode.project +    // project
                '/Bots-Plotters-Code/' +
                TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.parentNode.parentNode.config.codeName +
                "/" + "bots" + "/" +
                bot.processNode.referenceParent.parentNode.config.repo + "/" +
                pProcessConfig.codeName
            filePath += "/User.Bot.js"

            fileStorage.getTextFile(filePath, onBotDownloaded);

            function onBotDownloaded(err, text) {

                if (err.result !== TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result) {

                    parentLogger.write(MODULE_NAME, "[ERROR] initialize -> onInizialized -> onBotDownloaded -> err = " + err.message);
                    parentLogger.write(MODULE_NAME, "[ERROR] initialize -> onInizialized -> onBotDownloaded -> filePath = " + filePath);
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE);
                    return;
                }

                USER_BOT_MODULE = {}
                USER_BOT_MODULE.newUserBot = eval(text); // TODO This needs to be changed function

                filePath = TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].referenceParent.parentNode.parentNode.config.codeName + "/" + "bots" + "/" + bot.processNode.referenceParent.parentNode.config.repo
                filePath += "/Commons.js"

                fileStorage.getTextFile(filePath, onCommonsDownloaded);

                function onCommonsDownloaded(err, text) {
                    if (err.result !== TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result) {
                        parentLogger.write(MODULE_NAME, "[WARN] initialize -> onBotDownloaded -> onCommonsDownloaded -> Commons not found: " + err.message);
                        callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE);
                        return;
                    }
                    COMMONS_MODULE = {}
                    COMMONS_MODULE.newCommons = eval(text); // TODO This needs to be changed function

                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE);
                }
            }
        } catch (err) {
            parentLogger.write(MODULE_NAME, "[ERROR] initialize -> err = " + err.stack);
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE);
        }
    }

    function run(callBackFunction) {
        try {
            let fixedTimeLoopIntervalHandle;

            /* Heartbeats sent to the UI */
            bot.processHeartBeat = processHeartBeat

            if (bot.runAtFixedInterval === true) {
                fixedTimeLoopIntervalHandle = setInterval(loop, bot.fixedInterval);
            } else {
                loop();
            }

            function loop() {
                try {
                    function pad(str, max) {
                        str = str.toString();
                        return str.length < max ? pad(" " + str, max) : str;
                    }

                    /* For each loop we want to create a new log file. */
                    if (logger !== undefined) {
                        logger.finalize()
                    }
                    logger = DEBUG_MODULE.newDebugLog(processIndex);
                    TS.projects.superalgos.globals.taskVariables.LOGGER_MAP.set(MODULE_NAME + TS.projects.superalgos.globals.taskConstants.TASK_NODE.bot.processes[processIndex].id, logger)
                    logger.bot = bot;
                    logger.initialize();

                    bot.loopCounter++;
                    bot.loopStartTime = new Date().valueOf();

                    /* We tell the UI that we are running. */
                    processHeartBeat()

                    /* We define here all the modules that the rest of the infraestructure, including the bots themselves can consume. */
                    const UTILITIES = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'CloudUtilities');
                    const STATUS_REPORT = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'StatusReport');
                    const STATUS_DEPENDENCIES = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'StatusDependencies');
                    const DATA_DEPENDENCIES = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'DataDependencies');
                    const DATA_SET = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'DataSet');
                    const PROCESS_EXECUTION_EVENTS = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'ProcessExecutionEvents');
                    const PROCESS_OUTPUT = require(TS.projects.superalgos.globals.nodeJSConstants.REQUIRE_ROOT_DIR + 'ProcessOutput');

                    /* We define the datetime for the process that we are running now. This will be the official processing time for both the infraestructure and the bot. */
                    bot.processDatetime = new Date();           // This will be considered the process date and time, so as to have it consistenly all over the execution.

                    /* High level log entry  */
                    console.log(new Date().toISOString() + " " + pad(TS.projects.superalgos.globals.taskConstants.TASK_NODE.parentNode.parentNode.parentNode.referenceParent.parentNode.parentNode.name, 20) + " " + pad(TS.projects.superalgos.globals.taskConstants.TASK_NODE.parentNode.parentNode.parentNode.referenceParent.baseAsset.referenceParent.config.codeName + '/' + TS.projects.superalgos.globals.taskConstants.TASK_NODE.parentNode.parentNode.parentNode.referenceParent.quotedAsset.referenceParent.config.codeName, 10) + " " + pad(bot.codeName, 30) + " " + pad(bot.process, 30)
                        + "      Main Loop     # " + pad(Number(bot.loopCounter), 8))

                    /* We will prepare first the infraestructure needed for the bot to run. There are 3 modules we need to sucessfullly initialize first. */
                    let processExecutionEvents
                    let userBot;
                    let processFramework;
                    let statusDependencies;
                    let dataDependencies;

                    let nextWaitTime;

                    initializeProcessExecutionEvents();

                    function initializeProcessExecutionEvents() {
                        try {
                            processExecutionEvents = PROCESS_EXECUTION_EVENTS.newProcessExecutionEvents(processIndex, bot, logger)
                            processExecutionEvents.initialize(processConfig, onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Execution finished well.");
                                            startProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeProcessExecutionEvents -> onInizialized -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeProcessExecutionEvents -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function startProcessExecutionEvents() {
                        try {
                            processExecutionEvents.start(onStarted);

                            function onStarted(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> startProcessExecutionEvents -> onStarted -> Execution finished well.");

                                            if (TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING === true) {
                                                loopControl()
                                                return
                                            }

                                            initializeStatusDependencies();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> startProcessExecutionEvents -> onStarted -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessExecutionEvents -> onStarted -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessExecutionEvents -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function initializeStatusDependencies() {
                        try {
                            statusDependencies = STATUS_DEPENDENCIES.newStatusDependencies(processIndex, bot, logger, STATUS_REPORT, UTILITIES, PROCESS_OUTPUT);
                            statusDependencies.initialize(onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> initializeStatusDependencies -> onInizialized -> Execution finished well.");
                                            initializeDataDependencies();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> initializeStatusDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeStatusDependencies -> onInizialized -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeStatusDependencies -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function initializeDataDependencies() {
                        try {
                            dataDependencies = DATA_DEPENDENCIES.newDataDependencies(processIndex, bot, logger, DATA_SET);
                            dataDependencies.initialize(onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            /* If the process is configured to run inside a framework, we continue there, otherwise we run the bot directly. */
                                            if (processConfig.framework === undefined) {
                                                initializeUserBot();
                                                return;
                                            }

                                            switch (processConfig.framework.name) {
                                                case 'Multi-Period-Market': {
                                                    processFramework = MULTI_PERIOD_MARKET.newMultiPeriodMarket(processIndex, bot, logger, UTILITIES, FILE_STORAGE);
                                                    intitializeProcessFramework();
                                                    break;
                                                }
                                                case 'Multi-Period-Daily': {
                                                    processFramework = MULTI_PERIOD_DAILY.newMultiPeriodDaily(processIndex, bot, logger, UTILITIES, FILE_STORAGE);
                                                    intitializeProcessFramework();
                                                    break;
                                                }
                                                default: {
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Process Framework not Supported.");
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Process Framework Name = " + processConfig.framework.name);
                                                    global.unexpectedError = err.message
                                                    processStopped()
                                                    return
                                                }
                                            }
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> initializeDataDependencies -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            processStopped()
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies ->  onInizialized -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeDataDependencies -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function initializeUserBot() {
                        try {
                            usertBot = USER_BOT_MODULE.newUserBot(processIndex, bot, logger, COMMONS_MODULE, UTILITIES, FILE_STORAGE);
                            usertBot.initialize(statusDependencies, onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> initializeUserBot -> onInizialized -> Execution finished well.");
                                            startUserBot();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> initializeUserBot -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                default: {
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot -> onInizialized > Unhandled custom response received. -> err = " + err.message);
                                                    global.unexpectedError = err.message
                                                    processStopped()
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot ->  onInizialized -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> initializeUserBot -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function startUserBot() {
                        try {
                            usertBot.start(onFinished);

                            function onFinished(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> startUserBot -> onFinished -> Execution finished well.");
                                            finishProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> startUserBot -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> onFinished -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                case "Dependency does not exist.": {
                                                    logger.write(MODULE_NAME, "[WARN] run -> loop -> startUserBot -> onFinished -> Dependency does not exist. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                case "Dependency not ready.": {
                                                    logger.write(MODULE_NAME, "[WARN] run -> loop -> startUserBot -> onFinished -> Dependency not ready. Will Retry Later.");
                                                    nextWaitTime = 'Retry';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                default: {
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> onFinished -> Unhandled custom response received. -> err = " + err.message);
                                                    global.unexpectedError = err.message
                                                    processStopped()
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> onFinished -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startUserBot -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function intitializeProcessFramework() {
                        try {
                            processFramework.initialize(processConfig, statusDependencies, dataDependencies, onInizialized);

                            function onInizialized(err) {
                                try {
                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> intitializeProcessFramework -> onInizialized -> Execution finished well.");
                                            startProcessFramework();
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> intitializeProcessFramework -> onInizialized -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                default: {
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized > Unhandled custom response received. -> err = " + err.message);
                                                    global.unexpectedError = err.message
                                                    processStopped()
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework -> onInizialized -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework ->  onInizialized -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> intitializeProcessFramework -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function startProcessFramework() {
                        try {
                            processFramework.start(onFinished);

                            function onFinished(err) {
                                try {
                                    processFramework.finalize()
                                    processFramework = undefined
                                    dataDependencies.finalize()
                                    dataDependencies = undefined
                                    statusDependencies.finalize()
                                    statusDependencies = undefined

                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> startProcessFramework -> onFinished -> Execution finished well.");
                                            finishProcessExecutionEvents()
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> startProcessFramework -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.CUSTOM_OK_RESPONSE.result: {

                                            switch (err.message) {
                                                case "Dependency does not exist.": {
                                                    logger.write(MODULE_NAME, "[WARN] run -> loop -> startProcessFramework -> onFinished -> Dependency does not exist. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                case "Dependency not ready.": {
                                                    logger.write(MODULE_NAME, "[WARN] run -> loop -> startProcessFramework -> onFinished -> Dependency not ready. This Loop will go to sleep.");
                                                    nextWaitTime = 'Sleep';
                                                    loopControl(nextWaitTime);
                                                    return;
                                                }
                                                default: {
                                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled custom response received. -> err = " + err.message);
                                                    global.unexpectedError = err.message
                                                    processStopped()
                                                    return
                                                }
                                            }
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> onFinished -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> startProcessFramework -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function finishProcessExecutionEvents() {
                        try {
                            processExecutionEvents.finish(onFinished);

                            function onFinished(err) {
                                try {
                                    processExecutionEvents.finalize()
                                    processExecutionEvents = undefined

                                    switch (err.result) {
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE.result: {
                                            logger.write(MODULE_NAME, "[INFO] run -> loop -> finishProcessExecutionEvents -> onFinished -> Execution finished well.");
                                            nextWaitTime = 'Normal';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                                            logger.write(MODULE_NAME, "[WARN] run -> loop -> finishProcessExecutionEvents -> onFinished -> Retry Later. Requesting Execution Retry.");
                                            nextWaitTime = 'Retry';
                                            loopControl(nextWaitTime);
                                            return;
                                        }
                                        case TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Operation Failed. Aborting the process.");
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                        default: {
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Unhandled err.result received. -> err.result = " + err.result);
                                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> Unhandled err.result received. -> err = " + err.message);
                                            global.unexpectedError = err.message
                                            processStopped()
                                            return
                                        }
                                    }
                                } catch (err) {
                                    logger.write(MODULE_NAME, "[ERROR] run -> loop -> finishProcessExecutionEvents -> onFinished -> err = " + err.stack);
                                    global.unexpectedError = err.message
                                    processStopped()
                                    return
                                }
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> finishProcessExecutionEvents -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }

                    function loopControl(nextWaitTime) {
                        logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> nextWaitTime = " + nextWaitTime)

                        /* We show we reached the end of the loop. */
                        processHeartBeat()

                        /* Here we check if we must stop the loop gracefully. */
                        shallWeStop(onStop, onContinue);

                        function onStop() {
                            logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> onStop -> Stopping the Loop Gracefully. See you next time!")
                            processStopped()
                            return;
                        }

                        function onContinue() {
                            /* Indicator bots are going to be executed after a configured period of time after the last execution ended. This is to avoid overlapping executions. */
                            switch (nextWaitTime) {
                                case 'Normal': {
                                    logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> Restarting Loop in " + (processConfig.normalWaitTime / 1000) + " seconds.")
                                    nextLoopTimeoutHandle = setTimeout(loop, processConfig.normalWaitTime);
                                    processHeartBeat(undefined, undefined, "Waiting " + processConfig.normalWaitTime / 1000 + " seconds for next execution.")
                                    logger.persist();
                                }
                                    break;
                                case 'Retry': {
                                    logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> Restarting Loop in " + (processConfig.retryWaitTime / 1000) + " seconds.")
                                    nextLoopTimeoutHandle = setTimeout(loop, processConfig.retryWaitTime);
                                    processHeartBeat(undefined, undefined, "Trying to recover from some problem. Waiting " + processConfig.retryWaitTime / 1000 + " seconds for next execution.")
                                    logger.persist();
                                }
                                    break;
                                case 'Sleep': {
                                    logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> Restarting Loop in " + (processConfig.sleepWaitTime / 60000) + " minutes.")
                                    nextLoopTimeoutHandle = setTimeout(loop, processConfig.sleepWaitTime);
                                    processHeartBeat(undefined, undefined, "Waiting " + processConfig.sleepWaitTime / 60000 + " minutes for next execution.")
                                    logger.persist();
                                }
                                    break;
                                case 'Coma': {
                                    logger.write(MODULE_NAME, "[INFO] run -> loop -> loopControl -> Restarting Loop in " + (processConfig.comaWaitTime / 3600000) + " hours.")
                                    nextLoopTimeoutHandle = setTimeout(loop, processConfig.comaWaitTime);
                                    processHeartBeat(undefined, undefined, "Waiting " + processConfig.comaWaitTime / 3600000 + " hours for next execution.")
                                    logger.persist();
                                }
                                    break;
                            }
                        }
                    }

                    function shallWeStop(stopCallBack, continueCallBack) {
                        try {
                            /* IMPORTANT: This function is exactly the same on the 3 modules. */
                            if (!TS.projects.superalgos.globals.taskVariables.IS_TASK_STOPPING) {
                                continueCallBack();
                            } else {
                                stopCallBack();
                            }
                        } catch (err) {
                            logger.write(MODULE_NAME, "[ERROR] run -> loop -> shallWeStop -> err = " + err.stack);
                            global.unexpectedError = err.message
                            processStopped()
                            return
                        }
                    }
                } catch (err) {
                    parentLogger.write(MODULE_NAME, "[ERROR] run -> loop -> err = " + err.stack);
                    global.unexpectedError = err.message
                    processStopped()
                    return
                }
            }

            function processHeartBeat(processingDate, percentage, status) {
                let event = {
                    seconds: (new Date()).getSeconds(),
                    processingDate: processingDate,
                    percentage: percentage,
                    status: status
                }
                global.EVENT_SERVER_CLIENT_MODULE.raiseEvent(bot.processKey, 'Heartbeat', event)
            }

            function processStopped() {
                if (global.unexpectedError !== undefined) {
                    TS.projects.superalgos.functionLibraries.processFunctions.processError(bot.processKey, undefined, "An unexpected error caused the Process to stop.")
                } else {
                    global.EVENT_SERVER_CLIENT_MODULE.raiseEvent(bot.processKey, 'Stopped')
                }
                logger.persist();
                clearInterval(fixedTimeLoopIntervalHandle);
                clearTimeout(nextLoopTimeoutHandle);
                if (global.unexpectedError !== undefined) {
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE)
                } else {
                    callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_OK_RESPONSE)
                }
            }

        } catch (err) {
            parentLogger.write(MODULE_NAME, "[ERROR] run -> err = " + err.stack);
            clearInterval(fixedTimeLoopIntervalHandle);
            clearTimeout(nextLoopTimeoutHandle);
            callBackFunction(TS.projects.superalgos.globals.standardResponses.DEFAULT_FAIL_RESPONSE);
        }
    }
};
