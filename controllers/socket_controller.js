/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller')
const { v4: uuidv4 } = require('uuid')
let io = null; // socket.io server instance

// list of rooms and their users
const rooms = []

// a defined room_id means that a room already exists
let room_id = ''

// status 'toggler' for if an opponent is waiting
let waitingStatus = true

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
 * Handle a user requesting to join a room
 *
 */
const handleUserJoin = function (username, callback) {
	debug(`User ${username} with socket id ${this.id} wants to join a room`)

	// check if room id is defined
	if (!room_id) {

		// if not, create uuid
		const uuid = uuidv4() // '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
		
		// set room id to uuid
		room_id = uuid

		// create a new room object
		const room = {
			id: room_id,
			users: [],
			/**
			 * @todo Tirapat: add room data here if necessary
			 */
		};
		// add the new room to list of rooms
		rooms.push(room);
	} else {
		// if room id is defined, the opponent is no longer waiting
		waitingStatus = false;
	}

	// find room object with `id` === room_id
	const room = getRoomById(room_id)

	// join room
	this.join(room.id)

	// create a user object
	const user = {
		id: this.id,
		username: username,
		/**
		 * @todo Tirapat: add user data here if necessary
		 */
	}

	// add user to the room
	room.users.push(user)

	// confirm join
	callback({
		waitingStatus,
		room_id: room.id,
	})

	// check if user needs to wait for an opponent
	if (!waitingStatus) {
		// if not, emit  to the first user that a second user is ready
		this.broadcast.to(room.id).emit('user:ready', room.id)

		// reset variables
		waiting = true
		roomName = ''
	}
}

const handleUsersReady = () => {
	debug(`Both users are ready to start the game`)
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

	// handle user join request
	socket.on('user:join', handleUserJoin)

	// handle both users ready to start the game
	socket.on('users:ready', handleUsersReady)
}