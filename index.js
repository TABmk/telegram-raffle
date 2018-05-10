// TODO autoroll

var TelegramBot = require('node-telegram-bot-api');
var express = require('express');
var fs = require('fs');

require('console-stamp')(console, '[HH:MM:ss.l]');
var config = require('./config.json');
var rafpath = './raffles/';
var statpath = './stats/';

var app = express();
var bot = new TelegramBot(config.token, {
    polling: true
});

var adminId = config.adminId;
var raffles = [];

bot.getMe()
    .then(function (value) {
        console.log("[Info] Starting bot @" + value['username']);
    });

function checkUserInDB(db) {
    var obj = JSON.parse(fs.readFileSync(statpath + db + '.json', 'utf8'));
    var statitems = [];
    obj.forEach(function (itm, i) {
        statitems.push(itm)
    });
    return statitems;
}

function isAdmin(checkadmin, raf, adper) {
    return new Promise(function (resolve, reject) {
        if (adper == true) {
            if (raf != "") {
                bot.getChatMember(raf, checkadmin)
                    .then(function (data) {
                        if (data['status'] == 'creator' || data['status'] == 'administrator') {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    })
            }
        }
    });
}


fs.exists("config.json", function (exists) {
    if (exists) {
        fs.readdir(rafpath, (err, files) => {
            files.forEach(file => {
                raffles.push(file);
            });
            console.log("[Info] Loaded " + raffles.length + " raffle(s)");
            bot.onText(/\/start (.+)/, (msg, match) => {
                var mess = null;
                var option = {
                    "parse_mode": "Markdown"
                };
                var resp = match[1];
                var rafindex = raffles.indexOf(resp + ".json");
                if (rafindex != -1) {
                    var raffle = JSON.parse(fs.readFileSync(rafpath + raffles[rafindex], 'utf8'));
                    if (raffle.enable == true) {
                        mess = raffle.name;
                        option = {
                            "parse_mode": "Markdown"
                            , "reply_markup": {
                                "inline_keyboard": [[{
                                    text: config.participateButton
                                    , callback_data: '{"type":"entrie","raffle":"' + resp + '"}'
								  }, {
                                    text: config.endsButton
                                    , callback_data: '{"type":"end","raffle":"' + resp + '"}'
								  }, {
                                    text: config.descrButton
                                    , callback_data: '{"type":"description","raffle":"' + resp + '"}'
								  }]]
                            }
                        };
                        fs.exists(statpath + resp + ".json", function (exists) {
                            if (!exists) {
                                fs.writeFile(statpath + resp + ".json", '[]', {
                                    flag: 'wx'
                                }, function (err, data) {
                                    console.log('[Info] Creating database for ' + resp + "...")
                                })
                            }
                        });
                    } else {
                        mess = config.noAvailable;
                    }
                } else {
                    mess = config.incorrectName;
                }
                if (mess != null) {
                    bot.sendMessage(msg.chat.id, mess, option);
                } else {
                    bot.sendMessage(msg.chat.id, config.error, option);
                    console.log('[Error] Error in /start')
                }
            });
            bot.on("callback_query", function onCallbackQuery(callbackQuery) {
                var rafindex = raffles.indexOf(JSON.parse(callbackQuery['data'])['raffle'] + ".json");
                var raffle = JSON.parse(fs.readFileSync(rafpath + raffles[rafindex], 'utf8'));
                if (rafindex < 0 || rafindex > raffles.length) {
                    bot.answerCallbackQuery(callbackQuery['id'], config.error, true);
                }else{
                    switch (JSON.parse(callbackQuery['data'])['type']) {
                    case 'entrie':
                        if (!raffle.required[0]['noLimits']) {
                            bot.getChatMember(raffle.required[0]['chatID'], callbackQuery['from']['id'])
                                .then(function (data) {
                                    if (data['status'] != 'left' && data['status'] != 'kicked') {
                                        if (checkUserInDB(JSON.parse(callbackQuery['data'])['raffle'])
                                            .includes(callbackQuery['from']['id']) == false) {
                                            bot.answerCallbackQuery(callbackQuery['id'], config.onSuccessfulJoin, true);
                                            var obj = JSON.parse(fs.readFileSync(statpath + JSON.parse(callbackQuery['data'])['raffle'] + '.json', 'utf8'));
                                            obj.push(callbackQuery['from']['id']);
                                            if (callbackQuery['from']['username'] != null) {
                                                console.log("[Info] New entry - @" + callbackQuery['from']['username']);
                                            } else {
                                                console.log("[Info] New entry - " + callbackQuery['from']['first_name'] + " " + callbackQuery['from']['last_name']);
                                            }
                                            fs.writeFile(statpath + JSON.parse(callbackQuery['data'])['raffle'] + '.json', JSON.stringify(obj));
                                        } else {
                                            bot.answerCallbackQuery(callbackQuery['id'], config.AlreadyJoined, true);
                                        }
                                    } else {
                                        bot.answerCallbackQuery(callbackQuery['id'], config.notChatMember, true);
                                    }
                                });
                        } else {
                            if (checkUserInDB(JSON.parse(callbackQuery['data'])['raffle'])
                                .includes(callbackQuery['from']['id']) == false) {
                                bot.answerCallbackQuery(callbackQuery['id'], config.onSuccessfulJoin, true);
                                var obj = JSON.parse(fs.readFileSync(statpath + JSON.parse(callbackQuery['data'])['raffle'] + '.json', 'utf8'));
                                obj.push(callbackQuery['from']['id']);
                                if (callbackQuery['from']['username'] != null) {
                                    console.log("[Info] New entry - @" + callbackQuery['from']['username']);
                                } else {
                                    console.log("[Info] New entry - " + callbackQuery['from']['first_name'] + " " + callbackQuery['from']['last_name']);
                                }
                                fs.writeFile(statpath + JSON.parse(callbackQuery['data'])['raffle'] + '.json', JSON.stringify(obj));
                            } else {
                                bot.answerCallbackQuery(callbackQuery['id'], config.AlreadyJoined, true);
                            }
                        }
                        break;
                    case 'end':
                        bot.answerCallbackQuery(callbackQuery['id'], raffle.endDate, true);
                        break;
                    case 'description':
                        bot.answerCallbackQuery(callbackQuery['id'], raffle.description, true);
                        break;
                    default:
                        console.log('[Error] inline buttons error');
                    };
                }
            });
        });
    } else {
        fs.writeFile("config.json", '{}', {
            flag: 'wx'
        }, function (err, data) {
            console.log('[Info] Creating Config...')
            console.log('[Info] Config created. Please, configure it.')
        })
    }

    bot.onText(/\/cleardb (.+)/, (msg, match) => {
        var resp = match[1];
        fs.exists(rafpath + resp + ".json", function (exists) {
            if (exists) {
                var opts = {
                    reply_to_message_id: msg.message_id
                };
                var raffle = JSON.parse(fs.readFileSync(rafpath + resp + ".json", 'utf8'));
                isAdmin(msg.from.id, raffle.required[0]['chatID'], raffle.adminPerms)
                    .then(function (val) {
                        if (msg.from.id == adminId || val == true || raffle.additionAdmin.includes(msg.from.id) == true) {
                            fs.exists(statpath + resp + '.json', function (exists) {
                                if (exists) {
                                    var obj = JSON.parse(fs.readFileSync(statpath + resp + '.json', 'utf8'));
                                    if (obj[0] != null) {
                                        fs.writeFile(statpath + resp + '.json', JSON.stringify([]));
                                        bot.sendMessage(msg.chat.id, config.onDBclear, opts);
                                    } else {
                                        bot.sendMessage(msg.chat.id, config.alreadyClear, opts);
                                    }
                                } else {
                                    bot.sendMessage(msg.chat.id, config.dbClearError, opts);
                                }
                            });
                        }
                    });
            }
        });
    });

    bot.onText(/\/config (.+)/, (msg, match) => {
        var resp = match[1];
        var fst = resp.split(" ");
        var raffle = JSON.parse(fs.readFileSync(rafpath + fst[0] + ".json", 'utf8'));
        isAdmin(msg.from.id, raffle.required[0]['chatID'], raffle.adminPerms)
            .then(function (val) {
                if (msg.from.id == adminId || val == true || raffle.additionAdmin.includes(msg.from.id) == true) {
                    fs.exists(rafpath + fst[0] + '.json', function (exists) {
                        if (exists) {
                            var obj = JSON.parse(fs.readFileSync(rafpath + fst[0] + ".json", 'utf8'));
                            if(obj[fst[1]]){
                                obj[fst[1]] = fst[2];
                                fs.writeFile(rafpath + fst[0] + '.json', JSON.stringify(obj));
                            }else{
                                bot.sendMessage(msg.chat.id, config.errorConfig);
                            }
                        } else {
                            bot.sendMessage(msg.chat.id, config.incorrectName);
                        }
                    });
                }
            });
    });

    bot.onText(/\/members (.+)/, (msg, match) => {
        var resp = match[1];
        fs.exists(rafpath + resp + ".json", function (exists) {
            if (exists) {
                var opts = {
                    reply_to_message_id: msg.message_id
                };
                var raffle = JSON.parse(fs.readFileSync(rafpath + resp + ".json", 'utf8'));
                isAdmin(msg.from.id, raffle.required[0]['chatID'], raffle.adminPerms)
                    .then(function (val) {
                        if (msg.from.id == adminId || val == true || raffle.additionAdmin.includes(msg.from.id) == true) {
                            fs.exists(statpath + resp + '.json', function (exists) {
                                if (exists) {
                                    var obj = JSON.parse(fs.readFileSync(statpath + resp + '.json', 'utf8'));
                                    bot.sendMessage(msg.chat.id, config.members + obj.length, opts);
                                }
                            });
                        }
                    });
            }
        });
    });

    bot.onText(/\/roll (.+)/, (msg, match) => {
        var resp = match[1];
        var rolls = 1;
        var fst = resp.split(" ", 2);
        fs.exists(rafpath + fst[0] + ".json", function (exists) {
            if (exists) {
                var raffle = JSON.parse(fs.readFileSync(rafpath + fst[0] + ".json", 'utf8'));
                isAdmin(msg.from.id, raffle.required[0]['chatID'], raffle.adminPerms)
                    .then(function (val) {
                        if (msg.from.id == adminId || val == true || raffle.additionAdmin.includes(msg.from.id) == true) {
                            fs.exists(statpath + fst[0] + '.json', function (exists) {
                                if (exists) {
                                    var obj = JSON.parse(fs.readFileSync(statpath + fst[0] + '.json', 'utf8'));
                                    if (obj[0] != null) {
                                        bot.sendMessage(msg.chat.id, config.roll1, {
                                            'parse_mode': 'Markdown'
                                            , 'disable_web_page_preview': 'true'
                                        });
                                        setTimeout(function () {
                                            bot.sendMessage(msg.chat.id, config.roll2);
                                        }, 400);
                                        setTimeout(function () {
                                            if (raffle.required[0]['chatID'] != null && raffle.required[0]['chatID'] != "") {
                                                function rl(){
                                                  if (!fst[1]) fst[1] = 1;
                                                  if (obj.length >= fst[1]) {
                                                    var roll = obj[Math.floor(Math.random() * obj.length)];
                                                    bot.getChatMember(raffle.required[0]['chatID'], roll)
                                                        .then(function (data) {
                                                            if (data['status'] != 'left' && data['status'] != 'kicked') {
                                                                if (data['user']['username'] != null) {
                                                                    // TODO fix this shit
                                                                    obj.splice(obj.indexOf(roll));
                                                                    fs.writeFile(statpath + fst[0] + '.json', JSON.stringify(obj));
                                                                    bot.sendMessage(msg.chat.id, '@' + data['user']['username'] + config.roll3);
                                                                    if (rolls < fst[1]) {
                                                                        rolls++;
                                                                        rl();
                                                                    }
                                                                } else {
                                                                    let ms = "";
                                                                    if (data['user']['first_name']) ms += data['user']['first_name'] + " ";
                                                                    if (data['user']['last_name']) ms += data['user']['last_name'];
                                                                    obj.splice(obj.indexOf(roll));
                                                                    fs.writeFile(statpath + fst[0] + '.json', JSON.stringify(obj));
                                                                    bot.sendMessage(msg.chat.id, ms + " " + config.roll3);
                                                                    if (rolls < fst[1]) {
                                                                        rolls++;
                                                                        rl();
                                                                    }
                                                                }
                                                            } else {
                                                                obj.splice(obj.indexOf(roll));
                                                                fs.writeFile(statpath + fst[0] + '.json', JSON.stringify(obj));
                                                                rl();
                                                            }
                                                        });
                                                    } else {
                                                        bot.sendMessage(msg.chat.id, config.rollerror2);
                                                    }
                                                }
                                                rl();
                                            }
                                            // TODO this

                                            // else {
                                            //     bot.getChat(roll)
                                            //         .then(function (data) {
                                            //             if (data['username'] != null) {
                                            //                 bot.sendMessage(msg.chat.id, '@' + data['user']['username'] + config.roll3);
                                            //             } else {
                                            //                 bot.sendMessage(msg.chat.id, data['user']['first_name'] + " " + data['user']['last_name'] + config.roll3);
                                            //             }
                                            //         });
                                            // }
                                        }, 550);
                                    } else {
                                        bot.sendMessage(msg.chat.id, config.rollerror2);
                                    }
                                }
                            });
                        }
                    });
            }
        });
    });

    bot.onText(/\/announce (.+)/, (msg, match) => {
        var resp = match[1];
        var fst = resp.split(" ", 2);
        var txt = resp.substr(resp.indexOf(" ") + 1);
        fs.exists(rafpath + fst[0] + ".json", function (exists) {
            if (exists) {
                var raffle = JSON.parse(fs.readFileSync(rafpath + fst[0] + ".json", 'utf8'));
                var ci = raffle.required[0]['chatID'];
                if (msg.from.id == adminId && ci != null && ci != "") {
                    bot.sendMessage(ci, txt, {
                        'parse_mode': 'Markdown'
                        , 'disable_web_page_preview': 'true'
                    });
                }
            }
        });
    });

    // Logger
    bot.onText(/(.+)/, (msg, match) => {
        bot.getChat(msg.from.id)
            .then(function (data) {
                if (data['username'] != null) {
                    console.log("[Log] New message from @" + data['username'] + " - " + match[0]);
                } else {
                    console.log("[Log] New message from " + data['first_name'] + " " + data['last_name'] + " - " + match[0]);
                }
            });
    });

    // API
    if(config.port){
        app.get('/api', function (req, res) {
          let rf = [];
          raffles.forEach(function(item, i, arr) {
              rf.push(fs.readFileSync(rafpath + item, 'utf8'));
          });
          res.send('{"count":' + raffles.length + ',"raffles": [' + rf + '] }');
        });

        app.listen(config.port, function () {
          console.log('[Info] Starting api on port :' + config.port);
        });
    }
});
