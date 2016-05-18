const matrixJsSdk = require('matrix-js-sdk')
const EventEmitter = require('events')
const util = require('util')

util.inherits(MatrixManager, EventEmitter)
function MatrixManager ($log) {
  EventEmitter.call(this)
  this.ownRooms = []
  this.users = []
  this.isLoggedIn = false
  var loginPromise = null

  var onSync = function (state, prevState, result) {
    if (state == 'SYNCING') {
      this.ownRooms = client.getRooms()
      this.users = client.getUsers()
      this.isLoggedIn = true
      this.emit('update')
    }
    $log.debug('On sync: Result (%s -> %s) %j this %j', prevState, state, result, this)
  }
  onSync = onSync.bind(this)

  this.login = function login (username, password, homeserver) {
    $log.debug('Login with %s %s %s', username, password, homeserver)

    // 1. create public login to given homeserver (createClient just specifying homeserver)
    // 2. login with password into public logged homeserver (loginWithPassword)
    // 3. create new client with password login info (createClient with loginWithPassword retrieved access_token)
    // 4. after real login register data bindings to $scope (onSync event bind)
    loginPromise = matrixJsSdk.createClient({baseUrl: homeserver})
      .loginWithPassword(username, password)
      .then(function (result) {
        $log.debug('On login: Result %j', result)

        client = matrixJsSdk.createClient({
          baseUrl: homeserver,
          accessToken: result.access_token,
          userId: result.user_id
        })

        client.on('sync', onSync)
        client.startClient()
        return client
      })
  }

  this.stop = function stop () {
    $log.debug('Stopping client %j', this.loginPromise)
    if (loginPromise) {
      this.isLoggedIn = false
      loginPromise.then(function (client) {
        client.stopClient()
        $log.debug('Stopped client')
      })
      loginPromise = null
    }
  }

  this.setJammingStatus = function setJammingStatus (roomId, jamming) {
    $log.debug('Adding jamming status %s to %s with %j', jamming, roomId, this.loginPromise)
    if (loginPromise) {
      loginPromise.then(function (client) {
        client
          .sendStateEvent(roomId, 'm.midi.jamming', {jamming: jamming}, undefined)
          .then(function success (result) {
            $log.debug('Result of jamming: %j', result)
          }).catch(function error (result) {
          $log.debug('Error in jamming: %j', result)
        })
      })
    }
  }
}

module.exports = ['$log', MatrixManager]
