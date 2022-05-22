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
let waiting = true

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
 * Get room by User ID
 *
 * @param {String} id Socket ID of User to get Room by
 * @returns
 */
const getRoomByUserId = id => {
	return rooms.find(room => room.users.find(user => user.id === id));
}

/**
 * Handle a user disconnecting
 * 
 */
const handleDisconnect = function () {

	const room = getRoomByUserId(this.id)

	// if client was not in a room, don't do anything
	if (!room) {
		debug(`Client ${this.id} disconnected`)
		return
	}

	debug(`Client ${this.id} disconnected from room ${room.id}`)

	// send message to client
	// 1. construct message object
	const messageObject = {
		username: "server",
		timestamp: Date.now(),
		content: "Your opponent left the battle 😥",
	}

	// 2. broadcast message to client
	this.broadcast.to(room.id).emit('user:disconnected', messageObject)

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
		const uuid = uuidv4() // eg. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

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
		rooms.push(room)
	} else {
		// if room id is defined, the opponent is no longer waiting
		waiting = false
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
		waiting,
		room_id: room.id,
	})

	// check if user needs to wait for an opponent
	if (!waiting) {
		// if not, emit  to the first user that a second user is ready
		this.broadcast.to(room.id).emit('user:ready', room.id)

		// reset variables
		waiting = true
		room_id = ''
	}
}

const handleUsersReady = async function (room_id) {
	debug(`Both users have joined a room with id ${room_id}`)

	// find room object with `id` === room_id
	const room = getRoomById(room_id)

	// get both users' usernames
	const userOne = room.users[0].username
	const userTwo = room.users[1].username

	// emit usernames to room
	io.to(room.id).emit('users:usernames', userOne, userTwo)

	// send instructions
	// 1. construct message object
	const messageObject = {
		username: "server",
		timestamp: Date.now(),
		content: "Press 'Randomize' to change ship positions. Press 'Ready' to start.",
	}

	// 2. emit instructions to everyone in the room
	io.to(room.id).emit('log:instructions', messageObject)
}

const handleChatMessage = (messageObject) => {
	debug(`${messageObject.timestamp}: ${messageObject.username} said: "${messageObject.content}"`)

	const room = getRoomById(messageObject.room)

	io.to(room.id).emit('chat:incoming', messageObject)
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

	// handle chat message
	socket.on('chat:message', handleChatMessage)
}