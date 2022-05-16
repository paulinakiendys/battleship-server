/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

/**
 * Handle a user disconnecting
 * 
 */
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected`)
}

/**
 * Handle a user joining a room
 *
 */
 const handleUserJoined = async function(room_id, callback) {
	debug(`User with socket id ${this.id} wants to join room '${room_id}'`);

	// confirm join
	callback({
		success: true,
	});
 }

/**
 * Export controller and attach handlers to events
 *
 */
module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	debug(`Client with socket id: ${socket.id} connected`)

	// handle user disconnect
	socket.on('disconnect', handleDisconnect)

	// handle user joined
	socket.on('user:joined', handleUserJoined)
}