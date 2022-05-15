/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

// Total number of clients that have ever connected
let connectedClients = 0

// Room number to be set when a new client connects
let roomNumber

// Object with player data
let players = {}
/**
 * Example:
 * 
 * 	{
 * 		VrQTANXcVtZPx4OiAAAH: { player: 1, roomNumber: 1, shipsLeft: 1, isWinner: false },
 * 		_VYYA0daSNujtZSHAAAJ: { player: 2, roomNumber: 1, shipsLeft: 3, isWinner: false },
 * 		EH4H_HSN7qms5fKnAAAN: { player: 1, roomNumber: 2, shipsLeft: 2, isWinner: false },
 * 		rLOI69m6mgkS0VH0AAAP: { player: 2, roomNumber: 2, shipsLeft: 0, isWinner: true },
 * 		Vff1CwWv0_Joh2_4AAAR: { player: 1, roomNumber: 3, shipsLeft: 4, isWinner: false }
 * 	}
 */


/**
 * Handle a user disconnecting
 * 
 */
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected`)
	// Remove player from players object
	delete players[this.id]
	// console.log(`Total number of clients that have ever connected ${connectedClients}`)
	console.log('Connected players:', players)
}

/**
 * Export controller and attach handlers to events
 *
 */
module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	// debug(`Client with socket id: ${socket.id} connected`)

	// Increase number of connected clients when a new client connects
	connectedClients++

	// Formula to set room number depending on number of connected clients
	roomNumber = Math.round(connectedClients / 2)

	// console.log(`Total number of connected clients: ${connectedClients}`)

	socket.join(roomNumber)

	// Set connecting client to either player 1 or player 2
	if (connectedClients % 2 === 1) {
		// console.log(`Player 1 joined room number ${roomNumber}`)

		// Create player 1
		players[socket.id] = {
			player: 1,
			roomNumber,
			shipsLeft: 4,
			isWinner: false,
		}
	} else if (connectedClients % 2 === 0) {
		// console.log(`Player 2 joined room number ${roomNumber}`)

		// Create player 2
		players[socket.id] = {
			player: 2,
			roomNumber,
			shipsLeft: 4,
			isWinner: false,
		}
	}

	console.log('Connected players:', players)

	// Emit room number to client
	socket.emit('room:number', roomNumber)

	// handle user disconnect
	socket.on('disconnect', handleDisconnect)

}