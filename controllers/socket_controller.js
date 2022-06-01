/**
 * Socket Controller
 */

const debug = require('debug')('game:socket_controller')
const { v4: uuidv4 } = require('uuid') // creates a unique id, eg. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
let io = null; // socket.io server instance

// list of rooms and their users
const rooms = []

// a defined room_id means that a room already exists
let room_id = ''

// status 'toggler' for if an opponent is waiting
let waiting = true

/**
 * Get room by ID
 * @param {String} id ID of Room to get
 * @returns
 */
const getRoomById = id => {
	return rooms.find(room => room.id === id)
}

/**
 * Get room by User ID
 * @param {String} id Socket ID of User to get Room by
 * @returns
 */
const getRoomByUserId = id => {
	return rooms.find(room => room.users.find(user => user.id === id));
}

/**
 * Handle a user disconnecting
 */
const handleDisconnect = function () {
	// find room
	const room = getRoomByUserId(this.id)
	// if client was not in a room, don't do anything
	if (!room) {
		debug(`Client ${this.id} disconnected`)
		return
	}
	debug(`Client ${this.id} disconnected from room ${room.id}`)
	// construct message object
	const messageObject = {
		username: "😥",
		timestamp: Date.now(),
		content: "Your opponent left the battle",
	}
	// broadcast message to client
	this.broadcast.to(room.id).emit('user:disconnected', messageObject)
}

/**
 * Handle a user requesting to join a room
 * @param {string} username name of user requesting to join a room
 * @param {function} callback function to send waiting status back to client
 */
const handleUserJoin = function (username, callback) {
	debug(`User ${username} with socket id ${this.id} wants to join a room`)
	// check if room id is defined
	if (!room_id) {
		// if not, create uuid
		const uuid = uuidv4()
		// set room id to uuid
		room_id = uuid
		// create a new room object
		const room = {
			id: room_id,
			users: [],
			ready: false, // status toggler to be used when positioning ships
		}
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
		ships: []
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

/**
 * Function to handle when both users have joined a room
 * @param {string} room_id unique room id eg. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
 */
const handleUsersReady = async function (room_id) {
	debug(`Both users have joined a room with id ${room_id}`)
	// find room object with `id` === room_id
	const room = getRoomById(room_id)
	// get both users' usernames
	const userOne = room.users[0].username
	const userTwo = room.users[1].username
	// emit usernames to room
	io.to(room.id).emit('users:usernames', userOne, userTwo)
	// construct instructions message
	const messageObject = {
		username: "ℹ",
		timestamp: Date.now(),
		content: "Press 'Generate ships' to place your ships. When your opponent is ready, a random player will be chosen to start the game.",
	}
	// emit instructions to everyone in the room
	io.to(room.id).emit('log:instructions', messageObject)
}

/**
 * Function to handle when a user sends a chat message
 * @param {object} messageObject object containing a timestamp, username and content
 */
const handleChatMessage = (messageObject) => {
	debug(`${messageObject.timestamp}: ${messageObject.username} said: "${messageObject.content}"`)
	// find room
	const room = getRoomById(messageObject.room)
	// send chat message to everyone in the room
	io.to(room.id).emit('chat:incoming', messageObject)
}

/**
 * Handle a user requesting to start the game
 * @param {object} userShips list of ships
 * @param {function} callback function to send room status back to client
 */
const handleGameStart = function (userShips, callback) {
	debug(`Client with socket id: ${this.id} is ready to start the game`)
	// find room
	const room = getRoomByUserId(this.id)
	// find users
	const users = room.users
	// get users
	const user = users.find(user => user.id === this.id)
	// add ships to user
	user.ships.push.apply(user.ships, userShips)
	// confirm game start
	callback({
		room, // default value of room.ready is 'false'
	})
	// create waiting message
	const messageObject = {
		username: "⏱",
		timestamp: Date.now(),
		content: "Waiting for opponent...",
	}
	// send waiting message to client
	io.to(this.id).emit('log:waiting', messageObject)
	// store user's ships
	const userShipList = user.ships
	// send userShipList to client
	io.to(this.id).emit('user:ships', userShipList)
	// toggle 'ready' status
	room.ready = true
}

/**
 * Handle both users having positioned their ships
 * @param {string} room_id unique room id eg. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
 */
const handleShipsReady = (room_id) => {
	debug(`Both users have now placed their ships`)
	// find room
	const room = getRoomById(room_id)
	// find list of users in room
	const users = room.users
	// get random user
	const randomUser = users[Math.floor(Math.random() * users.length)]
	// emit who's turn it is
	io.to(room_id).emit('user:firstTurn', randomUser)
}

/**
 * Handle when a user fires a shot
 * @param {string} shotFired id of square that was clicked on eg. 'B4'
 * @param {string} room_id unique room id eg. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
 * @param {string} gameUsername username of user that fired a shot
 */
const handleFire = (shotFired, room_id, gameUsername) => {
	// find room
	const room = getRoomById(room_id)
	// find list of users in room
	const users = room.users
	//find user
	const user = users.find(user => user.username == gameUsername)
	//find opponent
	const opponent = users.find(user => user.username != gameUsername)
	// hit is initially set to false
	let hit = false
	//Check to see if it was a hit
	opponent.ships.forEach((ship) => {
		if (ship.position.includes(shotFired)) {
			// Find the indexOf shotFired and remove it from position array
			ship.position.splice(ship.position.indexOf(shotFired), 1)
			// set hit to true
			hit = true
			// If the ship position array is empty then set sunk to true
			if (!ship.position.length) {
				ship.sunk = true
			}
		}
	})
	// get user ships left
	const userShipsLeft = user.ships.filter((ship) => {
		return ship.sunk == false
	})
	// get opponent ships left
	const opponentsShipsLeft = opponent.ships.filter((ship) => {
		return ship.sunk == false
	})
	// winner is initially set to an empty string
	let winner = ""
	// check who the winner is
	if (userShipsLeft.length === 0) {
		winner = opponent.username
	} else if (opponentsShipsLeft.length === 0) {
		winner = gameUsername
	}
	// emit starting player to everyone in the room
	io.to(room_id).emit('log:fire', user)
	// emit if shot was a 'hit' or a 'miss'
	io.to(room_id).emit('fire:incoming', hit, gameUsername, shotFired)
	// emit updated ship status
	io.to(room_id).emit('ships:status', userShipsLeft, user.id, opponentsShipsLeft, opponent.id)
	// emit winner to everyone in the room
	io.to(room_id).emit('winner', winner)
}

/**
 * Export controller and attach handlers to events
 */
module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;
	debug(`Client with socket id: ${socket.id} connected`)
	// handle user disconnect
	socket.on('disconnect', handleDisconnect)
	// handle user join request
	socket.on('user:join', handleUserJoin)
	// handle both users having joined a room
	socket.on('users:ready', handleUsersReady)
	// handle chat message
	socket.on('chat:message', handleChatMessage)
	// handle user ready to start the game
	socket.on('game:start', handleGameStart)
	// handle fire
	socket.on('user:fire', handleFire)
	// handle both users having positioned their ships
	socket.on('ships:ready', handleShipsReady)
}