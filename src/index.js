var angular = require('angular')
var midiManager = require('./midi-manager')
var matrixJsSdk = require('matrix-js-sdk')

var midiOverMatrixCtrl = ['MidiManager', '$scope', '$log', '$interval', function (MidiManager, $scope, $log, $interval) {
  // Default homeserver
  $scope.user = {}
  $scope.user.homeserver = 'https://matrix.org'
  $scope.isLoggedIn = false
  $scope.ownRooms = []
  $scope.publicRooms = []
  $scope.midiInputs = []
  $scope.midiOutputs = []

  MidiManager.start()
  MidiManager.on('data', function (data) {
    $log.debug('Received midi data %j', data)
  })
  MidiManager.on('ports', function (data) {
    $scope.midiInputs = data.inputs
    $scope.midiOutputs = data.outputs
  })

  // This packs the client for uses on scope functions
  // .then's must return the client they use for other functions
  var loginPromise = null

  $scope.login = function (username, password, homeserver) {
    // 1. create public login to given homeserver
    // 2. login with password into public logged homeserver
    // 3. create new client with password login info
    // 4. after real login register data bindings to $scope
    $log.debug('Login with %s %s %s', username, password, homeserver)
    loginPromise = matrixJsSdk.createClient({baseUrl: homeserver}).loginWithPassword(username, password).then(function (result) {
      $log.debug('On login: Result %j', result)

      client = matrixJsSdk.createClient({
        baseUrl: homeserver,
        accessToken: result.access_token,
        userId: result.user_id
      })

      client.on('sync', function (state, prevState, result) {
        $log.debug('On sync: Result (%s -> %s) %j', prevState, state, result)
      })

      return client
    }).then(function (client) {
      $log.debug('After login: client')
      client.on('sync', function (state, prevState, result) {
        if (state == 'SYNCING') {
          $scope.$apply(function () {
            $scope.ownRooms = []
            $log.debug('On sync+scope.apply: Result (%s -> %s) %j', prevState, state, result)
            $scope.ownRooms = client.getRooms()
            $log.debug('Own rooms: %j', $scope.ownRooms)
            $scope.isLoggedIn = true
          })
        }
      })
      client.startClient()
      return client
    })
  }

  $scope.stop = function () {
    $log.debug('Stopping client')
    if (loginPromise) {
      $log.debug('Stopped client')
      $scope.isLoggedIn = false
      loginPromise.then(function (client) {
        client.stopClient()
        $log.debug('Stopped client 2')
      })
    }
  }
  function setJammingStatus (roomId, jamming) {
    $log.debug('Adding jamming status %s to %s', jamming, roomId)

    if (loginPromise) {
      loginPromise.then(function (client) {
        var jamPromise = client.sendStateEvent(roomId, 'm.midi.jamming', {jamming: jamming}, undefined).then(function success (result) {
          $log.debug('Result of jamming: %j', result)
        }).catch(function error (result) {
          $log.debug('Error in jamming: %j', result)
        })
      })
    }
  }

  $scope.sendJammingEvent = setJammingStatus
}]

angular.module('MidiOverMatrix', [])
  .service('MidiManager', midiManager)
  .controller('MidiOverMatrixCtrl', midiOverMatrixCtrl)
