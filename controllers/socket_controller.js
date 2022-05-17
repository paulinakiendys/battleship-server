/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller');
let io = null; // socket.io server instance

const rooms = []

/**
 * Get room by ID
 *
 * @param {String} id ID of Room to get
 * @returns
 */
const getRoomById = id => {
	return rooms.find(room => room.id === id)
}

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
const handleUserJoined = async function (username, room_id, callback) {
	debug(`User ${username} with socket id ${this.id} wants to join room '${room_id}'`);

	// join room
	this.join(room_id);

	// create a object for the new room
	const newRoom = {
		id: room_id,
		users: {}
	}

	// add room to array of rooms
	rooms.push(newRoom)

	// add socket to list of online users in this room

	// find room object with `id` === room_id
	const room = getRoomById(room_id)

	// add socket to room's `users` object
	room.users[this.id] = username

	// confirm join
	callback({
		success: true,
		room: room.id,
		users: room.users,
	});

	// broadcast list of users to everyone in the room
	io.to(room.id).emit('user:list', room.users);
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