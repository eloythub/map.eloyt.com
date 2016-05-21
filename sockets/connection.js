var Promise = require('promise');
var socketRepo = getRepos('sockets')();
var Deligations = require('./delegations');

module.exports = Connection;

/**
 * handle the socket.io connection
 * @param base
 * @returns {Connection}
 * @constructor
 */
function Connection(base) {
    'use strict';

    if (!(this instanceof Connection)) {
        return new Connection(base);
    }

    var localSockets = {};
    localSockets[process.pid] = [];

    var cleanUpSockets = function (signal) {
        console.info('[GC]', process.pid, signal);
        return new Promise(function (resolve, reject) {
            localSockets[process.pid].forEach(function (socketId) {
                socketRepo.disconnect(socketId).then(function () {
                    base.io.connected[socketId].disconnect();
                }, reject);
            });
            process.exitCode = 1;

            resolve();
        });
    };

    ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'exit'].forEach(function (signal) {
        process.on(signal, function () {
            cleanUpSockets(signal).then(function () {
                setTimeout(function () {
                    if (signal !== 'SIGINT') {
                        process.exitCode = 1;
                        process.exit(1);
                    } else {
                        if (process.send === undefined) {
                            process.exitCode = 1;
                            process.exit(1);
                        }
                    }
                }, 100);
            }, function (e) {
                console.error(e);
                process.exitCode = 1;
                process.exit(1);
            });
        });
    });

    base.io.on('connection', function (socket) {
        var region = socket.handshake.query.region || null;
        socketRepo.connect(socket.session.user._id, socket.id, region).then(function () {
            localSockets[process.pid].push(socket.id);

            new Deligations(base.io, socket);

            socket.on('disconnect', function () {
                socketRepo.disconnect(socket.id).then(function () {
                    localSockets[process.pid].remove(localSockets[process.pid].indexOf(socket.id));
                }, function (err) {
                    console.error(err);
                });
            });
        }, function (err) {
            console.error(err);
            socket.disconnect();
        });
    });
}
