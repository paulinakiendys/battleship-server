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
		username: "😥",
		timestamp: Date.now(),
		content: "Your opponent left the battle",
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
			ready: false, // status toggler to be used when positioning ships
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
		username: "ℹ",
		timestamp: Date.now(),
		content: "Press 'Ready' to start.",
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
 * 
 * Handle a user requesting to start the game
 */
const handleGameStart = function (userShips, callback) {
	debug(`Client with socket id: ${this.id} is ready to start the game`)

	// find room
	const room = getRoomByUserId(this.id)

	//Add the ships to the user
	const users = room.users

	const getUserById = id => {
		return users.find(user => user.id === id)
	}

	const user = getUserById(this.id)

	user.ships.push.apply(user.ships, userShips)

	console.log("This should be user: ", user)

	// confirm game start
	callback({
		room, // default value of room.ready is 'false'
	})

	// create message object
	const messageObject = {
		username: "⏱",
		timestamp: Date.now(),
		content: "Waiting for opponent...",
	}

	// send waiting message to client
	io.to(this.id).emit('log:waiting', messageObject)

	//save user's ships
	const userShipList = user.ships

	// send userShipList to client
	io.to(this.id).emit('user:ships', userShipList)

	// toggle 'ready' status
	room.ready = true
}

/**
 * 
 * Handle both users having positioned their ships
 */
const handleShipsReady = (room_id) => {
	debug(`Both users have now placed their ships`)

	// get room
	const room = getRoomById(room_id)

	// get list of users in room
	const users = room.users

	// get random user
	const randomUser = users[Math.floor(Math.random() * users.length)];

	// create message object
	const messageObject = {
		username: " 💣",
		timestamp: Date.now(),
		content: `Let the battle begin! ${randomUser.username} goes first. Fire!`,
	}

	// emit message with starting player to everyone in the room
	io.to(room_id).emit('log:startingPlayer', messageObject)

	// emit who's turn it is
	io.to(room_id).emit('user:firstTurn', randomUser)
	
}



//** HANDLE THE ACTUAL GAMING */

/**
 * Handle fire
 *
 */

const handleFire = (shotFired, room_id, gameUsername) => {

	// get room
	const room = getRoomById(room_id)

	// get list of users in room
	const users = room.users

	console.log("Users:", users)

	//find user
	const user = users.find(user => user.username == gameUsername)

	//find opponent
	const opponent = users.find(user => user.username != gameUsername)

	console.log("IS THIS OPPONENT? ", opponent)

	console.log(shotFired)

	//Check to see if it was a hit
	opponent.ships.forEach((ship) => {
		if (ship.position.includes(shotFired)) {
			console.log("YOU GOT A HIT")

			//Find the indexOf shotFired and remove that from position array.
			ship.position.splice(ship.position.indexOf(shotFired), 1)

			// If the ship position array is empty then give sunk true
			if(!ship.position.length) {
				console.log("Ship sunk")
				ship.sunk = true
				console.log(opponent)
			}

		} else {
			console.log("MISS")
		}
		console.log(ship.position)
	})

	// Send to client
	const userShipsLeft = user.ships.filter((ship) => {
		return ship.sunk == false
	})
	console.log("userShipsLeft", userShipsLeft.length)

	// Send to client
	const opponentsShipsLeft = opponent.ships.filter((ship) => {
		return ship.sunk == false
	})
	console.log("opponentsShipsLeft", opponentsShipsLeft.length)


	const ShipsLeft = opponent.ships.filter((ship) => {
		return ship.sunk == false
	})

	
	const messageObject = {
		username: "server",
		timestamp: Date.now(),
		content: `${gameUsername} fired on ${shotFired}💣 | ${opponent.username} has ${ShipsLeft.length} ships left!`
	}

	let winner = ""

	if(userShipsLeft.length === 0) {
		winner = opponent.username
		console.log(`${winner} wins`)
	} else if(opponentsShipsLeft.length === 0) {
		winner = gameUsername
		console.log(`${winner} wins`)
	} 

	// emit message with starting player to everyone in the room
	io.to(room_id).emit('log:fire', messageObject, user)

	// emit updated length of shipsarray
	io.to(room_id).emit('ships:left', userShipsLeft, opponentsShipsLeft) 

	io.to(room_id).emit('winner', winner)
}
// GameResults
const handleResults = (room_id, gameUsername) => {
	// get room
	const room = getRoomById(room_id)

	// get list of users in room
	const users = room.users

	console.log("Users:", users)

	//find user
	const user = users.find(user => user.username == gameUsername)

	//find opponent
	const opponent = users.find(user => user.username != gameUsername)

	const userShipsSunk = user.ships.filter((ship) => {
		return ship.sunk == true
	})

	const opponentsShipsSunk = opponent.ships.filter((ship) => {
		return ship.sunk == true
	})

	/* const winner = ""

	if(userShipsSunk.length === 4 ) {
		console.log(`${user.username} lost`)
		winner = opponent.username
	} else if(opponentsShipsSunk.length === 4) {
		console.log(`${opponentsShipsSunk.length} lost`)
		winner = user.username
	} */
		
	const messageObject = {
		username: "server",
		timestamp: Date.now(),
		content: `${winner} has won!`
	}

	io.to(room_id).emit('log:results', messageObject)
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

	// handle gameResults
	socket.on('game:results', handleResults)
}