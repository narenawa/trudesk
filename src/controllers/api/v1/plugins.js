/*
      .                             .o8                     oooo
   .o8                             "888                     `888
 .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
   888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
   888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
   888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
   "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 ========================================================================
 Created:    02/22/2017
 Author:     Chris Brame

 **/

var _       = require('underscore'),
    winston = require('winston'),
    path    = require('path'),
    fs      = require('fs'),
    request = require('request'),
    rimraf  = require('rimraf'),
    tar     = require('tar');

var api_plugins = {};

var pluginPath = path.join(__dirname, '../../../../plugins');

const pluginServerUrl = 'http://plugins.trudesk.io';

api_plugins.installPlugin = function(req, res) {
    var packageid = req.params.packageid;

    request.get(pluginServerUrl + '/api/plugin/package/' + packageid, function(err, response) {
        if (err) return res.status(400).json({success: false, error: err});

        var plugin = JSON.parse(response.body).plugin;

        request.get(pluginServerUrl + '/plugin/download/' + plugin.url)
            .on('response', function(response) {

                var fws = fs.createWriteStream(path.join(pluginPath, plugin.url));

                response.pipe(fws);

                response.on('end', function() {

                    //Extract plugin
                    var pluginExtractFolder = path.join(pluginPath, plugin.name.toLowerCase());
                    rimraf(pluginExtractFolder, function(error) {
                        if (error) return res.json({success: false, error: 'Unable to remove plugin directory.'});

                        var extracter = tar.Extract({path: pluginPath})
                            .on('error', function(err){ console.log(err); return res.status(400).json({success: false, error: 'Unable to Extract plugin.'}); })
                            .on('end', function(){
                                //File has been extracted Delete Zip File...
                                rimraf(path.join(pluginPath, plugin.url), function(){
                                    //Wrap it up!!!!
                                    res.json({success: true, plugin: plugin});
                                    restartServer();
                                });
                            });

                        fs.createReadStream(path.join(pluginPath, plugin.url))
                            .on('error', function(err){ console.log(err); return res.status(400).json({success: false, error: 'Unable to Extract plugin.'}); })
                            .pipe(extracter);
                    });
                });

                response.on('error', function(err) {
                    return res.status(400).json({success: false, error: err});
                });
            })
            .on('error', function(err) {
                return res.status(400).json({success: false, error: err});
            });
    });
};

api_plugins.removePlugin = function(req, res) {
    var packageid = req.params.packageid;

    request.get(pluginServerUrl + '/api/plugin/package/' + packageid, function(err, response) {
        if (err) return res.status(400).json({success: false, error: err});

        var plugin = JSON.parse(response.body).plugin;

        rimraf(path.join(pluginPath, plugin.name.toLowerCase()), function(err) {
            if (err) return res.json({success: false, error: 'Unable to remove plugin directory.'});

            res.json({success: true});
            restartServer();
        })
    });
};

function restartServer() {
    var pm2 = require('pm2');
    pm2.connect(function(err) {
        if (err) {
            winston.error(err);
        }
        pm2.restart('trudesk', function(err) {
            if (err) {
                return winston.error(err);
            }

            pm2.disconnect();
        });
    });
}

module.exports = api_plugins;