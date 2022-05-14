/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

/**
 * Export controller and attach handlers to events
 *
 */
module.exports = function(socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

}