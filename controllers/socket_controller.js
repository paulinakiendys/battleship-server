/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

/**
 * Handle a user disconnecting
 * 
 */
const handleDisconnect = function() {
	debug(`Client ${this.id} disconnected`)
}

const handleHello = function() {
	debug(`Client ${this.id} said hello`)
}

/**
 * Export controller and attach handlers to events
 *
 */
module.exports = function(socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	debug(`Client ${socket.id} connected`)

	// handle user disconnect
	socket.on('disconnect', handleDisconnect)

}