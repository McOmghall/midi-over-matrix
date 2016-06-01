const matrixJsSdk = require('matrix-js-sdk')
const EventEmitter = require('events')
const util = require('util')
const LOG_SYNCS = false
const LOG_LOGINS = false

util.inherits(MatrixManager, EventEmitter)
function MatrixManager ($log) {
  EventEmitter.call(this)
  var selfMatrixManager = this
  var loginPromise = null
  var client = null

  /**
   * Data for UI, default values (updated onSync, see below)
   */
  selfMatrixManager.ownRooms = []
  selfMatrixManager.users = []
  selfMatrixManager.status = 'UNLOGGED'

  /**
   * Updates on every sync event the local data we need for the interface
   */
  var onSync = function (state, prevState, result) {
    switch (state) {
      case null:
        // Do nothing
        break
      case 'SYNCING':
        this.ownRooms = client.getRooms()
        this.users = client.getUsers()
        this.turnServers = client.getTurnServers()
        this.userId = client.credentials.userId
        this.status = state
        break
      default:
        this.status = state
    }
    this.emit('update')
    if (LOG_SYNCS) {
      $log.debug('On sync: Result (%s -> %s) %j this %j', prevState, state, result, this)
    }
  }
  onSync = onSync.bind(selfMatrixManager)
  /**
   * Generates a login promise accoding to username, password at the given identity server (as homeserver)
   * @param username the matrix username credential
   * @param password the matrix password credential associated to the previous username
   * @param homeserver the matrix identity server to perform login against
   * @return a login promise to use the matrix client
   */
  selfMatrixManager.login = function login (username, password, homeserver) {
    if (LOG_LOGINS) {
      $log.debug('Login with %s %s %s', username, password, homeserver)
    }

    selfMatrixManager.status = 'CONNECTING'
    // 1. create public login to given homeserver (createClient just specifying homeserver)
    // 2. login with password into public logged homeserver (loginWithPassword)
    // 3. create new client with password login info (createClient with loginWithPassword retrieved access_token)
    // 4. after real login register data bindings to $scope (onSync event bind)
    loginPromise = matrixJsSdk.createClient({baseUrl: homeserver})
      .loginWithPassword(username, password)
      .then(function (result) {
        if (LOG_LOGINS) {
          $log.debug('On login: Result %j', result)
        }

        client = matrixJsSdk.createClient({
          baseUrl: homeserver,
          accessToken: result.access_token,
          userId: result.user_id
        })

        client.on('sync', onSync)

        // Listens on all matrix events on rooms, this allows us to add filters to manage signalling for webrtc
        client.on('event', function (event, room, toStartOfTimeline) {
          selfMatrixManager.signallingManagers.forEach(function (signallingManager) {
            var eventOk = false
            if (selfMatrixManager.signallingEventTypes.indexOf(event.getType()) >= 0) {
              eventOk = signallingManager.filter(event, room, toStartOfTimeline)
              $log.debug('Processing a MIDI event %s %j', eventOk, event)
              if (eventOk) {
                $log.debug('Event fired on %s (startOfTimeline %s) %j', room, toStartOfTimeline, event)
                signallingManager.emit(event.getType(), event.getContent())
              }
            }
          })
        })

        client.startClient()
        selfMatrixManager.status = 'CONNECTED'
        selfMatrixManager.emit('update')

        if (LOG_LOGINS) {
          $log.debug('Logged! %j', client)
        }

        return client
      })
  }

  /**
   * Logs out the current user and destroys the login promise
   */
  selfMatrixManager.stop = function stop () {
    $log.debug('Stopping client %j', this.loginPromise)
    if (client) {
      this.status = 'UNLOGGED'
      client.stopClient()
      loginPromise = null
      client = null
    } else {
      throw new Error('Not logged in, cant stop')
    }
  }

  /**
   * Checks specified roomId exists on the homeserver you've logged in
   */
  selfMatrixManager.checkRoomExists = function checkRoomExists (roomId) {
    $log.debug('Checking room %s %j', roomId, this.loginPromise)
    if (client) {
      return client.getRoom(roomId)
    } else {
      throw new Error('Not logged in, cant use client to check room exists')
    }
  }

  /**
   * Checks specified userId exists on the homeserver you've logged in
   */
  selfMatrixManager.checkUserExists = function checkUserExists (userId) {
    $log.debug('Checking user %s %j', userId, this.loginPromise)
    if (client) {
      return client.getUser(userId)
    } else {
      throw new Error('Not logged in, cant use client to check user exists')
    }
  }

  /**
   * Signalling managers are filters that send relevant events to webrtc handlers
   */
  selfMatrixManager.signallingManagers = []

  /**
   * The signalling events that are relevant to MIDI jams
   */
  selfMatrixManager.signallingEventTypes = ['m.midi.start', 'm.midi.offer', 'm.midi.answer', 'm.midi.candidate', 'm.midi.end']

  /**
   * Create a new signalling manager with a filter by room and matrix jam starter user id
   */
  selfMatrixManager.SignallingManager = function SignallingManager (roomId, starterId, side) {
    if (['initiator', 'standard'].indexOf(side) < 0) {
      throw new Error('Side of signalling manager should be one of {initiator, standard}', 'matrix-manager')
    }
    EventEmitter.call(this)

    this.filter = function filter (event) {
      return event.getRoomId() === roomId
      && event.getContent().side !== side
      && event.getContent().starterId === starterId
      && selfMatrixManager.signallingEventTypes.indexOf(event.getType()) >= 0
    }

    this.sendOffer = function sendOffer (offer, peerId) {
      if (client) {
        client.sendEvent(roomId, 'm.midi.offer', {side: side, offer: offer, starterId: starterId, userId: peerId})
      } else {
        throw new Error('Not logged in, cant send jam events (at send offer)')
      }
    }

    this.sendCandidate = function sendCandidate (candidate, peerId) {
      if (client) {
        client.sendEvent(roomId, 'm.midi.candidate', {side: side, candidate: candidate, starterId: starterId, userId: peerId})
      } else {
        throw new Error('Not logged in, cant send jam events (at send candidate)')
      }
    }

    this.sendAnswer = function sendAnswer (answer, peerId) {
      if (client) {
        client.sendEvent(roomId, 'm.midi.answer', {side: side, answer: answer, starterId: starterId, userId: peerId})
      } else {
        throw new Error('Not logged in, cant send jam events (at send answer)')
      }
    }

    if (side === 'initiator') {
      this.startJam = function startJam () {
        if (client) {
          client.sendEvent(roomId, 'm.midi.start', {msg: 'Jam starts', starterId: starterId, side: side})
          client.sendTextMessage(roomId, 'Jam started! Join using midi-over-matrix (roomId: ' + roomId + ', starterId: ' + starterId + ')')
        } else {
          throw new Error('Not logged in, cant start jam')
        }
      }
    }
    selfMatrixManager.signallingManagers.push(this)
  }
  util.inherits(selfMatrixManager.SignallingManager, EventEmitter)
}

module.exports = ['$log', MatrixManager]
